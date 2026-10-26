use std::str::FromStr;

use clap::Args;
use colored::Colorize;
use eyre::eyre;
use solana_address_lookup_table_interface::state::AddressLookupTable;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::bs58;
use solana_sdk::pubkey::Pubkey;
use squads_multisig_4r::rpc::decode_checked;
use squads_multisig_4r::state::{
    MultisigMessageAddressTableLookup, VaultTransaction, VaultTransactionMessage,
};

use crate::utils::{is_signer_index, is_static_writable_index};

/// Fetch a vault transaction account and display its decoded instructions, accounts, and address lookup tables.
#[derive(Args)]
pub struct DisplayTransaction {
    /// RPC URL (default: https://api.mainnet-beta.solana.com)
    #[arg(long)]
    rpc_url: Option<String>,

    /// The VaultTransaction account address to inspect
    #[arg(long)]
    transaction_address: String,
}

#[derive(Debug, Clone, PartialEq)]
struct AccountEntry {
    pubkey: Pubkey,
    is_writable: bool,
    is_signer: bool,
}

/// The addresses one lookup table loads, in its `writable_indexes` and `readonly_indexes` order.
#[derive(Debug, Clone, PartialEq)]
struct ResolvedLookup {
    account_key: Pubkey,
    writable: Vec<Pubkey>,
    readonly: Vec<Pubkey>,
}

fn resolve_lookup(
    lookup: &MultisigMessageAddressTableLookup,
    addresses: &[Pubkey],
) -> eyre::Result<ResolvedLookup> {
    let resolve = |indexes: &[u8]| {
        indexes
            .iter()
            .map(|&idx| {
                addresses.get(usize::from(idx)).copied().ok_or_else(|| {
                    eyre!(
                        "Index {idx} is out of range for lookup table {}",
                        lookup.account_key
                    )
                })
            })
            .collect::<eyre::Result<Vec<_>>>()
    };
    Ok(ResolvedLookup {
        account_key: lookup.account_key,
        writable: resolve(&lookup.writable_indexes)?,
        readonly: resolve(&lookup.readonly_indexes)?,
    })
}

/// The account list that instruction indexes point into: static keys, then the writable
/// addresses of all lookups, then the readonly addresses of all lookups. The program resolves
/// indexes in this order at execution.
fn message_accounts(
    message: &VaultTransactionMessage,
    lookups: &[ResolvedLookup],
) -> Vec<AccountEntry> {
    let static_accounts = message
        .account_keys
        .iter()
        .enumerate()
        .map(|(i, key)| AccountEntry {
            pubkey: *key,
            is_writable: is_static_writable_index(message, i),
            is_signer: is_signer_index(message, i),
        });
    let loaded = |is_writable: bool| {
        lookups
            .iter()
            .flat_map(move |lookup| match is_writable {
                true => &lookup.writable,
                false => &lookup.readonly,
            })
            .map(move |pubkey| AccountEntry {
                pubkey: *pubkey,
                is_writable,
                is_signer: false,
            })
    };
    static_accounts
        .chain(loaded(true))
        .chain(loaded(false))
        .collect()
}

impl DisplayTransaction {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc_url = self
            .rpc_url
            .unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let transaction_address = Pubkey::from_str(&self.transaction_address)?;

        let rpc_client = RpcClient::new(rpc_url);

        let account = match rpc_client.get_account(&transaction_address).await {
            Ok(account) => account,
            Err(_) => {
                println!("Account closed or not found.");
                return Ok(());
            }
        };

        let vault_tx = decode_checked::<VaultTransaction>(
            &transaction_address,
            &account,
            Some(&squads_multisig_4r::ID),
        )?;

        println!();
        println!("{}", "Transaction Details".bold());
        println!("  Address:     {}", transaction_address);
        println!("  Multisig:    {}", vault_tx.multisig);
        println!("  Creator:     {}", vault_tx.creator);
        println!("  Index:       {}", vault_tx.index);
        println!("  Vault Index: {}", vault_tx.vault_index);
        println!();

