use clap::Args;
use colored::Colorize;
use solana_sdk::pubkey::Pubkey;
use squads_multisig::anchor_lang::AccountDeserialize;
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::state::ConfigTransaction;
use squads_multisig::state::{ConfigAction, Period, Permission, Permissions};
use std::str::FromStr;

/// Fetch a config transaction account and display its decoded actions (add/remove member, change threshold, etc.).
#[derive(Args)]
pub struct DisplayConfigTransaction {
    /// RPC URL (default: https://api.mainnet-beta.solana.com)
    #[arg(long)]
    rpc_url: Option<String>,

    /// The ConfigTransaction account address to inspect
    #[arg(long)]
    transaction_address: String,
}

fn format_permissions(permissions: Permissions) -> String {
    let mut parts = Vec::new();
    if permissions.has(Permission::Initiate) {
        parts.push("Proposer");
    }
    if permissions.has(Permission::Vote) {
        parts.push("Voter");
    }
    if permissions.has(Permission::Execute) {
        parts.push("Executor");
    }
    if parts.is_empty() {
        "None".to_string()
    } else {
        parts.join(", ")
    }
}

fn format_period(period: Period) -> &'static str {
    match period {
        Period::OneTime => "One-time",
        Period::Day => "Daily",
        Period::Week => "Weekly",
        Period::Month => "Monthly",
    }
}

impl DisplayConfigTransaction {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc_url = self
            .rpc_url
            .unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let transaction_address = Pubkey::from_str(&self.transaction_address)?;

        let rpc_client = RpcClient::new(rpc_url);

        let account_data = match rpc_client.get_account(&transaction_address).await {
            Ok(account) => account.data,
            Err(_) => {
                println!("Account closed or not found.");
                return Ok(());
            }
        };

        let config_tx =
            ConfigTransaction::try_deserialize(&mut account_data.as_slice())?;

        println!();
        println!("{}", "Config Transaction Details".bold());
        println!("  Address:  {}", transaction_address);
        println!("  Multisig: {}", config_tx.multisig);
        println!("  Creator:  {}", config_tx.creator);
        println!("  Index:    {}", config_tx.index);
        println!();

        println!(
            "{}",
            format!("Actions ({})", config_tx.actions.len()).bold()
        );
        println!();

        for (i, action) in config_tx.actions.iter().enumerate() {
            match action {
                ConfigAction::AddMember { new_member } => {
                    println!("{}", format!("Action {}: Add Member", i + 1).yellow().bold());
                    println!("  Key:         {}", new_member.key);
                    println!(
                        "  Permissions: {}",
                        format_permissions(new_member.permissions)
                    );
                }
                ConfigAction::RemoveMember { old_member } => {
                    println!(
                        "{}",
                        format!("Action {}: Remove Member", i + 1).yellow().bold()
                    );
                    println!("  Key: {}", old_member);
                }
                ConfigAction::ChangeThreshold { new_threshold } => {
                    println!(
                        "{}",
                        format!("Action {}: Change Threshold", i + 1).yellow().bold()
                    );
                    println!("  New Threshold: {}", new_threshold);
                }
                ConfigAction::SetTimeLock { new_time_lock } => {
                    println!(
                        "{}",
                        format!("Action {}: Set Time Lock", i + 1).yellow().bold()
                    );
                    println!("  New Time Lock: {} seconds", new_time_lock);
                }
                ConfigAction::AddSpendingLimit {
                    create_key,
                    vault_index,
                    mint,
                    amount,
                    period,
                    members,
                    destinations,
                } => {
                    println!(
                        "{}",
                        format!("Action {}: Add Spending Limit", i + 1).yellow().bold()
                    );
                    println!("  Create Key:  {}", create_key);
                    println!("  Vault Index: {}", vault_index);
                    println!("  Mint:        {}", mint);
                    println!("  Amount:      {}", amount);
                    println!("  Period:      {}", format_period(*period));
                    if members.is_empty() {
                        println!("  Members:     (all)");
                    } else {
                        println!("  Members:");
                        for m in members {
                            println!("    {}", m);
                        }
                    }
                    if destinations.is_empty() {
                        println!("  Destinations: (any)");
                    } else {
                        println!("  Destinations:");
                        for d in destinations {
                            println!("    {}", d);
                        }
                    }
                }
                ConfigAction::RemoveSpendingLimit { spending_limit } => {
                    println!(
                        "{}",
                        format!("Action {}: Remove Spending Limit", i + 1).yellow().bold()
                    );
                    println!("  Spending Limit: {}", spending_limit);
                }
                ConfigAction::SetRentCollector { new_rent_collector } => {
                    println!(
                        "{}",
                        format!("Action {}: Set Rent Collector", i + 1).yellow().bold()
                    );
                    match new_rent_collector {
                        Some(key) => println!("  New Rent Collector: {}", key),
                        None => println!("  New Rent Collector: (disabled)"),
                    }
                }
                _ => {
                    println!(
                        "{}",
                        format!("Action {}: (unknown action type)", i + 1)
                            .yellow()
                            .bold()
                    );
                }
            }
            println!();
        }

        Ok(())
    }
}
