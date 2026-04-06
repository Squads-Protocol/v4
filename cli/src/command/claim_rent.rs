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
use solana_sdk::system_program;
use solana_sdk::transaction::VersionedTransaction;
use squads_multisig::anchor_lang::AccountDeserialize;
use squads_multisig::client::get_multisig;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::accounts::BatchAccountsClose as BatchAccountsCloseAccounts;
use squads_multisig::squads_multisig_program::accounts::ConfigTransactionAccountsClose as ConfigTransactionAccountsCloseAccounts;
use squads_multisig::squads_multisig_program::accounts::VaultTransactionAccountsClose as VaultTransactionAccountsCloseAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::InstructionData;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::BatchAccountsClose as BatchAccountsCloseData;
use squads_multisig::squads_multisig_program::instruction::ConfigTransactionAccountsClose as ConfigTransactionAccountsCloseData;
use squads_multisig::squads_multisig_program::instruction::VaultTransactionAccountsClose as VaultTransactionAccountsCloseData;
use squads_multisig::squads_multisig_program::state::{Batch, ConfigTransaction, VaultTransaction};
use squads_multisig::state::{Proposal, ProposalStatus};

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

const DEFAULT_PRIORITY_FEE: u64 = 5000;
// Max close instructions per outer tx (RPC limits ~1232-byte message; 8 fits reliably).
const MAX_CLOSE_IX_PER_TX: usize = 8;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum TxAccountKind {
    Vault,
    Config,
    Batch,
}

/// Scan multisig transaction indices for closable proposal + transaction accounts and reclaim rent
/// to the multisig `rent_collector` (same mechanism as the Squads UI).
#[derive(Args)]
#[command(about = "Scan executed/terminal proposals and reclaim rent (vault, config, batch)")]
pub struct ClaimRent {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the signer keypair (fee payer unless --fee-payer-keypair is set)
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    #[arg(long)]
    multisig_pubkey: String,

    /// Only consider the last N transaction indices (most recent first when listing).
    #[arg(long, default_value_t = 500)]
    last_n: u64,

    /// List closable accounts and estimated rent only; do not send transactions.
    #[arg(long)]
    dry_run: bool,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,
}

struct CloseItem {
    index: u64,
    kind: TxAccountKind,
    status: ProposalStatus,
    proposal_lamports: u64,
    transaction_lamports: u64,
}

