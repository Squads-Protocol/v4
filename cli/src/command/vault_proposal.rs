//! Shared plumbing for commands that propose a single vault transaction
//! (`vote <op>`): common flags, vault lookup, a preflight simulation of the
//! inner instructions, review and send.

use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_sdk::account::Account;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::hash::hash;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signature::Signature;
use solana_sdk::signer::Signer;
use solana_sdk::transaction::VersionedTransaction;

use squads_multisig::anchor_lang::{AnchorSerialize, InstructionData};
use squads_multisig::client::get_multisig;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda, get_vault_pda};
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::solana_rpc_client_api::config::RpcSimulateTransactionConfig;
use squads_multisig::squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
use squads_multisig::squads_multisig_program::accounts::ProposalVote as ProposalVoteAccounts;
use squads_multisig::squads_multisig_program::accounts::VaultTransactionCreate as VaultTransactionCreateAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::ProposalApprove;
use squads_multisig::squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
use squads_multisig::squads_multisig_program::instruction::VaultTransactionCreate as VaultTransactionCreateData;
use squads_multisig::squads_multisig_program::ProposalCreateArgs;
use squads_multisig::squads_multisig_program::ProposalVoteArgs;
use squads_multisig::squads_multisig_program::TransactionMessage;
use squads_multisig::squads_multisig_program::VaultTransactionCreateArgs;
use squads_multisig::state::Permission;
use squads_multisig::vault_transaction::VaultTransactionMessageExt;

use crate::command::instruction_decode::MultisigVaults;
use crate::command::transfer_common::{format_token_amount, parse_pubkey};
use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

const DEFAULT_PROGRAM_ID: &str = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf";
const DEFAULT_RPC_URL: &str = "https://api.mainnet-beta.solana.com";

/// Flags shared by every command that proposes a vault transaction.
#[derive(Args)]
pub struct ProposalArgs {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the proposer's keypair (or usb://ledger)
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    /// The multisig that controls the vault
    #[arg(long)]
    multisig_pubkey: String,

    /// Index of the vault that holds the authority
    #[arg(long)]
    vault_index: u8,

    /// Memo to be included in the transaction
    #[arg(long)]
    memo: Option<String>,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,

    /// Approve the proposal atomically in the same transaction.
    /// Note: This only works if the proposer has Vote permission.
    #[arg(long)]
    approve: bool,
}

/// What a command wants proposed, built against a [`ProposalContext`].
pub struct Proposal {
    /// One line describing the operation, e.g. "withdraw from a vote account".
    pub action: String,
    /// `(label, value)` rows printed in the review.
    pub details: Vec<(String, String)>,
    /// Instructions executed by the vault.
    pub instructions: Vec<Instruction>,
    /// Number of ephemeral signer PDAs the instructions use.
    pub ephemeral_signers: u8,
    /// Shown in red; each one needs an extra explicit confirmation.
    pub warnings: Vec<String>,
    /// Printed after the proposal is created.
    pub next_steps: Option<String>,
}

pub struct ProposalContext {
    pub rpc_client: RpcClient,
    pub program_id: Pubkey,
    pub multisig: Pubkey,
    pub vault_index: u8,
    pub vault: Pubkey,
    pub vaults: MultisigVaults,
    transaction_index: u64,
    transaction_pda: Pubkey,
    rpc_url: String,
    creator: Box<dyn Signer>,
    fee_payer: Option<Box<dyn Signer>>,
    memo: Option<String>,
    priority_fee_lamports: Option<u64>,
    approve: bool,
}

impl ProposalArgs {
    pub async fn into_context(self) -> eyre::Result<ProposalContext> {
        let program_id = parse_pubkey(
            "program ID",
            &self
                .program_id
                .unwrap_or_else(|| DEFAULT_PROGRAM_ID.to_string()),
        )?;
        let multisig = parse_pubkey("multisig", &self.multisig_pubkey)?;

        let creator = create_signer_from_path(self.keypair)
            .map_err(|e| eyre::eyre!("Failed to load keypair: {}", e))?;
        let fee_payer = self
            .fee_payer_keypair
            .map(create_signer_from_path)
            .transpose()
            .map_err(|e| eyre::eyre!("Failed to load fee payer keypair: {}", e))?;

        let rpc_url = self.rpc_url.unwrap_or_else(|| DEFAULT_RPC_URL.to_string());
        let rpc_client = RpcClient::new(rpc_url.clone());

        let multisig_data = get_multisig(&rpc_client, &multisig).await?;

        if self.approve {
            let has_vote_permission = multisig_data
                .members
                .iter()
                .any(|m| m.key == creator.pubkey() && m.permissions.has(Permission::Vote));
            if !has_vote_permission {
                return Err(eyre::eyre!(
                    "Cannot use --approve: {} does not have Vote permission in this multisig",
                    creator.pubkey()
                ));
            }
        }

        let transaction_index = multisig_data.transaction_index + 1;
        let transaction_pda =
            get_transaction_pda(&multisig, transaction_index, Some(&program_id)).0;
        let vault = get_vault_pda(&multisig, self.vault_index, Some(&program_id)).0;

        Ok(ProposalContext {
            rpc_client,
            program_id,
            multisig,
            vault_index: self.vault_index,
            vault,
            vaults: MultisigVaults::new(&multisig, &program_id),
            transaction_index,
            transaction_pda,
            rpc_url,
            creator,
            fee_payer,
            memo: self.memo,
            priority_fee_lamports: self.priority_fee_lamports,
            approve: self.approve,
        })
    }
}

