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
use squads_multisig_4r::builders::{
    ProposalApprove, ProposalCreate, VaultTransactionCreate as VaultTransactionCreateAccounts,
};
use squads_multisig_4r::instructions::{
    ProposalCreateArgs, ProposalVoteArgs, VaultTransactionCreateArgs,
};
use squads_multisig_4r::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig_4r::rpc::fetch_multisig;

use crate::utils::{has_permission, send_and_confirm_transaction, signer_from_path, Permission};

/// Create a new vault transaction and activate its proposal for voting.
#[derive(Args)]
pub struct VaultTransactionCreate {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

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

    #[arg(long)]
    transaction_message: Vec<u8>,

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

impl VaultTransactionCreate {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            fee_payer_keypair,
            multisig_pubkey,
            memo,
            transaction_message,
            vault_index,
            priority_fee_lamports,
            approve,
        } = self;

        let program_id = program_id.unwrap_or_else(|| squads_multisig_4r::ID.to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

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
        let payer = fee_payer.unwrap_or(transaction_creator);

        let mut instructions = vec![
            ComputeBudgetInstruction::set_compute_unit_price(priority_fee_lamports.unwrap_or(5000)),
            VaultTransactionCreateAccounts {
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
                    transaction_message,
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

        let message = Message::try_compile(&payer, &instructions, &[], blockhash).unwrap();
        let message_hash = hash(&message.serialize());

        println!();
        println!(
            "{}",
            "👀 You're about to create a vault transaction, please review the details:".yellow()
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
