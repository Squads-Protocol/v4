use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::{Keypair, Signer};
use solana_sdk::system_program;
use solana_sdk::transaction::VersionedTransaction;
use std::str::FromStr;
use std::time::Duration;

use squads_multisig::anchor_lang::{AccountDeserialize, InstructionData};
use squads_multisig::pda::get_multisig_pda;
use squads_multisig::pda::get_program_config_pda;
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::accounts::MultisigCreateV2 as MultisigCreateV2Accounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::MultisigCreateV2 as MultisigCreateV2Data;
use squads_multisig::squads_multisig_program::state::ProgramConfig;
use squads_multisig::squads_multisig_program::MultisigCreateArgsV2;
use squads_multisig::state::{Member, Permissions};

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

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

    #[arg(long)]
    rent_collector: Option<Pubkey>,

    #[arg(long, short, value_delimiter = ' ')]
    members: Vec<String>,

    #[arg(long)]
    threshold: u16,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,
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
            rent_collector,
            priority_fee_lamports,
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
        println!("Threshold:          {}", threshold);
        println!(
            "Rent Collector:     {}",
            rent_collector
                .map(|k| k.to_string())
                .unwrap_or_else(|| "None".to_string())
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

        let program_config_pda = get_program_config_pda(Some(&program_id));

        let program_config = rpc_client
            .get_account(&program_config_pda.0)
            .await
            .expect("Failed to fetch program config account");

        let mut program_config_data = program_config.data.as_slice();

        let treasury = ProgramConfig::try_deserialize(&mut program_config_data)
            .unwrap()
            .treasury;

        let message = Message::try_compile(
            &transaction_creator,
            &[
                ComputeBudgetInstruction::set_compute_unit_price(
                    priority_fee_lamports.unwrap_or(5000),
                ),
                Instruction {
                    accounts: MultisigCreateV2Accounts {
                        create_key: random_keypair.pubkey(),
                        creator: transaction_creator,
                        multisig: multisig_key.0,
                        system_program: system_program::id(),
                        program_config: program_config_pda.0,
                        treasury,
                    }
                    .to_account_metas(Some(false)),
                    data: MultisigCreateV2Data {
                        args: MultisigCreateArgsV2 {
                            config_authority,
                            members,
                            threshold,
                            time_lock: 0,
                            memo: None,
                            rent_collector,
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
            &[
                &*transaction_creator_keypair,
                &random_keypair as &dyn Signer,
            ],
        )
        .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, &rpc_client).await?;

        println!(
            "✅ Created Multisig: {}. Signature: {}",
            multisig_key.0,
            signature.green()
        );
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
