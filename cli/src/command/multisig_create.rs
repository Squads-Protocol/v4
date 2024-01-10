use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use eyre::eyre;
use indicatif::ProgressBar;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::system_program;
use solana_sdk::transaction::VersionedTransaction;
use std::str::FromStr;
use std::time::Duration;

use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::pda::get_multisig_pda;
use squads_multisig::solana_client::client_error::ClientErrorKind;
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::solana_client::rpc_request::{RpcError, RpcResponseErrorData};
use squads_multisig::solana_client::rpc_response::RpcSimulateTransactionResult;
use squads_multisig::squads_multisig_program::accounts::MultisigCreate as MultisigCreateAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::MultisigCreate as MultisigCreateData;
use squads_multisig::squads_multisig_program::MultisigCreateArgs;
use squads_multisig::state::{Member, Permissions};

use crate::utils::create_signer_from_path;

#[derive(Args)]
pub struct MultisigCreate {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the Program Config Initializer Keypair
    #[arg(long)]
    keypair: String,

    /// Address of the Program Config Authority that will be set to control the Program Config
    #[arg(long)]
    config_authority: Option<String>,

    #[arg(long, short, value_delimiter = ' ')]
    members: Vec<String>,

    #[arg(long)]
    threshold: u16,
}

impl MultisigCreate {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            config_authority,
            members,
            threshold,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let transaction_creator_keypair = create_signer_from_path(keypair).unwrap();

        let transaction_creator = transaction_creator_keypair.pubkey();

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());

        let members = parse_members(members).unwrap_or_else(|err| {
            eprintln!("Error parsing members: {}", err);
            std::process::exit(1);
        });

        println!();
        println!(
            "{}",
            "👀 You're about to create a multisig, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url);
        println!("Program ID:        {}", program_id);
        println!("Your Public Key:       {}", transaction_creator);
        println!();
        println!("⚙️ Config Parameters");
        println!();
        println!(
            "Config Authority:  {}",
            config_authority.as_deref().unwrap_or("None")
        );
        println!("Members amount:      {}", members.len());
        println!();

        let config_authority = config_authority.map(|s| Pubkey::from_str(&s)).transpose()?;

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

        let random_keypair = Keypair::new();

        let multisig_key = get_multisig_pda(&random_keypair.pubkey(), Some(&program_id));

        let message = Message::try_compile(
            &transaction_creator,
            &[Instruction {
                accounts: MultisigCreateAccounts {
                    create_key: random_keypair.pubkey(),
                    creator: transaction_creator,
                    multisig: multisig_key.0,
                    system_program: system_program::id(),
                }
                .to_account_metas(Some(false)),
                data: MultisigCreateData {
                    args: MultisigCreateArgs {
                        config_authority,
                        members,
                        threshold,
                        time_lock: 0,
                        memo: None,
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
            &[
                &*transaction_creator_keypair,
                &random_keypair as &dyn Signer,
            ],
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

        println!("✅ Created Multisig: {}", multisig_key.0);
        Ok(())
    }
}

fn parse_members(member_strings: Vec<String>) -> Result<Vec<Member>, String> {
    member_strings
        .into_iter()
        .map(|s| {
            let parts: Vec<&str> = s.split(',').collect();
            if parts.len() != 2 {
                return Err(
                    "Each entry must be in the format <public_key>,<permission>".to_string()
                );
            }

            let key =
                Pubkey::from_str(parts[0]).map_err(|_| "Invalid public key format".to_string())?;
            let permissions = parts[1]
                .parse::<u8>()
                .map_err(|_| "Invalid permission format".to_string())?;

            Ok(Member {
                key,
                permissions: Permissions { mask: permissions },
            })
        })
        .collect()
}