        let message = &vault_tx.message;

        let mut lookups = Vec::with_capacity(message.address_table_lookups.len());
        for lookup in &message.address_table_lookups {
            let alt_data = rpc_client.get_account(&lookup.account_key).await?.data;
            let alt = AddressLookupTable::deserialize(&alt_data)?;
            lookups.push(resolve_lookup(lookup, &alt.addresses)?);
        }

        let all_accounts = message_accounts(message, &lookups);

        // Print each instruction.
        println!(
            "{}",
            format!("Instructions ({})", message.instructions.len()).bold()
        );
        println!();

        for (i, ix) in message.instructions.iter().enumerate() {
            let program_pubkey = all_accounts[ix.program_id_index as usize].pubkey;

            println!("{}", format!("Instruction {}", i + 1).yellow().bold());
            println!("  Program: {}", program_pubkey);

            if !ix.account_indexes.is_empty() {
                println!("  Accounts:");
                for (j, &idx) in ix.account_indexes.iter().enumerate() {
                    let acc = &all_accounts[idx as usize];
                    let flags = match (acc.is_writable, acc.is_signer) {
                        (true, true) => " [writable, signer]".cyan().to_string(),
                        (true, false) => " [writable]".cyan().to_string(),
                        (false, true) => " [signer]".cyan().to_string(),
                        (false, false) => String::new(),
                    };
                    println!("    {}: {}{}", j + 1, acc.pubkey, flags);
                }
            }

            if !ix.data.is_empty() {
                println!("  Data: {}", bs58::encode(&ix.data).into_string());
            }

            println!();
        }

        // Print ALT summary if any were used.
        if !lookups.is_empty() {
            println!("{}", "Address Lookup Tables".bold());
            for lookup in &lookups {
                println!("  {}", lookup.account_key);
                if !lookup.writable.is_empty() {
                    println!("    Writable:");
                    for pk in &lookup.writable {
                        println!("      {}", pk);
                    }
                }
                if !lookup.readonly.is_empty() {
                    println!("    Readonly:");
                    for pk in &lookup.readonly {
                        println!("      {}", pk);
                    }
                }
            }
            println!();
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lookup(writable: Vec<Pubkey>, readonly: Vec<Pubkey>) -> ResolvedLookup {
        ResolvedLookup {
            account_key: Pubkey::new_unique(),
            writable,
            readonly,
        }
    }

    #[test]
    fn orders_loaded_accounts_writable_first_across_all_lookups() {
        let vault = Pubkey::new_unique();
        let message = VaultTransactionMessage {
            num_signers: 1,
            num_writable_signers: 1,
            num_writable_non_signers: 0,
            account_keys: vec![vault],
            instructions: vec![],
            address_table_lookups: vec![],
        };
        let (readonly_1, writable_2, readonly_2) = (
            Pubkey::new_unique(),
            Pubkey::new_unique(),
            Pubkey::new_unique(),
        );
        let lookups = [
            lookup(vec![], vec![readonly_1]),
            lookup(vec![writable_2], vec![readonly_2]),
        ];

        let accounts = message_accounts(&message, &lookups);

        let entry = |pubkey, is_writable, is_signer| AccountEntry {
            pubkey,
            is_writable,
            is_signer,
        };
        assert_eq!(
            accounts,
            [
                entry(vault, true, true),
                entry(writable_2, true, false),
                entry(readonly_1, false, false),
                entry(readonly_2, false, false),
            ]
        );
    }

    #[test]
    fn rejects_lookup_index_out_of_range() {
        let table = MultisigMessageAddressTableLookup {
            account_key: Pubkey::new_unique(),
            writable_indexes: vec![1],
            readonly_indexes: vec![],
        };

        let result = resolve_lookup(&table, &[Pubkey::new_unique()]);

        assert!(result.is_err());
    }
}