impl ClaimRent {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            fee_payer_keypair,
            multisig_pubkey,
            last_n,
            dry_run,
            priority_fee_lamports,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());
        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let transaction_creator_keypair = create_signer_from_path(keypair).unwrap();
        let transaction_creator = transaction_creator_keypair.pubkey();
        let fee_payer_keypair =
            fee_payer_keypair.map(|path| create_signer_from_path(path).unwrap());
        let fee_payer = fee_payer_keypair.as_ref().map(|kp| kp.pubkey());

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let rpc_url_clone = rpc_url.clone();
        let rpc_client = RpcClient::new(rpc_url);

        let multisig_data = get_multisig(&rpc_client, &multisig)
            .await
            .map_err(|e| eyre::eyre!("Failed to load multisig: {}", e))?;

        let rent_collector = multisig_data.rent_collector.ok_or_else(|| {
            eyre::eyre!(
                "This multisig has no rent_collector set; rent reclamation is disabled on-chain"
            )
        })?;

        let max_index = multisig_data.transaction_index;
        if max_index == 0 {
            println!("No transactions for this multisig.");
            return Ok(());
        }

        let start = max_index.saturating_sub(last_n.saturating_sub(1)).max(1);

        println!();
        println!(
            "{}",
            "🔎 Scanning for closable proposal/transaction accounts…".yellow()
        );
        println!("RPC:              {}", rpc_url_clone);
        println!("Multisig:         {}", multisig_pubkey);
        println!("Rent collector:   {}", rent_collector);
        println!(
            "Index range:      {} … {} (last {})",
            start, max_index, last_n
        );
        println!();

        let mut closable: Vec<CloseItem> = Vec::new();

        for idx in start..=max_index {
            let proposal_pda = get_proposal_pda(&multisig, idx, Some(&program_id));
            let transaction_pda = get_transaction_pda(&multisig, idx, Some(&program_id));

            let accounts = rpc_client
                .get_multiple_accounts(&[proposal_pda.0, transaction_pda.0])
                .await
                .map_err(|e| eyre::eyre!("RPC get_multiple_accounts: {}", e))?;

            let proposal_acc = accounts[0].as_ref();
            let tx_acc = match accounts[1].as_ref() {
                Some(a) => a,
                None => continue,
            };

            if tx_acc.owner != program_id {
                continue;
            }

            let kind = if Batch::try_deserialize(&mut tx_acc.data.as_slice()).is_ok() {
                TxAccountKind::Batch
            } else if VaultTransaction::try_deserialize(&mut tx_acc.data.as_slice()).is_ok() {
                TxAccountKind::Vault
            } else if ConfigTransaction::try_deserialize(&mut tx_acc.data.as_slice()).is_ok() {
                TxAccountKind::Config
            } else {
                continue;
            };

            let proposal = match proposal_acc {
                Some(p) if !p.data.is_empty() => Proposal::try_deserialize(&mut p.data.as_slice())
                    .map_err(|e| eyre::eyre!("Failed to deserialize proposal {}: {}", idx, e))?,
                _ => {
                    continue;
                }
            };

            if proposal.multisig != multisig {
                continue;
            }

            let batch = if kind == TxAccountKind::Batch {
                Some(
                    Batch::try_deserialize(&mut tx_acc.data.as_slice())
                        .map_err(|e| eyre::eyre!("Batch deserialize {}: {}", idx, e))?,
                )
            } else {
                None
            };

            if kind == TxAccountKind::Batch {
                if let Some(ref b) = batch {
                    if b.size != 0 {
                        println!(
                            "  {} index {}: batch still has {} pending inner tx (close those first)",
                            "skip".bright_black(),
                            idx,
                            b.size
                        );
                        continue;
                    }
                }
            }

            let can = match kind {
                TxAccountKind::Vault => {
                    can_close_vault_style(&proposal.status, &multisig_data, idx)
                }
                TxAccountKind::Config => {
                    can_close_config_style(&proposal.status, &multisig_data, idx)
                }
                TxAccountKind::Batch => {
                    can_close_vault_style(&proposal.status, &multisig_data, idx)
                }
            };

            if !can {
                continue;
            }

            let pl = proposal_acc.map(|a| a.lamports).unwrap_or(0);
            closable.push(CloseItem {
                index: idx,
                kind,
                status: proposal.status.clone(),
                proposal_lamports: pl,
                transaction_lamports: tx_acc.lamports,
            });
        }

        if closable.is_empty() {
            println!("{}", "No closable accounts found in this range.".green());
            return Ok(());
        }

        let total_lamports: u64 = closable
            .iter()
            .map(|c| c.proposal_lamports.saturating_add(c.transaction_lamports))
            .sum();

        println!(
            "Found {} closable transaction(s), ≈ {} SOL rent (proposal + tx lamports before close):",
            closable.len(),
            lamports_display_sol(total_lamports)
        );
        println!();
        for c in &closable {
            println!(
                "  index {:>4}  {:<6}  {:<36}  proposal {:>12} lamports  tx {:>12} lamports",
                c.index,
                match c.kind {
                    TxAccountKind::Vault => "vault",
                    TxAccountKind::Config => "config",
                    TxAccountKind::Batch => "batch",
                },
                format_proposal_status(&c.status),
                c.proposal_lamports,
                c.transaction_lamports
            );
        }
        println!();

        if dry_run {
            println!("{}", "Dry run: no transactions sent.".green());
            return Ok(());
        }

        let payer = fee_payer.unwrap_or(transaction_creator);

        let mut ix_groups: Vec<Vec<Instruction>> = vec![];
        let mut current: Vec<Instruction> = vec![];

        for c in &closable {
            let proposal_pda = get_proposal_pda(&multisig, c.index, Some(&program_id));
            let transaction_pda = get_transaction_pda(&multisig, c.index, Some(&program_id));

            let ix = match c.kind {
                TxAccountKind::Vault => Instruction {
                    accounts: VaultTransactionAccountsCloseAccounts {
                        multisig,
                        proposal: proposal_pda.0,
                        rent_collector,
                        transaction: transaction_pda.0,
                        system_program: system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: VaultTransactionAccountsCloseData {}.data(),
                    program_id,
                },
                TxAccountKind::Config => Instruction {
                    accounts: ConfigTransactionAccountsCloseAccounts {
                        multisig,
                        proposal: proposal_pda.0,
                        rent_collector,
                        transaction: transaction_pda.0,
                        system_program: system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: ConfigTransactionAccountsCloseData {}.data(),
                    program_id,
                },
                TxAccountKind::Batch => Instruction {
                    accounts: BatchAccountsCloseAccounts {
                        multisig,
                        proposal: proposal_pda.0,
                        batch: transaction_pda.0,
                        rent_collector,
                        system_program: system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: BatchAccountsCloseData {}.data(),
                    program_id,
                },
            };

            if current.len() >= MAX_CLOSE_IX_PER_TX {
                ix_groups.push(current);
                current = vec![];
            }
            current.push(ix);
        }
        if !current.is_empty() {
            ix_groups.push(current);
        }

        println!(
            "{}",
            "👀 You're about to reclaim rent (one or more transactions). Review above.".yellow()
        );
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

        let progress = ProgressBar::new_spinner().with_message("Sending transactions…");
        progress.enable_steady_tick(Duration::from_millis(100));

        let mut signers = vec![&*transaction_creator_keypair];
        if let Some(ref fee_payer_kp) = fee_payer_keypair {
            signers.push(&**fee_payer_kp);
        }

        let priority = priority_fee_lamports.unwrap_or(DEFAULT_PRIORITY_FEE);

        for (gi, group) in ix_groups.iter().enumerate() {
            let mut instructions = vec![ComputeBudgetInstruction::set_compute_unit_price(priority)];
            instructions.extend(group.iter().cloned());

            let blockhash = rpc_client
                .get_latest_blockhash()
                .await
                .expect("Failed to get blockhash");

            let message = Message::try_compile(&payer, &instructions, &[], blockhash)
                .map_err(|e| eyre::eyre!("Message compile failed (batch {}): {}", gi + 1, e))?;

            let transaction =
                VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)
                    .map_err(|e| eyre::eyre!("Signing failed (batch {}): {}", gi + 1, e))?;

            let sig = send_and_confirm_transaction(&transaction, &rpc_client).await?;
            println!(
                "✅ Batch {} / {} — signature: {}",
                gi + 1,
                ix_groups.len(),
                sig.green()
            );
        }

        progress.finish_and_clear();
        println!("{}", "Done.".green());
        Ok(())
    }
}

