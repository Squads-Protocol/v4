use std::collections::HashMap;

use futures::future::try_join_all;
use solana_address_lookup_table_program::state::AddressLookupTable;
use solana_client::nonblocking::rpc_client::RpcClient;

use squads_multisig_program::VaultTransactionMessage;
pub use vault_transaction_message::*;

use crate::anchor_lang::prelude::AccountMeta;
use crate::pda::get_ephemeral_signer_pda;
use crate::solana_program::address_lookup_table_account::AddressLookupTableAccount;
use crate::solana_program::pubkey::Pubkey;

mod compiled_keys;
mod vault_transaction_message;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Failed to load account")]
    FailedToLoadAccount,
}

/// Account metas and lookup table accounts required for execution of a vault transaction.
pub(crate) struct AccountsForExecute {
    // lookupTableAccounts: AddressLookupTableAccount[];
    /// Account metas used in the `message`.
    pub account_metas: Vec<AccountMeta>,

    /// Address lookup table accounts used in the `message`.
    pub lookup_table_accounts: Vec<AddressLookupTableAccount>,
}

impl AccountsForExecute {
    pub async fn load(
        rpc_client: &RpcClient,
        vault_pda: &Pubkey,
        transaction_pda: &Pubkey,
        message: &VaultTransactionMessage,
        ephemeral_signer_bumps: &[u8],
        program_id: &Pubkey,
    ) -> Result<Self, Error> {
        let ephemeral_signer_pdas: Vec<Pubkey> = ephemeral_signer_bumps
            .iter()
            .enumerate()
            .map(|(_, ephemeral_signer_index)| {
                get_ephemeral_signer_pda(transaction_pda, *ephemeral_signer_index, Some(program_id))
                    .0
            })
            .collect();

        // region: -- address_lookup_table_accounts --

        let address_lookup_table_keys: Vec<Pubkey> = message
            .address_table_lookups
            .iter()
            .map(|lookup| lookup.account_key)
            .collect();

        let address_lookup_table_account_futures = address_lookup_table_keys
            .iter()
            .map(|key| async {
                let alt_account_data = rpc_client
                    .get_account_data(key)
                    .await
                    .map_err(|_| Error::FailedToLoadAccount)?;

                let alt = AddressLookupTable::deserialize(&alt_account_data)
                    .map_err(|_| Error::FailedToLoadAccount)?;

                Ok::<_, Error>((
                    key.to_owned(),
                    AddressLookupTableAccount {
                        key: key.to_owned(),
                        addresses: alt.addresses.into(),
                    },
                ))
            })
            .collect::<Vec<_>>();

        let address_lookup_table_accounts: HashMap<Pubkey, AddressLookupTableAccount> =
            try_join_all(address_lookup_table_account_futures)
                .await?
                .into_iter()
                .collect();

        // endregion: -- address_lookup_table_accounts --

        // region: -- Account Metas --

        // First go the lookup table accounts used by the transaction. They are needed for on-chain validation.
        let lookup_table_account_metas = address_lookup_table_keys
            .into_iter()
            .map(|pubkey| AccountMeta {
                pubkey,
                is_writable: false,
                is_signer: false,
            })
            .collect::<Vec<_>>();

        // Then come static account keys included into the message.
        let static_account_metas = message
            .account_keys
            .iter()
            .enumerate()
            .map(|(index, &pubkey)| {
                AccountMeta {
                    pubkey,
                    is_writable: message.is_static_writable_index(index),
                    // NOTE: vaultPda and ephemeralSignerPdas cannot be marked as signers,
                    // because they are PDAs and hence won't have their signatures on the transaction.
                    is_signer: message.is_signer_index(index)
                        && &pubkey != vault_pda
                        && ephemeral_signer_pdas.contains(&pubkey),
                }
            })
            .collect::<Vec<_>>();

        // And the last go the accounts that will be loaded with address lookup tables.
        let loaded_account_metas = message
            .address_table_lookups
            .iter()
            .map(|lookup| {
                let lookup_table_account = address_lookup_table_accounts
                    .get(&lookup.account_key)
                    .ok_or(Error::FailedToLoadAccount)?;

                // For each lookup, fist list writable, then readonly account metas.
                lookup
                    .writable_indexes
                    .iter()
                    .map(|&index| {
                        let pubkey = lookup_table_account
                            .addresses
                            .get(index as usize)
                            .ok_or(Error::FailedToLoadAccount)?
                            .to_owned();

                        Ok(AccountMeta {
                            pubkey,
                            is_writable: true,
                            is_signer: false,
                        })
                    })
                    .chain(lookup.readonly_indexes.iter().map(|&index| {
                        let pubkey = lookup_table_account
                            .addresses
                            .get(index as usize)
                            .ok_or(Error::FailedToLoadAccount)?
                            .to_owned();

                        Ok(AccountMeta {
                            pubkey,
                            is_writable: false,
                            is_signer: false,
                        })
                    }))
                    .collect::<Result<Vec<_>, Error>>()
            })
            .collect::<Result<Vec<_>, Error>>()?
            .into_iter()
            .flatten()
            .collect::<Vec<_>>();

        // endregion: -- Account Metas --

        Ok(Self {
            account_metas: [
                lookup_table_account_metas,
                static_account_metas,
                loaded_account_metas,
            ]
            .concat(),
            lookup_table_accounts: address_lookup_table_accounts.into_values().collect(),
        })
    }
}