impl ProposalContext {
    /// The account at `key`, or `None` if it does not exist. RPC failures are errors.
    pub async fn get_account(&self, key: &Pubkey) -> eyre::Result<Option<Account>> {
        Ok(self
            .rpc_client
            .get_account_with_commitment(key, self.rpc_client.commitment())
            .await?
            .value)
    }

    fn payer(&self) -> Pubkey {
        self.fee_payer
            .as_ref()
            .map(|kp| kp.pubkey())
            .unwrap_or_else(|| self.creator.pubkey())
    }

    /// Simulates the inner instructions as if the vault (and ephemeral signers) signed them.
    /// Returns `None` on success, or the error and logs.
    async fn simulate(&self, instructions: &[Instruction]) -> eyre::Result<Option<String>> {
        let blockhash = self.rpc_client.get_latest_blockhash().await?;
        let message = Message::try_compile(&self.payer(), instructions, &[], blockhash)?;
        let transaction = VersionedTransaction {
            signatures: vec![Signature::default(); message.header.num_required_signatures as usize],
            message: VersionedMessage::V0(message),
        };
        let result = self
            .rpc_client
            .simulate_transaction_with_config(
                &transaction,
                RpcSimulateTransactionConfig {
                    sig_verify: false,
                    replace_recent_blockhash: true,
                    ..Default::default()
                },
            )
            .await?
            .value;
        Ok(result.err.map(|err| {
            let logs = result.logs.unwrap_or_default().join("\n");
            format!("{}\n\n{}", err, logs)
        }))
    }

    pub async fn propose(&self, proposal: Proposal) -> eyre::Result<()> {
        let Proposal {
            action,
            details,
            instructions: inner_instructions,
            ephemeral_signers,
            warnings,
            next_steps,
        } = proposal;

        let simulation_error = self.simulate(&inner_instructions).await?;

        let vault_message = TransactionMessage::try_compile(&self.vault, &inner_instructions, &[])
            .map_err(|e| eyre::eyre!("Failed to compile vault inner message: {}", e))?;

        let creator = self.creator.pubkey();
        let payer = self.payer();
        let proposal_pda = get_proposal_pda(
            &self.multisig,
            self.transaction_index,
            Some(&self.program_id),
        )
        .0;

        let mut instructions = vec![
            ComputeBudgetInstruction::set_compute_unit_price(
                self.priority_fee_lamports.unwrap_or(200_000),
            ),
            Instruction {
                accounts: VaultTransactionCreateAccounts {
                    creator,
                    rent_payer: payer,
                    transaction: self.transaction_pda,
                    multisig: self.multisig,
                    system_program: solana_sdk::system_program::id(),
                }
                .to_account_metas(Some(false)),
                data: VaultTransactionCreateData {
                    args: VaultTransactionCreateArgs {
                        ephemeral_signers,
                        vault_index: self.vault_index,
                        memo: self.memo.clone(),
                        transaction_message: vault_message.try_to_vec()?,
                    },
                }
                .data(),
                program_id: self.program_id,
            },
            Instruction {
                accounts: ProposalCreateAccounts {
                    creator,
                    rent_payer: payer,
                    proposal: proposal_pda,
                    multisig: self.multisig,
                    system_program: solana_sdk::system_program::id(),
                }
                .to_account_metas(Some(false)),
                data: ProposalCreateData {
                    args: ProposalCreateArgs {
                        draft: false,
                        transaction_index: self.transaction_index,
                    },
                }
                .data(),
                program_id: self.program_id,
            },
        ];

        if self.approve {
            instructions.push(Instruction {
                accounts: ProposalVoteAccounts {
                    member: creator,
                    multisig: self.multisig,
                    proposal: proposal_pda,
                }
                .to_account_metas(Some(false)),
                data: ProposalApprove {
                    args: ProposalVoteArgs {
                        memo: self.memo.clone(),
                    },
                }
                .data(),
                program_id: self.program_id,
            });
        }

        let blockhash = self.rpc_client.get_latest_blockhash().await?;
        let message = Message::try_compile(&payer, &instructions, &[], blockhash)?;
        let message_hash = hash(&message.serialize());

        println!();
        println!(
            "{}",
            format!(
                "👀 You're about to propose: {}. Please review the details:",
                action
            )
            .yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", self.rpc_url);
        println!("Program ID:        {}", self.program_id);
        println!("Your Public Key:       {}", creator);
        println!();
        println!("⚙️ Config Parameters");
        println!("Multisig Key:       {}", self.multisig);
        println!("Transaction Index:       {}", self.transaction_index);
        println!("Transaction Address:       {}", self.transaction_pda);
        println!("Vault Index:       {}", self.vault_index);
        println!("Vault:       {}", self.vault);
        println!();
        for (label, value) in &details {
            println!("{}:       {}", label, value);
        }
        println!("Auto-approve:       {}", self.approve);
        println!();

        match &simulation_error {
            Some(error) => {
                println!(
                    "{}",
                    "⚠️  Simulating the vault instructions failed. The proposal may still execute \
                     later (e.g. once a stake account has deactivated, or in the next epoch), but \
                     check the error below:"
                        .yellow()
                );
                println!("{}", error.yellow());
            }
            None => println!(
                "{}",
                "✅ Simulation of the vault instructions succeeded.".green()
            ),
        }
        println!();
        println!("Message Hash (verify on hardware wallet): {}", message_hash);
        println!();

        if simulation_error.is_some() && !confirm("Simulation failed. Propose anyway?")? {
            println!("OK, aborting.");
            return Ok(());
        }

        for warning in &warnings {
            println!("{}", format!("⚠️  {}", warning).red().bold());
            println!();
            if !confirm("Are you sure you want to propose this?")? {
                println!("OK, aborting.");
                return Ok(());
            }
        }

        if !confirm("Do you want to proceed?")? {
            println!("OK, aborting.");
            return Ok(());
        }
        println!();

        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let mut signers = vec![&*self.creator];
        if let Some(ref fee_payer) = self.fee_payer {
            signers.push(&**fee_payer);
        }

        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)?;

        let signature = send_and_confirm_transaction(&transaction, &self.rpc_client).await?;
        progress.finish_and_clear();

        if self.approve {
            println!(
                "✅ Transaction created and approved. Signature: {}",
                signature.green()
            );
        } else {
            println!(
                "✅ Transaction created successfully. Signature: {}",
                signature.green()
            );
        }
        println!("Transaction Index: {}", self.transaction_index);
        println!(
            "Transaction Address: {} (inspect it with display-transaction)",
            self.transaction_pda
        );
        if let Some(next_steps) = next_steps {
            println!();
            println!("{}", next_steps.yellow());
        }
        Ok(())
    }
}

