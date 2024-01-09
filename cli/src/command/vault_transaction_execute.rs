use std::path::Path;
use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use eyre::eyre;
use indicatif::ProgressBar;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{EncodableKey, Keypair, Signer};
use solana_sdk::transaction::VersionedTransaction;

use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::pda::get_proposal_pda;
use squads_multisig::solana_client::client_error::ClientErrorKind;
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::solana_client::rpc_request::{RpcError, RpcResponseErrorData};
use squads_multisig::solana_client::rpc_response::RpcSimulateTransactionResult;
use squads_multisig::squads_multisig_program::accounts::VaultTransactionExecute as VaultTransactionExecuteAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::VaultTransactionExecute as VaultTransactionExecuteData;

#[derive(Args)]
pub struct VaultTransactionExecute {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the Program Config Initializer Keypair
    #[arg(long)]
    keypair: String,

    /// Index of the transaction to vote on
    #[arg(long)]
    transaction_index: u64,

    /// The multisig where the transaction has been proposed
    #[arg(long)]
    multisig_pubkey: String,
}

impl VaultTransactionExecute {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
            transaction_index,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let transaction_creator_keypair =
            Keypair::read_from_file(Path::new(&keypair)).expect("Invalid keypair");
        let transaction_creator = transaction_creator_keypair.pubkey();

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let transaction_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());

        println!();
        println!(
            "{}",
            "👀 You're about to execute a vault transaction, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url);
        println!("Program ID:        {}", program_id);
        println!("Your Public Key:       {}", transaction_creator);
        println!();
        println!("⚙️ Config Parameters");
        println!("Multisig Key:       {}", multisig_pubkey);
        println!("Transaction Index:       {}", transaction_index);
        println!("Vote Type:       {}", transaction_index);
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
            &[Instruction {
                accounts: VaultTransactionExecuteAccounts {
                    member: transaction_creator,
                    multisig,
                    proposal: proposal_pda.0,
                    transaction: transaction_pda.0,
                }
                .to_account_metas(Some(false)),
                data: VaultTransactionExecuteData {}.data(),
                program_id,
            }],
            &[],
            blockhash,
        )
        .unwrap();

        let transaction = VersionedTransaction::try_new(
            VersionedMessage::V0(message),
            &[&transaction_creator_keypair as &dyn Signer],
        )
        .expect("Failed to create transaction");

        match rpc_client.send_and_confirm_transaction(&transaction).await {
            Ok(signature) => {
                progress.finish_with_message(format!("Transaction confirmed: {}\n\n", signature));
            }
            Err(err) => {
                progress.finish_and_clear();

                if let ClientErrorKind::RpcError(RpcError::RpcResponseError {
                    data:
                        RpcResponseErrorData::SendTransactionPreflightFailure(
                            RpcSimulateTransactionResult {
                                logs: Some(logs), ..
                            },
                        ),
                    ..
                }) = &err.kind
                {
                    println!("Simulation logs:\n\n{}\n", logs.join("\n").yellow());
                };

                return Err(eyre!(format!(
                    "Transaction failed: {}",
                    err.to_string().red()
                )));
            }
        }

        println!(
            "✅ Executed Vault Transaction. Signature: {}",
            transaction.signatures[0]
        );
        Ok(())
    }
}