use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_compute_budget_interface::ComputeBudgetInstruction;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::hash::hash;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use solana_system_interface::program as system_program;
use spl_associated_token_account_interface::address::get_associated_token_address_with_program_id;
use spl_token_interface::instruction::transfer;
use squads_multisig_4r::builders::{ProposalApprove, ProposalCreate, VaultTransactionCreate};
use squads_multisig_4r::instructions::{
    ProposalCreateArgs, ProposalVoteArgs, VaultTransactionCreateArgs,
};
use squads_multisig_4r::message::transaction_message_bytes;
use squads_multisig_4r::pda::{get_proposal_pda, get_transaction_pda, get_vault_pda};
use squads_multisig_4r::rpc::fetch_multisig;

use crate::command::transfer_common::{
    fetch_mint_decimals, format_token_amount, resolve_recipient_token_account,
};
use crate::utils::{
    has_permission, send_and_confirm_transaction, signer_from_path, with_events, Permission,
};

/// Create and activate a vault transaction that transfers SOL or SPL tokens from the vault.
#[derive(Args)]
pub struct InitiateTransfer {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Token program ID. Defaults to regular SPL.
    #[arg(long)]
    token_program_id: Option<String>,

    /// Token Mint Address.
    #[arg(long)]
    token_mint_address: String,

    #[arg(long)]
    token_amount_u64: u64,

    /// The recipient wallet address or token account address. If a wallet address is provided,
    /// the associated token account (ATA) will be derived automatically. If a token account address
    /// is provided, it will be validated to ensure it's for the correct mint.
    #[arg(long)]
    recipient: String,

    /// Path to the Program Config Initializer Keypair
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    /// The multisig where the transaction has been proposed
    #[arg(long)]
    multisig_pubkey: String,

    #[arg(long)]
    vault_index: u8,

    /// Memo to be included in the transaction
    #[arg(long)]
    memo: Option<String>,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,

    /// Approve the proposal atomically in the same transaction.
    /// Note: This only works if the proposer has Vote permission.
    #[arg(long)]
    approve: bool,
}

