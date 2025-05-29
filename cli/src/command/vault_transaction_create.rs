use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use clap::builder::ValueParser;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;

use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::client::get_multisig;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
use squads_multisig::squads_multisig_program::accounts::VaultTransactionCreate as VaultTransactionCreateAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
use squads_multisig::squads_multisig_program::instruction::VaultTransactionCreate as VaultTransactionCreateData;
use squads_multisig::squads_multisig_program::ProposalCreateArgs;
use squads_multisig::squads_multisig_program::VaultTransactionCreateArgs;

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

#[derive(Debug, Clone)]
struct TransactionMessage(Vec<u8>);

impl FromStr for TransactionMessage {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let s = s.trim();
        if !s.starts_with('[') || !s.ends_with(']') {
            return Err("Transaction message must be in format [1,2,3,4]".to_string());
        }

        // Remove brackets and split by commas
        let inner = &s[1..s.len()-1];
        let numbers: Result<Vec<u8>, _> = inner
            .split(',')
            .map(str::trim)
            .map(|num| num.parse::<u8>()
                .map_err(|_| format!("Invalid byte value: {}", num)))
            .collect();

        numbers.map(TransactionMessage)
    }
}

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

    /// The multisig where the transaction has been proposed
    #[arg(long)]
    multisig_pubkey: String,

    #[arg(long)]
    vault_index: u8,

    /// Transaction message in format [1,2,3,4]
    #[arg(long, value_parser = clap::value_parser!(TransactionMessage))]
    transaction_message: TransactionMessage,

    /// Memo to be included in the transaction
    #[arg(long)]
    memo: Option<String>,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,

    /// Skip confirmation prompt
    #[arg(long)]
    no_confirm: bool
}

impl VaultTransactionCreate {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
            memo,
            transaction_message,
            vault_index,
            priority_fee_lamports,
            no_confirm,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let transaction_creator_keypair = create_signer_from_path(keypair).unwrap();

        let transaction_creator = transaction_creator_keypair.pubkey();

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let rpc_url_clone = rpc_url.clone();
        let rpc_client = &RpcClient::new(rpc_url);

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let multisig_data = get_multisig(rpc_client, &multisig).await?;

        let transaction_index = multisig_data.transaction_index + 1;

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));
        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));
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
        println!();

        let proceed = if no_confirm {
            true
        } else {
            Confirm::new()
            .with_prompt("Do you want to proceed?")
            .default(false)
                .interact()?
        };

        if !proceed {
            println!("OK, aborting.");
            return Ok(());
        }
        println!();

        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let message = Message::try_compile(
            &transaction_creator,
            &[
                ComputeBudgetInstruction::set_compute_unit_price(
                    priority_fee_lamports.unwrap_or(5000),
                ),
                Instruction {
                    accounts: VaultTransactionCreateAccounts {
                        creator: transaction_creator,
                        rent_payer: transaction_creator,
                        transaction: transaction_pda.0,
                        multisig,
                        system_program: solana_sdk::system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: VaultTransactionCreateData {
                        args: VaultTransactionCreateArgs {
                            ephemeral_signers: 0,
                            vault_index,
                            memo,
                            transaction_message: transaction_message.0,
                        },
                    }
                    .data(),
                    program_id,
                },
                Instruction {
                    accounts: ProposalCreateAccounts {
                        creator: transaction_creator,
                        rent_payer: transaction_creator,
                        proposal: proposal_pda.0,
                        multisig,
                        system_program: solana_sdk::system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: ProposalCreateData {
                        args: ProposalCreateArgs {
                            draft: false,
                            transaction_index,
                        },
                    }
                    .data(),
                    program_id,
                },
            ],
            &[],
            blockhash,
        )
        .unwrap();

        let transaction = VersionedTransaction::try_new(
            VersionedMessage::V0(message),
            &[&*transaction_creator_keypair],
        )
        .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, &rpc_client).await?;

        println!(
            "✅ Transaction created successfully. Signature: {}",
            signature.green()
        );
        Ok(())
    }
}
