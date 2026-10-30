use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_compute_budget_interface::ComputeBudgetInstruction;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use solana_system_interface::program as system_program;
use squads_multisig_4r::builders::ProgramConfigInit as ProgramConfigInitAccounts;
use squads_multisig_4r::instructions::ProgramConfigInitArgs;
use squads_multisig_4r::pda::get_program_config_pda;

use crate::utils::{send_and_confirm_transaction, signer_from_path, with_events};

/// Initialize the global program config account (one-time setup, authority only).
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

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    /// Address of the Program Config Authority that will be set to control the Program Config
    #[arg(long)]
    program_config_authority: String,

    /// Address of the Treasury that will be set to receive the multisig creation fees
    #[arg(long)]
    treasury: String,

    /// Multisig creation fee in lamports
    #[arg(long)]
    multisig_creation_fee: u64,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,
}

impl ProgramConfigInit {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            initializer_keypair,
            fee_payer_keypair,
            program_config_authority,
            treasury,
            multisig_creation_fee,
            priority_fee_lamports,
        } = self;

        let program_id = program_id.unwrap_or_else(|| squads_multisig_4r::ID.to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");
        let program_config_authority = Pubkey::from_str(&program_config_authority)
            .expect("Invalid program config authority address");
        let treasury = Pubkey::from_str(&treasury).expect("Invalid treasury address");

        let transaction_creator_keypair = signer_from_path(&initializer_keypair)?;
        let transaction_creator = transaction_creator_keypair.pubkey();
        let fee_payer_keypair = fee_payer_keypair
            .map(|path| signer_from_path(&path))
            .transpose()?;
        let fee_payer = fee_payer_keypair.as_ref().map(|kp| kp.pubkey());

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

        let payer = fee_payer.unwrap_or(transaction_creator);
        let message = Message::try_compile(
            &payer,
            &with_events(
                [
                    ComputeBudgetInstruction::set_compute_unit_price(
                        priority_fee_lamports.unwrap_or(5000),
                    ),
                    ProgramConfigInitAccounts {
                        program_config,
                        initializer: transaction_creator,
                        system_program: system_program::ID,
                    }
                    .instruction(
                        ProgramConfigInitArgs {
                            authority: program_config_authority,
                            multisig_creation_fee,
                            treasury,
                        },
                        Some(&program_id),
                    )?,
                ],
                &program_id,
            ),
            &[],
            blockhash,
        )
        .unwrap();

        let mut signers = vec![&*transaction_creator_keypair];
        if let Some(ref fee_payer_kp) = fee_payer_keypair {
            signers.push(&**fee_payer_kp);
        }

        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)
            .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, &rpc_client).await?;

        println!(
            "✅ ProgramConfig Account initialized: {}. Signature: {}",
            program_config,
            signature.green()
        );
        Ok(())
    }
}
