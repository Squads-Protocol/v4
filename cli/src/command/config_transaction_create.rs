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
use solana_sdk::transaction::VersionedTransaction;

use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::client::get_multisig;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
use squads_multisig::squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;

use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::ConfigTransactionCreate as ConfigTransactionCreateData;
use squads_multisig::squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
use squads_multisig::squads_multisig_program::{ConfigTransactionCreateArgs, ProposalCreateArgs};
use squads_multisig::state::{ConfigAction, Period, Permissions};

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

#[derive(Args)]
pub struct ConfigTransactionCreate {
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

    /// The action to execute
    #[arg(long)]
    action: String,

    /// Transaction Memo
    #[arg(long)]
    memo: Option<String>,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,
}

impl ConfigTransactionCreate {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
            action,
            memo,
            priority_fee_lamports,
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

        let config_action = parse_action(&action);

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
        println!("Action Type:       {}", action);
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
            &[
                ComputeBudgetInstruction::set_compute_unit_price(
                    priority_fee_lamports.unwrap_or(5000),
                ),
                Instruction {
                    accounts: ConfigTransactionCreateAccounts {
                        creator: transaction_creator,
                        multisig,
                        rent_payer: transaction_creator,
                        transaction: transaction_pda.0,
                        system_program: solana_sdk::system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: ConfigTransactionCreateData {
                        args: ConfigTransactionCreateArgs {
                            actions: vec![config_action.unwrap()],
                            memo,
                        },
                    }
                    .data(),
                    program_id,
                },
                Instruction {
                    accounts: ProposalCreateAccounts {
                        creator: transaction_creator,
                        multisig,
                        rent_payer: transaction_creator,
                        proposal: proposal_pda.0,
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
            "✅ Created Config Transaction. Signature: {}",
            signature.green()
        );
        Ok(())
    }
}

fn parse_action(action_str: &str) -> Result<ConfigAction, String> {
    let parts: Vec<&str> = action_str.split_whitespace().collect();
    match parts.get(0).map(|s| *s) {
        Some("AddMember") => {
            let new_member = squads_multisig::state::Member {
                key: Pubkey::from_str(parts.get(1).unwrap()).unwrap(),
                permissions: Permissions {
                    mask: parts.get(2).unwrap().parse().unwrap(),
                },
            };

            Ok(ConfigAction::AddMember { new_member })
        }
        Some("RemoveMember") => {
            let old_member = parts
                .get(1)
                .ok_or("Old member pubkey is required for RemoveMember action")?
                .parse()
                .map_err(|_| "Invalid old member pubkey format")?;
            Ok(ConfigAction::RemoveMember { old_member })
        }
        Some("ChangeThreshold") => {
            let new_threshold = parts
                .get(1)
                .ok_or("New threshold is required for ChangeThreshold action")?
                .parse()
                .map_err(|_| "Invalid new threshold format")?;
            Ok(ConfigAction::ChangeThreshold { new_threshold })
        }
        Some("SetTimeLock") => {
            let new_time_lock = parts
                .get(1)
                .ok_or("New time lock is required for SetTimeLock action")?
                .parse()
                .map_err(|_| "Invalid new time lock format")?;
            Ok(ConfigAction::SetTimeLock { new_time_lock })
        }
        Some("AddSpendingLimit") => parse_add_spending_limit(&parts[1..]),
        Some("RemoveSpendingLimit") => {
            let spending_limit = parts
                .get(1)
                .ok_or("Spending limit pubkey is required for RemoveSpendingLimit action")?
                .parse()
                .map_err(|_| "Invalid spending limit pubkey format")?;
            Ok(ConfigAction::RemoveSpendingLimit { spending_limit })
        }
        Some("SetRentCollector") => {
            let new_rent_collector = parts
                .get(1)
                .map(|s| s.parse())
                .transpose()
                .map_err(|_| "Invalid rent collector pubkey format")?;
            Ok(ConfigAction::SetRentCollector { new_rent_collector })
        }
        _ => Err("Invalid or unsupported action".to_string()),
    }
}

fn parse_add_spending_limit(parts: &[&str]) -> Result<ConfigAction, String> {
    if parts.len() < 7 {
        return Err("Not enough arguments for AddSpendingLimit".to_string());
    }

    fn parse_pubkey_list(list_str: &str) -> Result<Vec<Pubkey>, String> {
        let mut pubkeys = Vec::new();
        for s in list_str.split(',') {
            let pubkey = s.parse().map_err(|_| "Invalid pubkey")?;
            pubkeys.push(pubkey);
        }
        Ok(pubkeys)
    }

    let create_key = parts[0].parse().map_err(|_| "Invalid create_key format")?;
    let vault_index = parts[1].parse().map_err(|_| "Invalid vault_index format")?;
    let mint = parts[2].parse().map_err(|_| "Invalid mint format")?;
    let amount = parts[3].parse().map_err(|_| "Invalid amount format")?;
    let members = parse_pubkey_list(parts[5]).map_err(|_| "Invalid members format")?;
    let destinations = parse_pubkey_list(parts[6]).map_err(|_| "Invalid destinations format")?;

    Ok(ConfigAction::AddSpendingLimit {
        create_key,
        vault_index,
        mint,
        amount,
        period: Period::Day,
        members,
        destinations,
    })
}
