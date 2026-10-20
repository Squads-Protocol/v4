use std::str::FromStr;

use clap::Args;
use colored::Colorize;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::clock::Clock;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::sysvar;
use squads_multisig_4r::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig_4r::rpc::decode_checked;
use squads_multisig_4r::state::{
    Batch, ConfigTransaction, Multisig, Proposal, ProposalStatus, VaultTransaction,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TxKind {
    Vault,
    Config,
    Batch,
}

impl TxKind {
    fn label(self) -> &'static str {
        match self {
            TxKind::Vault => "Vault Transaction",
            TxKind::Config => "Config Transaction",
            TxKind::Batch => "Batch",
        }
    }
}

/// Fetch and display all proposals for a multisig, showing their status and transaction index.
#[derive(Args)]
pub struct DisplayProposals {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// The multisig to query proposals for
    #[arg(long)]
    multisig_pubkey: String,

    /// Maximum number of recent transactions to check (default: 20)
    #[arg(short = 'n', long, default_value_t = 20)]
    limit: u64,
}

impl DisplayProposals {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            multisig_pubkey,
            limit,
        } = self;

        let program_id = program_id.unwrap_or_else(|| squads_multisig_4r::ID.to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let rpc_client = RpcClient::new(rpc_url.clone());

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        println!();
        println!("{}", "🔍 Fetching outstanding proposals...".yellow());
        println!();
        println!("RPC Cluster URL:   {}", rpc_url);
        println!("Program ID:        {}", program_id);
        println!("Multisig Key:      {}", multisig_pubkey);
        println!();

        // Fetch the multisig account and clock sysvar together
        let accounts = rpc_client
            .get_multiple_accounts(&[multisig, sysvar::clock::ID])
            .await
            .map_err(|e| eyre::eyre!("Failed to fetch accounts: {}", e))?;

        let multisig_account_data = accounts[0]
            .as_ref()
            .ok_or_else(|| eyre::eyre!("Multisig account not found"))?;

        let clock_account_data = accounts[1]
            .as_ref()
            .ok_or_else(|| eyre::eyre!("Clock sysvar not found"))?;

        let multisig_account =
            decode_checked::<Multisig>(&multisig, multisig_account_data, Some(&program_id))
                .map_err(|e| eyre::eyre!("Failed to deserialize multisig: {}", e))?;

        let clock: Clock = bincode::deserialize(&clock_account_data.data)
            .map_err(|e| eyre::eyre!("Failed to deserialize clock: {}", e))?;

        let current_timestamp = clock.unix_timestamp;

        let transaction_index = multisig_account.transaction_index;
        println!("Total transactions: {}", transaction_index);
        println!("Checking last {} transactions...", limit);
        println!();

        if transaction_index == 0 {
            println!("No transactions found for this multisig.");
            return Ok(());
        }

        let mut outstanding_proposals = Vec::new();

        // Calculate the starting index (don't go below 1)
        let start_idx = transaction_index.saturating_sub(limit - 1).max(1);

        // When the scan window does not reach transaction index 1, there are older
        // transactions we never inspected. An already-`Approved` vault proposal in that
        // hidden range remains executable on-chain, so we must never report an
        // unqualified all-clear based on this bounded scan.
        let window_truncated = start_idx > 1;

        // Iterate through recent transaction indices in reverse order (most recent first)
        for idx in (start_idx..=transaction_index).rev() {
            let proposal_pda = get_proposal_pda(&multisig, idx, Some(&program_id));
            let transaction_pda = get_transaction_pda(&multisig, idx, Some(&program_id));

            // Fetch the proposal and its linked transaction account together
            let accounts = match rpc_client
                .get_multiple_accounts(&[proposal_pda.0, transaction_pda.0])
                .await
            {
                Ok(accounts) => accounts,
                Err(_) => continue,
            };

            let proposal = match accounts[0].as_ref() {
                Some(account) => {
                    match decode_checked::<Proposal>(&proposal_pda.0, account, Some(&program_id)) {
                        Ok(proposal) => proposal,
                        // Account exists but failed to deserialize - skip
                        Err(_) => continue,
                    }
                }
                // Account doesn't exist - skip
                None => continue,
            };

            let kind = accounts[1].as_ref().and_then(|tx_acc| {
                let (tx_key, owner) = (&transaction_pda.0, Some(&program_id));
                if decode_checked::<Batch>(tx_key, tx_acc, owner).is_ok() {
                    Some(TxKind::Batch)
                } else if decode_checked::<VaultTransaction>(tx_key, tx_acc, owner).is_ok() {
                    Some(TxKind::Vault)
                } else if decode_checked::<ConfigTransaction>(tx_key, tx_acc, owner).is_ok() {
                    Some(TxKind::Config)
                } else {
                    None
                }
            });

            // Check if proposal is outstanding (Draft, Active, or Approved)
            let is_outstanding = matches!(
                proposal.status,
                ProposalStatus::Draft { .. }
                    | ProposalStatus::Active { .. }
                    | ProposalStatus::Approved { .. }
            );

            if is_outstanding {
                outstanding_proposals.push((idx, proposal, kind));
            }
        }

        if outstanding_proposals.is_empty() {
            if window_truncated {
                println!(
                    "{}",
                    format!(
                        "No outstanding proposals found in the last {} transaction(s) \
                         (indices {}..={}).",
                        limit, start_idx, transaction_index
                    )
                    .yellow()
                );
                println!(
                    "{}",
                    format!(
                        "WARNING: transaction indices 1..={} were NOT checked. An older \
                         Approved vault proposal in that range may still be executable. \
                         Re-run with `-n {}` (or higher) to scan all transactions.",
                        start_idx - 1,
                        transaction_index
                    )
                    .red()
                );
            } else {
                println!("{}", "No outstanding proposals found.".green());
            }
            return Ok(());
        }

        println!(
            "{}",
            format!(
                "Found {} outstanding proposal(s):",
                outstanding_proposals.len()
            )
            .green()
        );
        println!();

        // Display proposals
        for (idx, proposal, kind) in outstanding_proposals {
            println!("{}", "─".repeat(80).bright_black());
            println!("Transaction Index: {}", idx.to_string().cyan());
            println!(
                "Proposal PDA:     {}",
                get_proposal_pda(&multisig, idx, Some(&program_id)).0
            );
            println!(
                "Type:             {}",
                kind.map(TxKind::label).unwrap_or("Unknown")
            );

            // Proposals at or below the stale index can no longer be activated or voted
            // on; approved config transactions can no longer be executed. Approved
            // vault/batch transactions remain executable even when stale.
            let is_stale = idx <= multisig_account.stale_transaction_index;

            // Display status
            let status_str = match &proposal.status {
                ProposalStatus::Draft { timestamp } => {
                    let base = format!(
                        "Draft (created: {})",
                        format_timestamp(*timestamp, current_timestamp)
                    );
                    if is_stale {
                        format!("{} — stale, can no longer be activated", base).red()
                    } else {
                        base.yellow()
                    }
                }
                ProposalStatus::Active { timestamp } => {
                    let base = format!(
                        "Active (activated: {})",
                        format_timestamp(*timestamp, current_timestamp)
                    );
                    if is_stale {
                        format!("{} — stale, can no longer be voted on", base).red()
                    } else {
                        base.yellow()
                    }
                }
                ProposalStatus::Approved { timestamp } => {
                    let base = format!(
                        "Approved (approved: {})",
                        format_timestamp(*timestamp, current_timestamp)
                    );
                    if is_stale && kind == Some(TxKind::Config) {
                        format!("{} — stale, can no longer be executed", base).red()
                    } else {
                        let unlock_at = timestamp + i64::from(multisig_account.time_lock);
                        if current_timestamp >= unlock_at {
                            format!("{} — executable now", base).green()
                        } else {
                            format!(
                                "{} — timelocked, unlocks in {}",
                                base,
                                format_duration(unlock_at - current_timestamp)
                            )
                            .yellow()
                        }
                    }
                }
                // Filtered out by is_outstanding check above
                _ => unreachable!(
                    "We filtered proposals by status above, so this should never happen"
                ),
            };
            println!("Status:           {}", status_str);

            // Display votes
            println!("Approved by:     {} member(s)", proposal.approved.len());
            if !proposal.approved.is_empty() {
                for pubkey in &proposal.approved {
                    println!("  - {}", pubkey);
                }
            }

            println!("Rejected by:     {} member(s)", proposal.rejected.len());
            if !proposal.rejected.is_empty() {
                for pubkey in &proposal.rejected {
                    println!("  - {}", pubkey);
                }
            }

            println!("Cancelled by:    {} member(s)", proposal.cancelled.len());
            if !proposal.cancelled.is_empty() {
                for pubkey in &proposal.cancelled {
                    println!("  - {}", pubkey);
                }
            }

            println!();
        }

        println!("{}", "─".repeat(80).bright_black());

        if window_truncated {
            println!();
            println!(
                "{}",
                format!(
                    "NOTE: only transaction indices {}..={} were checked. Older Approved \
                     vault proposals (indices 1..={}) are not shown and may still be \
                     executable. Re-run with `-n {}` (or higher) to scan all transactions.",
                    start_idx,
                    transaction_index,
                    start_idx - 1,
                    transaction_index
                )
                .yellow()
            );
        }

        Ok(())
    }
}

fn format_timestamp(timestamp: i64, current_timestamp: i64) -> String {
    let diff = current_timestamp - timestamp;

    if diff < 0 {
        format!("in {} seconds", -diff)
    } else if diff < 60 {
        format!("{} seconds ago", diff)
    } else if diff < 3600 {
        format!("{} minutes ago", diff / 60)
    } else if diff < 86400 {
        format!("{} hours ago", diff / 3600)
    } else {
        format!("{} days ago", diff / 86400)
    }
}

fn format_duration(seconds: i64) -> String {
    if seconds < 60 {
        format!("{} seconds", seconds)
    } else if seconds < 3600 {
        format!("{} minutes", seconds / 60)
    } else if seconds < 86400 {
        format!("{} hours", seconds / 3600)
    } else {
        format!("{} days", seconds / 86400)
    }
}
