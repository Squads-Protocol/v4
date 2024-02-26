use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_program::instruction::AccountMeta;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use squads_multisig::anchor_lang::{AccountDeserialize, InstructionData};
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig::solana_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::squads_multisig_program::accounts::VaultTransactionExecute as VaultTransactionExecuteAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::VaultTransactionExecute as VaultTransactionExecuteData;
use squads_multisig::squads_multisig_program::state::VaultTransaction;
use squads_multisig::state::VaultTransactionMessage;
use std::str::FromStr;
use std::time::Duration;

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

#[derive(Args)]
pub struct VaultTransactionExecute {
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
}

impl VaultTransactionExecute {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
            transaction_index,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let transaction_creator_keypair = create_signer_from_path(keypair).unwrap();

        let transaction_creator = transaction_creator_keypair.pubkey();

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());

        println!();
        println!(
            "{}",
            "👀 You're about to execute a vault transaction, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url);
        println!("Program ID:        {}", program_id);
        println!("Your Public Key:       {}", transaction_creator);
        println!();
        println!("⚙️ Config Parameters");
        println!("Multisig Key:       {}", multisig_pubkey);
        println!("Transaction Index:       {}", transaction_index);
        println!("Vote Type:       {}", transaction_index);
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

        let transaction_account_data = rpc_client
            .get_account(&transaction_pda.0)
            .await
            .expect("Failed to get transaction account")
            .data;

        let mut transaction_account_data_slice = transaction_account_data.as_slice();

        let deserialized_account_data =
            VaultTransaction::try_deserialize(&mut transaction_account_data_slice).unwrap();

        let transaction_message = deserialized_account_data.message;
        let remaining_account_metas = message_to_execute_account_metas(transaction_message);
        let mut vault_transaction_account_metas = VaultTransactionExecuteAccounts {
            member: transaction_creator,
            multisig,
            proposal: proposal_pda.0,
            transaction: transaction_pda.0,
        }
        .to_account_metas(Some(false));
        vault_transaction_account_metas.extend(remaining_account_metas);
        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let message = Message::try_compile(
            &transaction_creator,
            &[Instruction {
                accounts: vault_transaction_account_metas,
                data: VaultTransactionExecuteData {}.data(),
                program_id,
            }],
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
            "✅ Executed Vault Transaction. Signature: {}",
            signature.green()
        );
        Ok(())
    }
}

pub fn message_to_execute_account_metas(message: VaultTransactionMessage) -> Vec<AccountMeta> {
    let mut account_metas = Vec::with_capacity(message.account_keys.len());

    // Iterate over account_keys and set the properties based on the index
    for (index, pubkey) in message.account_keys.iter().enumerate() {
        let is_signer = index < message.num_signers as usize;
        let is_writable = if is_signer {
            index < message.num_writable_signers as usize
        } else {
            index < (message.num_signers as usize + message.num_writable_non_signers as usize)
        };

        account_metas.push(AccountMeta {
            pubkey: *pubkey,
            is_signer,
            is_writable,
        });
    }

    account_metas
}
