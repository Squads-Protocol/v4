use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::system_program;
use solana_sdk::transaction::VersionedTransaction;

use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::accounts::VaultTransactionAccountsClose as VaultTransactionAccountsCloseAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::VaultTransactionAccountsClose as VaultTransactionAccountsCloseData;

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

#[derive(Args)]
pub struct VaultTransactionAccountsClose {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the Keypair
    #[arg(long)]
    keypair: String,

    /// The multisig key
    #[arg(long)]
    multisig_pubkey: String,

    /// Index of the transaction to vote on
    #[arg(long)]
    transaction_index: u64,

    /// The proposal account key
    #[arg(long)]
    rent_collector: String,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,
}

impl VaultTransactionAccountsClose {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
            transaction_index,
            rent_collector,
            priority_fee_lamports,
        } = self;
        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());
        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig key");
        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");
        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));

        let rent_collector_key =
            Pubkey::from_str(&rent_collector).expect("Invalid rent collector key");

        let transaction_creator_keypair = create_signer_from_path(keypair).unwrap();

        let transaction_creator = transaction_creator_keypair.pubkey();

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());

        println!();
        println!(
            "{}",
            "👀 You're about to initialize ProgramConfig, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url);
        println!("Program ID:        {}", program_id);
        println!("Initializer:       {}", transaction_creator);
        println!();
        println!("⚙️ Config Parameters");
        println!();
        println!("Multisig Key:          {}", multisig_pubkey);
        println!("Transaction Index:      {}", transaction_index);
        println!("Rent reclamimer:      {}", rent_collector);
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

        let rpc_client = RpcClient::new(rpc_url);

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
                    accounts: VaultTransactionAccountsCloseAccounts {
                        multisig,
                        proposal: proposal_pda.0,
                        rent_collector: rent_collector_key,
                        transaction: transaction_pda.0,
                        system_program: system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: VaultTransactionAccountsCloseData {}.data(),
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
            "✅ Collected rent for transaction. Signature: {}",
            signature.green()
        );
        Ok(())
    }
}
