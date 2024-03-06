use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_program::instruction::AccountMeta;
use solana_sdk::address_lookup_table::AddressLookupTableAccount;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;
use squads_multisig::anchor_lang::{AccountDeserialize, InstructionData};
use squads_multisig::pda::{
    get_ephemeral_signer_pda, get_proposal_pda, get_transaction_pda, get_vault_pda,
};
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

    #[arg(long)]
    priority_fee_lamports: Option<u64>,

    #[arg(long)]
    compute_unit_limit: Option<u32>,
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

        let vault_pda = get_vault_pda(
            &multisig,
            deserialized_account_data.vault_index,
            Some(&program_id),
        );

        let transaction_message = deserialized_account_data.message;
        let remaining_account_metas = message_to_execute_account_metas(
            &rpc_client,
            transaction_message,
            deserialized_account_data.ephemeral_signer_bumps,
            &vault_pda.0,
            &transaction_pda.0,
            Some(&program_id),
        )
        .await;

        let mut vault_transaction_account_metas = VaultTransactionExecuteAccounts {
            member: transaction_creator,
            multisig,
            proposal: proposal_pda.0,
            transaction: transaction_pda.0,
        }
        .to_account_metas(Some(false));
        vault_transaction_account_metas.extend(remaining_account_metas.0);
        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let message = Message::try_compile(
            &transaction_creator,
            &[
                ComputeBudgetInstruction::set_compute_unit_limit(
                    compute_unit_limit.unwrap_or(200_000),
                ),
                ComputeBudgetInstruction::set_compute_unit_price(
                    priority_fee_lamports.unwrap_or(5000),
                ),
                Instruction {
                    accounts: vault_transaction_account_metas,
                    data: VaultTransactionExecuteData {}.data(),
                    program_id,
                },
            ],
            &remaining_account_metas.1.as_slice(),
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

pub async fn message_to_execute_account_metas(
    rpc_client: &RpcClient,
    message: VaultTransactionMessage,
    ephemeral_signer_bumps: Vec<u8>,
    vault_pda: &Pubkey,
    transaction_pda: &Pubkey,
    program_id: Option<&Pubkey>,
) -> (Vec<AccountMeta>, Vec<AddressLookupTableAccount>) {
    let mut account_metas = Vec::with_capacity(message.account_keys.len());

    let mut address_lookup_table_accounts: Vec<AddressLookupTableAccount> = Vec::new();

    let ephemeral_signer_pdas: Vec<Pubkey> = (0..ephemeral_signer_bumps.len())
        .map(|additional_signer_index| {
            let (pda, _bump_seed) = get_ephemeral_signer_pda(
                &transaction_pda,
                additional_signer_index as u8,
                program_id,
            );
            pda
        })
        .collect();

    let address_lookup_table_keys = message
        .address_table_lookups
        .iter()
        .map(|lookup| lookup.account_key)
        .collect::<Vec<_>>();

    for key in address_lookup_table_keys {
        let account_data = rpc_client.get_account(&key).await.unwrap().data;
        let lookup_table =
            solana_address_lookup_table_program::state::AddressLookupTable::deserialize(
                &account_data,
            )
            .unwrap();

        let address_lookup_table_account = AddressLookupTableAccount {
            addresses: lookup_table.addresses.to_vec(),
            key,
        };

        address_lookup_table_accounts.push(address_lookup_table_account);
        account_metas.push(AccountMeta::new(key, false));
    }

    for (account_index, account_key) in message.account_keys.iter().enumerate() {
        let is_writable =
            VaultTransactionMessage::is_static_writable_index(&message, account_index);
        let is_signer = VaultTransactionMessage::is_signer_index(&message, account_index)
            && !account_key.eq(&vault_pda)
            && !ephemeral_signer_pdas.contains(account_key);

        account_metas.push(AccountMeta {
            pubkey: *account_key,
            is_signer,
            is_writable,
        });
    }

    for lookup in &message.address_table_lookups {
        let lookup_table_account = address_lookup_table_accounts
            .iter()
            .find(|account| account.key == lookup.account_key)
            .unwrap();

        for &account_index in &lookup.writable_indexes {
            let account_index_usize = account_index as usize;

            let pubkey = lookup_table_account
                .addresses
                .get(account_index_usize)
                .unwrap();

            account_metas.push(AccountMeta::new(*pubkey, false));
        }

        for &account_index in &lookup.readonly_indexes {
            let account_index_usize = account_index as usize;

            let pubkey = lookup_table_account
                .addresses
                .get(account_index_usize)
                .unwrap();

            account_metas.push(AccountMeta::new_readonly(*pubkey, false));
        }
    }

    (account_metas, address_lookup_table_accounts)
}