impl InitiateTransfer {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            token_program_id,
            keypair,
            fee_payer_keypair,
            multisig_pubkey,
            memo,
            vault_index,
            priority_fee_lamports,
            token_amount_u64,
            token_mint_address,
            recipient,
            approve,
        } = self;

        let program_id = program_id.unwrap_or_else(|| squads_multisig_4r::ID.to_string());

        let token_program_id = token_program_id
            .unwrap_or_else(|| "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");
        let token_program_id = Pubkey::from_str(&token_program_id).expect("Invalid program ID");

        let transaction_creator_keypair = signer_from_path(&keypair)?;
        let transaction_creator = transaction_creator_keypair.pubkey();
        let fee_payer_keypair = fee_payer_keypair
            .map(|path| signer_from_path(&path))
            .transpose()?;
        let fee_payer = fee_payer_keypair.as_ref().map(|kp| kp.pubkey());

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let rpc_url_clone = rpc_url.clone();
        let rpc_client = &RpcClient::new(rpc_url);

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let recipient_pubkey = Pubkey::from_str(&recipient).expect("Invalid recipient address");

        let token_mint = Pubkey::from_str(&token_mint_address).expect("Invalid Token Mint Address");

        let decimals = fetch_mint_decimals(rpc_client, &token_mint, &token_program_id).await?;

        let resolved_recipient = resolve_recipient_token_account(
            rpc_client,
            &recipient_pubkey,
            &token_mint,
            &token_program_id,
        )
        .await?;
        let recipient_ata = resolved_recipient.token_account;

        let multisig_data = fetch_multisig(rpc_client, &multisig, Some(&program_id)).await?;

        // Check if the proposer has Vote permission when --approve is used
        if approve {
            let has_vote_permission = multisig_data.members.iter().any(|m| {
                m.key == transaction_creator && has_permission(&m.permissions, Permission::Vote)
            });
            if !has_vote_permission {
                return Err(eyre::eyre!(
                    "Cannot use --approve: {} does not have Vote permission in this multisig",
                    transaction_creator
                ));
            }
        }

        let transaction_index = multisig_data.transaction_index + 1;

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));
        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        // Build the message first so we can show the hash before confirmation
        let vault_pda = get_vault_pda(&multisig, vault_index, Some(&program_id));

        let sender_ata = get_associated_token_address_with_program_id(
            &vault_pda.0,
            &token_mint,
            &token_program_id,
        );

        let transfer_message = transaction_message_bytes(
            &vault_pda.0,
            &[transfer(
                &token_program_id,
                &sender_ata,
                &recipient_ata,
                &vault_pda.0,
                &[&vault_pda.0],
                token_amount_u64,
            )
            .unwrap()],
            &[],
        )
        .unwrap();

        let payer = fee_payer.unwrap_or(transaction_creator);

        let mut instructions = vec![
            ComputeBudgetInstruction::set_compute_unit_price(
                priority_fee_lamports.unwrap_or(200_000),
            ),
            VaultTransactionCreate {
                creator: transaction_creator,
                rent_payer: fee_payer.unwrap_or(transaction_creator),
                transaction: transaction_pda.0,
                multisig,
                system_program: system_program::ID,
            }
            .instruction(
                VaultTransactionCreateArgs {
                    ephemeral_signers: 0,
                    vault_index,
                    memo: memo.clone(),
                    transaction_message: transfer_message,
                },
                Some(&program_id),
            )?,
            ProposalCreate {
                creator: transaction_creator,
                rent_payer: fee_payer.unwrap_or(transaction_creator),
                proposal: proposal_pda.0,
                multisig,
                system_program: system_program::ID,
            }
            .instruction(
                ProposalCreateArgs {
                    draft: false,
                    transaction_index,
                },
                Some(&program_id),
            )?,
        ];

        if approve {
            instructions.push(
                ProposalApprove {
                    member: transaction_creator,
                    multisig,
                    proposal: proposal_pda.0,
                }
                .instruction(ProposalVoteArgs { memo }, Some(&program_id))?,
            );
        }

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let message = Message::try_compile(
            &payer,
            &with_events(instructions, &program_id),
            &[],
            blockhash,
        )
        .unwrap();
        let message_hash = hash(&message.serialize());

        println!();
        println!(
            "{}",
            "👀 You're about to create a transfer transaction, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url_clone);
        println!("Program ID:        {}", program_id);
        println!("Your Public Key:       {}", transaction_creator);
        println!();
        println!("⚙️ Config Parameters");
        println!("Multisig Key:       {}", multisig_pubkey);
        println!("Transaction Index:       {}", transaction_index);
        println!("Vault Index:       {}", vault_index);
        println!();
        println!("Recipient:       {}", resolved_recipient.authority);
        println!("Recipient Token Account:       {}", recipient_ata);
        println!(
            "Transfer Amount:       {}",
            format_token_amount(token_amount_u64, decimals)
        );
        println!("Auto-approve:       {}", approve);
        println!();
        println!("Message Hash (verify on hardware wallet): {}", message_hash);
        println!();

        let proceed = Confirm::new()
            .with_prompt("Do you want to proceed?")
            .default(false)
            .interact()?;
        if !proceed {
            println!("OK, aborting.");
            return Ok(());
        }
        println!();

        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let mut signers = vec![&*transaction_creator_keypair];
        if let Some(ref fee_payer_kp) = fee_payer_keypair {
            signers.push(&**fee_payer_kp);
        }

        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)
            .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, rpc_client).await?;

        if approve {
            println!(
                "✅ Transaction created and approved. Signature: {}",
                signature.green()
            );
        } else {
            println!(
                "✅ Transaction created successfully. Signature: {}",
                signature.green()
            );
        }
        Ok(())
    }
}
