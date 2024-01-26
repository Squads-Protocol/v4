use crate::pda::get_ephemeral_signer_pda;
use squads_multisig_program::{
    CompiledInstruction, MessageAddressTableLookup, TransactionMessage, VaultTransactionMessage,
};
use std::collections::HashMap;

use super::compiled_keys::CompiledKeys;
use crate::solana_program::address_lookup_table_account::AddressLookupTableAccount;
use crate::solana_program::instruction::{AccountMeta, Instruction};
use crate::solana_program::message::{AccountKeys, CompileError};
use crate::solana_program::pubkey::Pubkey;

#[derive(thiserror::Error, Debug)]
pub enum Error {
    #[error("Invalid AddressLookupTableAccount")]
    InvalidAddressLookupTableAccount,
    #[error("Invalid TransactionMessage")]
    InvalidTransactionMessage,
}

pub trait VaultTransactionMessageExt {
    fn as_transaction_message(&self) -> &TransactionMessage;

    /// This implementation is mostly a copy-paste from `solana_program::message::v0::Message::try_compile()`,
    /// but it constructs a `TransactionMessage` meant to be passed to `vault_transaction_create`.
    fn try_compile(
        vault_key: &Pubkey,
        instructions: &[Instruction],
        address_lookup_table_accounts: &[AddressLookupTableAccount],
    ) -> Result<TransactionMessage, CompileError> {
        let mut compiled_keys = CompiledKeys::compile(instructions, Some(*vault_key));

        let mut address_table_lookups = Vec::with_capacity(address_lookup_table_accounts.len());
        let mut loaded_addresses_list = Vec::with_capacity(address_lookup_table_accounts.len());
        for lookup_table_account in address_lookup_table_accounts {
            if let Some((lookup, loaded_addresses)) =
                compiled_keys.try_extract_table_lookup(lookup_table_account)?
            {
                address_table_lookups.push(lookup);
                loaded_addresses_list.push(loaded_addresses);
            }
        }

        let (header, static_keys) = compiled_keys.try_into_message_components()?;
        let dynamic_keys = loaded_addresses_list.into_iter().collect();
        let account_keys = AccountKeys::new(&static_keys, Some(&dynamic_keys));
        let instructions = account_keys.try_compile_instructions(instructions)?;

        let num_static_keys: u8 = static_keys
            .len()
            .try_into()
            .map_err(|_| CompileError::AccountIndexOverflow)?;

        Ok(TransactionMessage {
            num_signers: header.num_required_signatures,
            num_writable_signers: header.num_required_signatures
                - header.num_readonly_signed_accounts,
            num_writable_non_signers: num_static_keys
                - header.num_required_signatures
                - header.num_readonly_unsigned_accounts,
            account_keys: static_keys.into(),
            instructions: instructions
                .into_iter()
                .map(|ix| CompiledInstruction {
                    program_id_index: ix.program_id_index,
                    account_indexes: ix.accounts.into(),
                    data: ix.data.into(),
                })
                .collect::<Vec<CompiledInstruction>>()
                .into(),
            address_table_lookups: address_table_lookups
                .into_iter()
                .map(|lookup| MessageAddressTableLookup {
                    account_key: lookup.account_key,
                    writable_indexes: lookup.writable_indexes.into(),
                    readonly_indexes: lookup.readonly_indexes.into(),
                })
                .collect::<Vec<MessageAddressTableLookup>>()
                .into(),
        })
    }

    fn get_accounts_for_execute(
        &self,
        vault_pda: &Pubkey,
        transaction_pda: &Pubkey,
        address_lookup_table_accounts: &[AddressLookupTableAccount],
        num_ephemeral_signers: u8,
        program_id: &Pubkey,
    ) -> Result<Vec<AccountMeta>, Error> {
        let message = VaultTransactionMessage::try_from(self.as_transaction_message().to_owned())
            .map_err(|_| Error::InvalidTransactionMessage)?;

        let ephemeral_signer_pdas: Vec<Pubkey> = (0..num_ephemeral_signers)
            .into_iter()
            .map(|ephemeral_signer_index| {
                get_ephemeral_signer_pda(transaction_pda, ephemeral_signer_index, Some(program_id))
                    .0
            })
            .collect();

        // region: -- address_lookup_tables map --

        let address_lookup_tables = address_lookup_table_accounts
            .into_iter()
            .map(|alt| (alt.key, alt))
            .collect::<HashMap<_, _>>();

        // endregion: -- address_lookup_tables map --

        // region: -- Account Metas --

        // First go the lookup table accounts used by the transaction. They are needed for on-chain validation.
        let lookup_table_account_metas = address_lookup_table_accounts
            .iter()
            .map(|alt| AccountMeta {
                pubkey: alt.key,
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
                        && !ephemeral_signer_pdas.contains(&pubkey),
                }
            })
            .collect::<Vec<_>>();

        // And the last go the accounts that will be loaded with address lookup tables.
        let loaded_account_metas = message
            .address_table_lookups
            .iter()
            .map(|lookup| {
                let lookup_table_account = address_lookup_tables
                    .get(&lookup.account_key)
                    .ok_or(Error::InvalidAddressLookupTableAccount)?;

                // For each lookup, fist list writable, then readonly account metas.
                lookup
                    .writable_indexes
                    .iter()
                    .map(|&index| {
                        let pubkey = lookup_table_account
                            .addresses
                            .get(index as usize)
                            .ok_or(Error::InvalidAddressLookupTableAccount)?
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
                            .ok_or(Error::InvalidAddressLookupTableAccount)?
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

        Ok([
            lookup_table_account_metas,
            static_account_metas,
            loaded_account_metas,
        ]
        .concat())
    }
}

impl VaultTransactionMessageExt for TransactionMessage {
    fn as_transaction_message(&self) -> &TransactionMessage {
        self
    }
}
