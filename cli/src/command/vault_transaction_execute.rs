use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use eyre::eyre;
use indicatif::ProgressBar;
use solana_address_lookup_table_interface::state::AddressLookupTable;
use solana_compute_budget_interface::ComputeBudgetInstruction;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::message::v0::Message;
use solana_sdk::message::AddressLookupTableAccount;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use squads_multisig_4r::builders::VaultTransactionExecute as VaultTransactionExecuteAccounts;
use squads_multisig_4r::message::{
    vault_transaction_execute, AddressLookupTableAccount as VaultLookupTable,
};
use squads_multisig_4r::pda::{get_proposal_pda, get_transaction_pda};
use squads_multisig_4r::rpc::decode_checked;
use squads_multisig_4r::state::{VaultTransaction, VaultTransactionMessage};

use crate::utils::{send_and_confirm_transaction, signer_from_path};

/// Execute an approved vault transaction on-chain.
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

    #[arg(long)]
    priority_fee_lamports: Option<u64>,

    #[arg(long)]
    compute_unit_limit: Option<u32>,

    #[arg(long)]
    extra_keypair: Option<String>,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,
}

impl VaultTransactionExecute {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            keypair,
            multisig_pubkey,
            transaction_index,
            priority_fee_lamports,
            compute_unit_limit,
            extra_keypair,
            fee_payer_keypair,
        } = self;

        let program_id = program_id.unwrap_or_else(|| squads_multisig_4r::ID.to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let transaction_creator_keypair = signer_from_path(&keypair)?;

        let transaction_creator = transaction_creator_keypair.pubkey();

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());

        let transaction_extra_signer_keypair = extra_keypair
            .map(|path| signer_from_path(&path))
            .transpose()?;

        let fee_payer_keypair = fee_payer_keypair
            .map(|path| signer_from_path(&path))
            .transpose()?;
        let fee_payer = fee_payer_keypair.as_ref().map(|kp| kp.pubkey());

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

        let transaction_account = rpc_client
            .get_account(&transaction_pda.0)
            .await
            .map_err(|e| eyre!("Failed to get transaction account: {e}"))?;

        let vault_transaction = decode_checked::<VaultTransaction>(
            &transaction_pda.0,
            &transaction_account,
            Some(&program_id),
        )?;

        let address_lookup_table_accounts =
            fetch_address_lookup_tables(&rpc_client, &vault_transaction.message).await?;
        let vault_lookup_tables: Vec<VaultLookupTable> = address_lookup_table_accounts
            .iter()
            .map(|table| VaultLookupTable {
                key: table.key,
                addresses: table.addresses.clone(),
            })
            .collect();

        let execute_instruction = vault_transaction_execute(
            &VaultTransactionExecuteAccounts {
                multisig,
                proposal: proposal_pda.0,
                transaction: transaction_pda.0,
                member: transaction_creator,
            },
            vault_transaction.vault_index,
            u8::try_from(vault_transaction.ephemeral_signer_bumps.len())?,
            &vault_transaction.message,
            &vault_lookup_tables,
            Some(&program_id),
        )?;
        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let payer = fee_payer.unwrap_or(transaction_creator);

        let message = Message::try_compile(
            &payer,
            &[
                ComputeBudgetInstruction::set_compute_unit_limit(
                    compute_unit_limit.unwrap_or(200_000),
                ),
                ComputeBudgetInstruction::set_compute_unit_price(
                    priority_fee_lamports.unwrap_or(5000),
                ),
                execute_instruction,
            ],
            &address_lookup_table_accounts,
            blockhash,
        )
        .unwrap();

        let mut signers = vec![&*transaction_creator_keypair];
        if let Some(ref fee_payer_kp) = fee_payer_keypair {
            signers.push(&**fee_payer_kp);
        }
        if let Some(ref extra_signer) = transaction_extra_signer_keypair {
            signers.push(&**extra_signer);
        }

        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)
            .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, &rpc_client).await?;

        println!(
            "✅ Executed Vault Transaction. Signature: {}",
            signature.green()
        );
        Ok(())
    }
}

async fn fetch_address_lookup_tables(
    rpc_client: &RpcClient,
    message: &VaultTransactionMessage,
) -> eyre::Result<Vec<AddressLookupTableAccount>> {
    let mut tables = Vec::with_capacity(message.address_table_lookups.len());
    for lookup in &message.address_table_lookups {
        let key = lookup.account_key;
        let data = rpc_client.get_account(&key).await?.data;
        let table = AddressLookupTable::deserialize(&data)
            .map_err(|e| eyre!("Invalid address lookup table {key}: {e}"))?;
        tables.push(AddressLookupTableAccount {
            key,
            addresses: table.addresses.to_vec(),
        });
    }
    Ok(tables)
}
