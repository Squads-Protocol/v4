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
use solana_sdk::transaction::VersionedTransaction;
use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::client::get_multisig;
use squads_multisig::client::utils::IntoAccountMetas;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig::solana_client::client_error::ClientErrorKind;
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::solana_client::rpc_request::{RpcError, RpcResponseErrorData};
use squads_multisig::solana_client::rpc_response::RpcSimulateTransactionResult;
use squads_multisig::squads_multisig_program::accounts::ConfigTransactionExecute as ConfigTransactionExecuteAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::ConfigTransactionExecute as ConfigTransactionExecuteData;

use crate::utils::create_signer_from_path;

#[derive(Args)]
pub struct ConfigTransactionExecute {
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
}

impl ConfigTransactionExecute {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
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

        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));

        println!();
        println!(
            "{}",
            "👀 You're about to execute a vault transaction, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url_clone);
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

        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let message = Message::try_compile(
            &transaction_creator,
            &[Instruction {
                accounts: ConfigTransactionExecuteAccounts {
                    member: transaction_creator,
                    transaction: transaction_pda.0,
                    rent_payer: Some(transaction_creator),
                    multisig,
                    proposal: proposal_pda.0,
                    system_program: Some(solana_sdk::system_program::id()),
                }
                .into_account_metas(program_id),
                data: ConfigTransactionExecuteData {}.data(),
                program_id,
            }],
            &[],
            blockhash,
        )
        .unwrap();

        let transaction = VersionedTransaction::try_new(
            VersionedMessage::V0(message),
            &[&*transaction_creator_keypair],
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
