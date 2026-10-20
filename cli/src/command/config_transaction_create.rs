use std::str::FromStr;

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
use squads_multisig_4r::instructions::{
    ConfigTransactionCreate as ConfigTransactionCreateAccounts,
    ConfigTransactionCreateInstructionArgs, ProposalApprove, ProposalApproveInstructionArgs,
    ProposalCreate, ProposalCreateInstructionArgs,
};
use squads_multisig_4r::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig_4r::rpc::fetch_multisig;
use squads_multisig_4r::types::{ConfigAction, Member, Period, Permissions};
use squads_multisig_4r::with_program_id;

use crate::utils::{has_permission, send_and_confirm_transaction, signer_from_path, Permission};

/// Create a new config transaction (add/remove member, change threshold, etc.) and activate its proposal.
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

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

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

    /// Approve the proposal atomically in the same transaction.
    /// Note: This only works if the proposer has Vote permission.
    #[arg(long)]
    approve: bool,
}

impl ConfigTransactionCreate {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            fee_payer_keypair,
            multisig_pubkey,
            action,
            memo,
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

        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));

        let config_action = parse_action(&action);

        // Surface the decoded spending-limit period so reviewers can confirm the
        // reset cadence that will actually be created before approving (the raw
        // action string alone previously hid that the period was ignored).
        let spending_limit_period = match &config_action {
            Ok(ConfigAction::AddSpendingLimit { period, .. }) => Some(*period),
            _ => None,
        };

        // Build the message first so we can show the hash before confirmation
        let payer = fee_payer.unwrap_or(transaction_creator);

        let mut instructions = vec![
            ComputeBudgetInstruction::set_compute_unit_price(priority_fee_lamports.unwrap_or(5000)),
            with_program_id(
                ConfigTransactionCreateAccounts {
                    creator: transaction_creator,
                    multisig,
                    rent_payer: fee_payer.unwrap_or(transaction_creator),
                    transaction: transaction_pda.0,
                    system_program: system_program::ID,
                }
                .instruction(ConfigTransactionCreateInstructionArgs {
                    actions: vec![config_action.unwrap()],
                    memo: memo.clone(),
                }),
                &program_id,
            ),
            with_program_id(
                ProposalCreate {
                    creator: transaction_creator,
                    multisig,
                    rent_payer: fee_payer.unwrap_or(transaction_creator),
                    proposal: proposal_pda.0,
                    system_program: system_program::ID,
                }
                .instruction(ProposalCreateInstructionArgs {
                    draft: false,
                    transaction_index,
                }),
                &program_id,
            ),
        ];

        if approve {
            instructions.push(with_program_id(
                ProposalApprove {
                    member: transaction_creator,
                    multisig,
                    proposal: proposal_pda.0,
                }
                .instruction(ProposalApproveInstructionArgs { memo }),
                &program_id,
            ));
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
            "👀 You're about to execute a config transaction, please review the details:".yellow()
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
        if let Some(period) = spending_limit_period {
            println!("Spending Limit Period:       {:?}", period);
        }
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

        let _progress = ProgressBar::new_spinner().with_message("Sending transaction...");

        let mut signers = vec![&*transaction_creator_keypair];
        if let Some(ref fee_payer_kp) = fee_payer_keypair {
            signers.push(&**fee_payer_kp);
        }

        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)
            .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, rpc_client).await?;

        if approve {
            println!(
                "✅ Created and approved Config Transaction. Signature: {}",
                signature.green()
            );
        } else {
            println!(
                "✅ Created Config Transaction. Signature: {}",
                signature.green()
            );
        }
        Ok(())
    }
}

fn parse_action(action_str: &str) -> Result<ConfigAction, String> {
    let parts: Vec<&str> = action_str.split_whitespace().collect();
    match parts.first().copied() {
        Some("AddMember") => {
            let new_member = Member {
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
    let period = parse_period(parts[4])?;
    let members = parse_pubkey_list(parts[5]).map_err(|_| "Invalid members format")?;
    let destinations = parse_pubkey_list(parts[6]).map_err(|_| "Invalid destinations format")?;

    Ok(ConfigAction::AddSpendingLimit {
        create_key,
        vault_index,
        mint,
        amount,
        period,
        members,
        destinations,
    })
}

/// Parse the spending limit reset period from its CLI string representation.
///
/// Unknown values are rejected rather than defaulting to a particular period,
/// so an operator never silently gets a period they did not request.
fn parse_period(period_str: &str) -> Result<Period, String> {
    match period_str {
        "OneTime" => Ok(Period::OneTime),
        "Day" => Ok(Period::Day),
        "Week" => Ok(Period::Week),
        "Month" => Ok(Period::Month),
        _ => Err(format!(
            "Invalid period '{}'. Expected one of: OneTime, Day, Week, Month",
            period_str
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // A valid base58 pubkey reused across the AddSpendingLimit test actions.
    const PUBKEY: &str = "11111111111111111111111111111111";

    fn add_spending_limit_action(period: &str) -> String {
        format!(
            "AddSpendingLimit {pk} 0 {pk} 1000 {period} {pk} {pk}",
            pk = PUBKEY,
            period = period
        )
    }

    #[test]
    fn add_spending_limit_round_trips_each_period() {
        for (input, expected) in [
            ("OneTime", Period::OneTime),
            ("Day", Period::Day),
            ("Week", Period::Week),
            ("Month", Period::Month),
        ] {
            let action = parse_action(&add_spending_limit_action(input))
                .unwrap_or_else(|e| panic!("expected '{input}' to parse, got error: {e}"));
            match action {
                ConfigAction::AddSpendingLimit { period, .. } => assert_eq!(
                    period, expected,
                    "requested period '{input}' was not preserved"
                ),
                _ => panic!("expected AddSpendingLimit action for input '{input}'"),
            }
        }
    }

    #[test]
    fn add_spending_limit_rejects_unknown_period() {
        // An unknown period must error rather than silently defaulting.
        let result = parse_action(&add_spending_limit_action("Yearly"));
        assert!(
            result.is_err(),
            "unknown period must be rejected, not defaulted"
        );
    }

    #[test]
    fn parse_period_maps_all_known_values() {
        assert_eq!(parse_period("OneTime"), Ok(Period::OneTime));
        assert_eq!(parse_period("Day"), Ok(Period::Day));
        assert_eq!(parse_period("Week"), Ok(Period::Week));
        assert_eq!(parse_period("Month"), Ok(Period::Month));
        assert!(parse_period("day").is_err());
        assert!(parse_period("").is_err());
    }
}