fn format_proposal_status(status: &ProposalStatus) -> String {
    match status {
        ProposalStatus::Draft { timestamp } => format!("Draft(ts={})", timestamp),
        ProposalStatus::Active { timestamp } => format!("Active(ts={})", timestamp),
        ProposalStatus::Approved { timestamp } => format!("Approved(ts={})", timestamp),
        ProposalStatus::Rejected { timestamp } => format!("Rejected(ts={})", timestamp),
        ProposalStatus::Executed { timestamp } => format!("Executed(ts={})", timestamp),
        ProposalStatus::Cancelled { timestamp } => format!("Cancelled(ts={})", timestamp),
        #[allow(deprecated)]
        ProposalStatus::Executing => "Executing".to_string(),
        _ => "(unknown)".to_string(),
    }
}

fn can_close_vault_style(
    status: &ProposalStatus,
    multisig: &squads_multisig::state::Multisig,
    tx_index: u64,
) -> bool {
    let is_stale = tx_index <= multisig.stale_transaction_index;
    match status {
        ProposalStatus::Draft { .. } => is_stale,
        ProposalStatus::Active { .. } => is_stale,
        ProposalStatus::Approved { .. } => false,
        ProposalStatus::Rejected { .. } => true,
        ProposalStatus::Executed { .. } => true,
        ProposalStatus::Cancelled { .. } => true,
        #[allow(deprecated)]
        ProposalStatus::Executing => false,
        _ => false,
    }
}

fn can_close_config_style(
    status: &ProposalStatus,
    multisig: &squads_multisig::state::Multisig,
    tx_index: u64,
) -> bool {
    let is_stale = tx_index <= multisig.stale_transaction_index;
    match status {
        ProposalStatus::Draft { .. } => is_stale,
        ProposalStatus::Active { .. } => is_stale,
        ProposalStatus::Approved { .. } => is_stale,
        ProposalStatus::Rejected { .. } => true,
        ProposalStatus::Executed { .. } => true,
        ProposalStatus::Cancelled { .. } => true,
        #[allow(deprecated)]
        ProposalStatus::Executing => false,
        // The enum was declared #[non_exhaustive].
        // This program is frozen so this should be reachable
        _ => unreachable!("non_exhaustive enum variant. frozen program"),
    }
}

/// Whole SOL + fractional part without floating point (9 decimal places).
fn lamports_display_sol(lamports: u64) -> String {
    let whole = lamports / 1_000_000_000;
    let frac = lamports % 1_000_000_000;
    let frac_s = format!("{:09}", frac);
    let trimmed = frac_s.trim_end_matches('0');
    if trimmed.is_empty() {
        whole.to_string()
    } else {
        format!("{}.{}", whole, trimmed)
    }
}
