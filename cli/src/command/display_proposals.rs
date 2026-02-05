use std::str::FromStr;

use clap::Args;
use colored::Colorize;
use solana_sdk::clock::Clock;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::sysvar;
use squads_multisig::anchor_lang::AccountDeserialize;
use squads_multisig::pda::get_proposal_pda;
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::state::{Multisig, Proposal, ProposalStatus};

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

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

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
            Multisig::try_deserialize(&mut multisig_account_data.data.as_slice())
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

        // Iterate through recent transaction indices in reverse order (most recent first)
        for idx in (start_idx..=transaction_index).rev() {
            let proposal_pda = get_proposal_pda(&multisig, idx, Some(&program_id));

            // Try to fetch the proposal account
            match rpc_client.get_account(&proposal_pda.0).await {
                Ok(account) => {
                    // Deserialize the proposal
                    match Proposal::try_deserialize(&mut account.data.as_slice()) {
                        Ok(proposal) => {
                            // Check if proposal is outstanding (Draft, Active, or Approved)
                            let is_outstanding = matches!(
                                proposal.status,
                                ProposalStatus::Draft { .. }
                                    | ProposalStatus::Active { .. }
                                    | ProposalStatus::Approved { .. }
                            );

                            if is_outstanding {
                                outstanding_proposals.push((idx, proposal));
                            }
                        }
                        Err(_) => {
                            // Account exists but failed to deserialize - skip
                            continue;
                        }
                    }
                }
                Err(_) => {
                    // Account doesn't exist - skip
                    continue;
                }
            }
        }

        if outstanding_proposals.is_empty() {
            println!("{}", "No outstanding proposals found.".green());
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
        for (idx, proposal) in outstanding_proposals {
            println!("{}", "─".repeat(80).bright_black());
            println!("Transaction Index: {}", idx.to_string().cyan());
            println!(
                "Proposal PDA:     {}",
                get_proposal_pda(&multisig, idx, Some(&program_id)).0
            );

            // Display status
            let status_str = match &proposal.status {
                ProposalStatus::Draft { timestamp } => {
                    format!(
                        "Draft (created: {})",
                        format_timestamp(*timestamp, current_timestamp)
                    )
                }
                ProposalStatus::Active { timestamp } => {
                    format!(
                        "Active (activated: {})",
                        format_timestamp(*timestamp, current_timestamp)
                    )
                }
                ProposalStatus::Approved { timestamp } => {
                    format!(
                        "Approved (approved: {})",
                        format_timestamp(*timestamp, current_timestamp)
                    )
                }
                // Filtered out by is_outstanding check above
                _ => unreachable!(
                    "We filtered proposals by status above, so this should never happen"
                ),
            };
            println!("Status:           {}", status_str.yellow());

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