fn confirm(prompt: &str) -> eyre::Result<bool> {
    Ok(Confirm::new()
        .with_prompt(prompt)
        .default(false)
        .interact()?)
}

/// Parses a SOL amount ("1", "0.5", "12.000000001") into lamports, without floating point.
pub fn parse_sol(s: &str) -> eyre::Result<u64> {
    let invalid = || eyre::eyre!("Invalid SOL amount: {:?}", s);
    let (whole, fraction) = s.split_once('.').unwrap_or((s, ""));
    if whole.is_empty() && fraction.is_empty()
        || fraction.len() > 9
        || !whole.chars().all(|c| c.is_ascii_digit())
        || !fraction.chars().all(|c| c.is_ascii_digit())
    {
        return Err(invalid());
    }
    let whole: u64 = if whole.is_empty() {
        0
    } else {
        whole.parse().map_err(|_| invalid())?
    };
    let fraction: u64 = format!("{:0<9}", fraction).parse().map_err(|_| invalid())?;
    whole
        .checked_mul(1_000_000_000)
        .and_then(|l| l.checked_add(fraction))
        .ok_or_else(invalid)
}

pub fn format_sol(lamports: u64) -> String {
    let amount = format_token_amount(lamports, 9);
    // format_token_amount keeps trailing zeros below 1 ("0.500000000").
    let amount = if amount.contains('.') {
        amount.trim_end_matches('0').trim_end_matches('.')
    } else {
        &amount
    };
    format!("{} SOL", amount)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_sol_is_exact() {
        assert_eq!(parse_sol("1").unwrap(), 1_000_000_000);
        assert_eq!(parse_sol("0.5").unwrap(), 500_000_000);
        assert_eq!(parse_sol(".5").unwrap(), 500_000_000);
        assert_eq!(parse_sol("12.000000001").unwrap(), 12_000_000_001);
        assert_eq!(parse_sol("0.1").unwrap(), 100_000_000);
    }

    #[test]
    fn format_sol_trims_trailing_zeros() {
        assert_eq!(format_sol(0), "0 SOL");
        assert_eq!(format_sol(27_074_400), "0.0270744 SOL");
        assert_eq!(format_sol(500_000_000), "0.5 SOL");
        assert_eq!(format_sol(1_000_000_000), "1 SOL");
        assert_eq!(format_sol(1_250_000_000), "1.25 SOL");
    }

    #[test]
    fn parse_sol_rejects_bad_input() {
        for s in [
            "",
            ".",
            "1.0000000001",
            "-1",
            "1e9",
            "1,5",
            "abc",
            "18446744074",
        ] {
            assert!(parse_sol(s).is_err(), "{:?} should be rejected", s);
        }
    }
}
