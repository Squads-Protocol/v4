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
use solana_sdk::system_program;
use solana_sdk::transaction::VersionedTransaction;

use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::pda::get_program_config_pda;
use squads_multisig::solana_client::client_error::ClientErrorKind;
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::solana_client::rpc_request::{RpcError, RpcResponseErrorData};
use squads_multisig::solana_client::rpc_response::RpcSimulateTransactionResult;
use squads_multisig::squads_multisig_program::accounts::ProgramConfigInit as ProgramConfigInitAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::ProgramConfigInit as ProgramConfigInitData;
use squads_multisig::squads_multisig_program::ProgramConfigInitArgs;

use crate::utils::create_signer_from_path;

#[derive(Args)]
pub struct ProgramConfigInit {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the Program Config Initializer Keypair
    #[arg(long)]
    initializer_keypair: String,

    /// Address of the Program Config Authority that will be set to control the Program Config
    #[arg(long)]
    program_config_authority: String,

    /// Address of the Treasury that will be set to receive the multisig creation fees
    #[arg(long)]
    treasury: String,

    /// Multisig creation fee in lamports
    #[arg(long)]
    multisig_creation_fee: u64,
}

impl ProgramConfigInit {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            initializer_keypair,
            program_config_authority,
            treasury,
            multisig_creation_fee,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");
        let program_config_authority = Pubkey::from_str(&program_config_authority)
            .expect("Invalid program config authority address");
        let treasury = Pubkey::from_str(&treasury).expect("Invalid treasury address");

        let transaction_creator_keypair = create_signer_from_path(initializer_keypair).unwrap();

        let transaction_creator = transaction_creator_keypair.pubkey();

        let program_config = get_program_config_pda(Some(&program_id)).0;

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
        println!("Config Authority:  {}", program_config_authority);
        println!("Treasury:          {}", treasury);
        println!("Creation Fee:      {}", multisig_creation_fee);
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
                accounts: ProgramConfigInitAccounts {
                    program_config,
                    initializer: transaction_creator,
                    system_program: system_program::id(),
                }
                .to_account_metas(Some(false)),
                data: ProgramConfigInitData {
                    args: ProgramConfigInitArgs {
                        authority: program_config_authority,
                        multisig_creation_fee,
                        treasury,
                    },
                }
                .data(),
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

        println!("✅ ProgramConfig Account: {}", program_config);
        Ok(())
    }
}
