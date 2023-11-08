use std::collections::BTreeMap;

use crate::solana_program::address_lookup_table_account::AddressLookupTableAccount;
use crate::solana_program::instruction::Instruction;
use crate::solana_program::message::v0::{LoadedAddresses, MessageAddressTableLookup};
use crate::solana_program::message::{CompileError, MessageHeader};

use crate::solana_program::pubkey::Pubkey;

/// A helper struct to collect pubkeys compiled for a set of instructions
///
/// NOTE: The only difference between this and the original implementation from `solana_program` is that we don't mark the instruction programIds as invoked.
// /// It makes sense to do because the instructions will be called via CPI, so the programIds can come from Address Lookup Tables.
// /// This allows to compress the message size and avoid hitting the tx size limit during `vault_transaction_create` instruction calls.
#[derive(Default, Debug, Clone, PartialEq, Eq)]
pub(crate) struct CompiledKeys {
    payer: Option<Pubkey>,
    key_meta_map: BTreeMap<Pubkey, CompiledKeyMeta>,
}

#[derive(Default, Debug, Clone, PartialEq, Eq)]
struct CompiledKeyMeta {
    is_signer: bool,
    is_writable: bool,
    is_invoked: bool,
}

impl CompiledKeys {
    /// Compiles the pubkeys referenced by a list of instructions and organizes by
    /// signer/non-signer and writable/readonly.
    pub(crate) fn compile(instructions: &[Instruction], payer: Option<Pubkey>) -> Self {
        let mut key_meta_map = BTreeMap::<Pubkey, CompiledKeyMeta>::new();
        for ix in instructions {
            let meta = key_meta_map.entry(ix.program_id).or_default();
            // NOTE: This is the only difference from the original.
            // meta.is_invoked = true;
            meta.is_invoked = false;
            for account_meta in &ix.accounts {
                let meta = key_meta_map.entry(account_meta.pubkey).or_default();
                meta.is_signer |= account_meta.is_signer;
                meta.is_writable |= account_meta.is_writable;
            }
        }
        if let Some(payer) = &payer {
            let meta = key_meta_map.entry(*payer).or_default();
            meta.is_signer = true;
            meta.is_writable = true;
        }
        Self {
            payer,
            key_meta_map,
        }
    }

    pub(crate) fn try_into_message_components(
        self,
    ) -> Result<(MessageHeader, Vec<Pubkey>), CompileError> {
        let try_into_u8 = |num: usize| -> Result<u8, CompileError> {
            u8::try_from(num).map_err(|_| CompileError::AccountIndexOverflow)
        };

        let Self {
            payer,
            mut key_meta_map,
        } = self;

        if let Some(payer) = &payer {
            key_meta_map.remove_entry(payer);
        }

        let writable_signer_keys: Vec<Pubkey> = payer
            .into_iter()
            .chain(
                key_meta_map
                    .iter()
                    .filter_map(|(key, meta)| (meta.is_signer && meta.is_writable).then_some(*key)),
            )
            .collect();
        let readonly_signer_keys: Vec<Pubkey> = key_meta_map
            .iter()
            .filter_map(|(key, meta)| (meta.is_signer && !meta.is_writable).then_some(*key))
            .collect();
        let writable_non_signer_keys: Vec<Pubkey> = key_meta_map
            .iter()
            .filter_map(|(key, meta)| (!meta.is_signer && meta.is_writable).then_some(*key))
            .collect();
        let readonly_non_signer_keys: Vec<Pubkey> = key_meta_map
            .iter()
            .filter_map(|(key, meta)| (!meta.is_signer && !meta.is_writable).then_some(*key))
            .collect();

        let signers_len = writable_signer_keys
            .len()
            .saturating_add(readonly_signer_keys.len());

        let header = MessageHeader {
            num_required_signatures: try_into_u8(signers_len)?,
            num_readonly_signed_accounts: try_into_u8(readonly_signer_keys.len())?,
            num_readonly_unsigned_accounts: try_into_u8(readonly_non_signer_keys.len())?,
        };

        let static_account_keys = std::iter::empty()
            .chain(writable_signer_keys)
            .chain(readonly_signer_keys)
            .chain(writable_non_signer_keys)
            .chain(readonly_non_signer_keys)
            .collect();

        Ok((header, static_account_keys))
    }

    #[cfg(not(target_os = "solana"))]
    pub(crate) fn try_extract_table_lookup(
        &mut self,
        lookup_table_account: &AddressLookupTableAccount,
    ) -> Result<Option<(MessageAddressTableLookup, LoadedAddresses)>, CompileError> {
        let (writable_indexes, drained_writable_keys) = self
            .try_drain_keys_found_in_lookup_table(&lookup_table_account.addresses, |meta| {
                !meta.is_signer && !meta.is_invoked && meta.is_writable
            })?;
        let (readonly_indexes, drained_readonly_keys) = self
            .try_drain_keys_found_in_lookup_table(&lookup_table_account.addresses, |meta| {
                !meta.is_signer && !meta.is_invoked && !meta.is_writable
            })?;

        // Don't extract lookup if no keys were found
        if writable_indexes.is_empty() && readonly_indexes.is_empty() {
            return Ok(None);
        }

        Ok(Some((
            MessageAddressTableLookup {
                account_key: lookup_table_account.key,
                writable_indexes,
                readonly_indexes,
            },
            LoadedAddresses {
                writable: drained_writable_keys,
                readonly: drained_readonly_keys,
            },
        )))
    }

    #[cfg(not(target_os = "solana"))]
    fn try_drain_keys_found_in_lookup_table(
        &mut self,
        lookup_table_addresses: &[Pubkey],
        key_meta_filter: impl Fn(&CompiledKeyMeta) -> bool,
    ) -> Result<(Vec<u8>, Vec<Pubkey>), CompileError> {
        let mut lookup_table_indexes = Vec::new();
        let mut drained_keys = Vec::new();

        for search_key in self
            .key_meta_map
            .iter()
            .filter_map(|(key, meta)| key_meta_filter(meta).then_some(key))
        {
            for (key_index, key) in lookup_table_addresses.iter().enumerate() {
                if key == search_key {
                    let lookup_table_index = u8::try_from(key_index)
                        .map_err(|_| CompileError::AddressTableLookupIndexOverflow)?;

                    lookup_table_indexes.push(lookup_table_index);
                    drained_keys.push(*search_key);
                    break;
                }
            }
        }

        for key in &drained_keys {
            self.key_meta_map.remove_entry(key);
        }

        Ok((lookup_table_indexes, drained_keys))
    }
}
