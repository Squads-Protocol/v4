use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::hash::hash;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;

use squads_multisig::anchor_lang::InstructionData;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
use squads_multisig::squads_multisig_program::accounts::ProposalVote as ProposalVoteAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::ProposalApprove;
use squads_multisig::squads_multisig_program::instruction::ProposalCancel;
use squads_multisig::squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
use squads_multisig::squads_multisig_program::instruction::ProposalReject;
use squads_multisig::squads_multisig_program::{ProposalCreateArgs, ProposalVoteArgs};

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

/// Cast an approve or reject vote on an existing proposal.
#[derive(Args)]
pub struct ProposalVote {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the Program Config Initializer Keypair
    #[arg(long)]
    keypair: String,

    /// Index of the transaction to vote on
    #[arg(long)]
    transaction_index: u64,

    /// The multisig where the transaction has been proposed
    #[arg(long)]
    multisig_pubkey: String,

    /// Vote action to cast
    #[arg(long)]
    action: String,

    /// Transaction Memo
    #[arg(long)]
    memo: Option<String>,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,
}

impl ProposalVote {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
            transaction_index,
            action,
            memo,
            priority_fee_lamports,
            fee_payer_keypair,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let transaction_creator_keypair = create_signer_from_path(keypair).unwrap();

        let transaction_creator = transaction_creator_keypair.pubkey();

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());

        let fee_payer_keypair = fee_payer_keypair.map(|path| create_signer_from_path(path).unwrap());
        let fee_payer = fee_payer_keypair.as_ref().map(|kp| kp.pubkey());

        // Build the message first so we can show the hash before confirmation
        let rpc_client = RpcClient::new(rpc_url.clone());

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let action_lower = action.to_lowercase();
        let data = match action_lower.as_str() {
            "approve" | "ap" => ProposalApprove {
                args: ProposalVoteArgs { memo },
            }
            .data(),
            "reject" | "rj" => ProposalReject {
                args: ProposalVoteArgs { memo },
            }
            .data(),
            "cancel" | "cl" => ProposalCancel {
                args: ProposalVoteArgs { memo },
            }
            .data(),
            _ => {
                eprintln!("Invalid action. Please use one of: Approve, Reject, Cancel, Activate (or their short forms)");
                std::process::exit(1);
            }
        };

        let should_create_proposal =
            matches!(action_lower.as_str(), "approve" | "ap" | "reject" | "rj") && {
                let transaction_pda =
                    get_transaction_pda(&multisig, transaction_index, Some(&program_id));
                let accounts = rpc_client
                    .get_multiple_accounts(&[transaction_pda.0, proposal_pda.0])
                    .await?;
                let transaction_exists = accounts.first().and_then(|a| a.as_ref()).is_some();
                let proposal_exists = accounts.get(1).and_then(|a| a.as_ref()).is_some();
                transaction_exists && !proposal_exists
            };

        let payer = fee_payer.unwrap_or(transaction_creator);

        let mut instructions = vec![ComputeBudgetInstruction::set_compute_unit_price(
            priority_fee_lamports.unwrap_or(5000),
        )];

        if should_create_proposal {
            instructions.push(Instruction {
                accounts: ProposalCreateAccounts {
                    creator: transaction_creator,
                    rent_payer: payer,
                    proposal: proposal_pda.0,
                    multisig,
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
            });
        }

        instructions.push(Instruction {
            accounts: ProposalVoteAccounts {
                member: transaction_creator,
                multisig,
                proposal: proposal_pda.0,
            }
            .to_account_metas(Some(false)),
            data,
            program_id,
        });

        let message = Message::try_compile(
            &payer,
            &instructions,
            &[],
            blockhash,
        )
        .unwrap();
        let message_hash = hash(&message.serialize());

        println!();
        println!(
            "{}",
            "👀 You're about to vote on a proposal, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url);
        println!("Program ID:        {}", program_id);
        println!("Your Public Key:       {}", transaction_creator);
        println!();
        println!("⚙️ Config Parameters");
        println!("Multisig Key:       {}", multisig_pubkey);
        println!("Transaction Index:       {}", transaction_index);
        println!("Vote Type:       {}", action);
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

        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let mut signers = vec![&*transaction_creator_keypair];
        if let Some(ref fee_payer_kp) = fee_payer_keypair {
            signers.push(&**fee_payer_kp);
        }

        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)
            .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, &rpc_client).await?;

        println!(
            "✅ Casted {} vote. Signature: {}",
            action,
            signature.green()
        );
        Ok(())
    }
}
