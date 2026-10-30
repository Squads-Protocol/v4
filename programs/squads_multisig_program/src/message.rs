//! Compiles instructions into the vault `TransactionMessage` (u8/u16 length-prefixed wire
//! format) and derives the remaining accounts for executing a vault transaction.

use std::collections::{BTreeMap, HashMap};

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};

use crate::builders::VaultTransactionExecute;
use crate::error::{CoreError, CoreResult};
use crate::instructions::{CompiledInstruction, MessageAddressTableLookup, TransactionMessage};
use crate::pda::{get_ephemeral_signer_pda, get_vault_pda};
use crate::state::VaultTransactionMessage;

/// An address lookup table and the addresses it stores, in table order.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AddressLookupTableAccount {
    pub key: Address,
    pub addresses: Vec<Address>,
}

/// Compiles `instructions` for execution by `vault`. Accounts found in the given lookup
/// tables are loaded through them; tables that contribute no account are dropped.
pub fn compile_transaction_message(
    vault: &Address,
    instructions: &[Instruction],
    address_lookup_tables: &[AddressLookupTableAccount],
) -> CoreResult<TransactionMessage> {
    let mut compiled_keys = CompiledKeys::compile(instructions, *vault);
    let lookups = address_lookup_tables
        .iter()
        .map(|table| compiled_keys.try_extract_table_lookup(table))
        .collect::<CoreResult<Vec<_>>>()?
        .into_iter()
        .flatten()
        .collect::<Vec<TableLookup>>();
    let components = compiled_keys.try_into_message_components()?;

    // Account index order, as in a v0 message: static keys, then all loaded writable keys,
    // then all loaded readonly keys.
    let key_order: Vec<Address> = components
        .keys
        .iter()
        .copied()
        .chain(lookups.iter().flat_map(|l| l.writable.iter().copied()))
        .chain(lookups.iter().flat_map(|l| l.readonly.iter().copied()))
        .collect();
    let index_of = |key: &Address| {
        key_order
            .iter()
            .position(|k| k == key)
            .ok_or(CoreError::UnknownInstructionKey(*key))
            .and_then(|i| u8::try_from(i).map_err(|_| CoreError::AccountIndexOverflow))
    };
    let compiled = instructions
        .iter()
        .map(|ix| {
            Ok(CompiledInstruction {
                program_id_index: index_of(&ix.program_id)?,
                account_indexes: ix
                    .accounts
                    .iter()
                    .map(|account| index_of(&account.pubkey))
                    .collect::<CoreResult<Vec<u8>>>()?
                    .into(),
                data: ix.data.clone().into(),
            })
        })
        .collect::<CoreResult<Vec<_>>>()?;

    Ok(TransactionMessage {
        num_signers: components.num_signers,
        num_writable_signers: components.num_writable_signers,
        num_writable_non_signers: components.num_writable_non_signers,
        account_keys: components.keys.into(),
        instructions: compiled.into(),
        address_table_lookups: lookups
            .into_iter()
            .map(|lookup| MessageAddressTableLookup {
                account_key: lookup.account_key,
                writable_indexes: lookup.writable_indexes.into(),
                readonly_indexes: lookup.readonly_indexes.into(),
            })
            .collect::<Vec<_>>()
            .into(),
    })
}

/// Borsh bytes of the compiled message, as `vault_transaction_create` and
/// `batch_add_transaction` expect in `transaction_message`.
pub fn transaction_message_bytes(
    vault: &Address,
    instructions: &[Instruction],
    address_lookup_tables: &[AddressLookupTableAccount],
) -> CoreResult<Vec<u8>> {
    let message = compile_transaction_message(vault, instructions, address_lookup_tables)?;
    borsh::to_vec(&message).map_err(|_| CoreError::InvalidTransactionMessage)
}

/// Remaining accounts for `vault_transaction_execute` / `batch_execute_transaction`, in the
/// order the program expects: lookup tables, static account keys, then loaded accounts.
pub fn accounts_for_execute(
    message: &VaultTransactionMessage,
    vault: &Address,
    transaction: &Address,
    address_lookup_tables: &[AddressLookupTableAccount],
    num_ephemeral_signers: u8,
    program_id: Option<&Address>,
) -> CoreResult<Vec<AccountMeta>> {
    let ephemeral_signers: Vec<Address> = (0..num_ephemeral_signers)
        .map(|index| get_ephemeral_signer_pda(transaction, index, program_id).0)
        .collect();
    let tables: HashMap<Address, &AddressLookupTableAccount> = address_lookup_tables
        .iter()
        .map(|table| (table.key, table))
        .collect();
    let table_for = |key: &Address| {
        tables
            .get(key)
            .copied()
            .ok_or(CoreError::MissingAddressLookupTable(*key))
    };

    let table_metas = message
        .address_table_lookups
        .iter()
        .map(|lookup| {
            table_for(&lookup.account_key)
                .map(|_| AccountMeta::new_readonly(lookup.account_key, false))
        })
        .collect::<CoreResult<Vec<_>>>()?;

    let static_metas = message
        .account_keys
        .iter()
        .enumerate()
        .map(|(index, key)| AccountMeta {
            pubkey: *key,
            is_writable: message.is_static_writable_index(index),
            is_signer: message.is_signer_index(index)
                && key != vault
                && !ephemeral_signers.contains(key),
        });

    let loaded_metas = message
        .address_table_lookups
        .iter()
        .map(|lookup| {
            let table = table_for(&lookup.account_key)?;
            let resolve = |index: &u8, is_writable: bool| {
                table
                    .addresses
                    .get(usize::from(*index))
                    .map(|key| AccountMeta {
                        pubkey: *key,
                        is_writable,
                        is_signer: false,
                    })
                    .ok_or(CoreError::InvalidLookupIndex {
                        table: table.key,
                        index: *index,
                    })
            };
            lookup
                .writable_indexes
                .iter()
                .map(|index| resolve(index, true))
                .chain(
                    lookup
                        .readonly_indexes
                        .iter()
                        .map(|index| resolve(index, false)),
                )
                .collect::<CoreResult<Vec<_>>>()
        })
        .collect::<CoreResult<Vec<_>>>()?;

    Ok(table_metas
        .into_iter()
        .chain(static_metas)
        .chain(loaded_metas.into_iter().flatten())
        .collect())
}

/// Builds `vault_transaction_execute` with the remaining accounts the program expects.
/// The lookup-table metas follow `message`, not the order or length of the given tables.
pub fn vault_transaction_execute(
    accounts: &VaultTransactionExecute,
    vault_index: u8,
    num_ephemeral_signers: u8,
    message: &VaultTransactionMessage,
    address_lookup_tables: &[AddressLookupTableAccount],
    program_id: Option<&Address>,
) -> CoreResult<Instruction> {
    let vault = get_vault_pda(&accounts.multisig, vault_index, program_id).0;
    let remaining = accounts_for_execute(
        message,
        &vault,
        &accounts.transaction,
        address_lookup_tables,
        num_ephemeral_signers,
        program_id,
    )?;
    let mut instruction = accounts.instruction(program_id);
    instruction.accounts.extend(remaining);
    Ok(instruction)
}

#[derive(Default, Debug, Clone, PartialEq, Eq)]
struct CompiledKeyMeta {
    is_signer: bool,
    is_writable: bool,
    is_invoked: bool,
}

struct TableLookup {
    account_key: Address,
    writable_indexes: Vec<u8>,
    readonly_indexes: Vec<u8>,
    writable: Vec<Address>,
    readonly: Vec<Address>,
}

struct MessageComponents {
    num_signers: u8,
    num_writable_signers: u8,
    num_writable_non_signers: u8,
    keys: Vec<Address>,
}

/// Like `solana_message`'s private `CompiledKeys`, but program IDs are not marked as
/// invoked, so they can be loaded from lookup tables (the vault executes via CPI).
#[derive(Debug, Clone)]
struct CompiledKeys {
    payer: Address,
    key_meta_map: BTreeMap<Address, CompiledKeyMeta>,
}

impl CompiledKeys {
    fn compile(instructions: &[Instruction], payer: Address) -> Self {
        let mut key_meta_map = BTreeMap::<Address, CompiledKeyMeta>::new();
        instructions.iter().for_each(|ix| {
            key_meta_map.entry(ix.program_id).or_default();
            ix.accounts.iter().for_each(|account| {
                let meta = key_meta_map.entry(account.pubkey).or_default();
                meta.is_signer |= account.is_signer;
                meta.is_writable |= account.is_writable;
            });
        });
        let payer_meta = key_meta_map.entry(payer).or_default();
        payer_meta.is_signer = true;
        payer_meta.is_writable = true;
        Self {
            payer,
            key_meta_map,
        }
    }

    fn try_into_message_components(self) -> CoreResult<MessageComponents> {
        let to_u8 = |n: usize| u8::try_from(n).map_err(|_| CoreError::AccountIndexOverflow);
        let Self {
            payer,
            mut key_meta_map,
        } = self;
        key_meta_map.remove(&payer);

        let keys_where = |filter: fn(&CompiledKeyMeta) -> bool| -> Vec<Address> {
            key_meta_map
                .iter()
                .filter(|(_, meta)| filter(meta))
                .map(|(key, _)| *key)
                .collect()
        };
        let writable_signers: Vec<Address> = std::iter::once(payer)
            .chain(keys_where(|m| m.is_signer && m.is_writable))
            .collect();
        let readonly_signers = keys_where(|m| m.is_signer && !m.is_writable);
        let writable_non_signers = keys_where(|m| !m.is_signer && m.is_writable);
        let readonly_non_signers = keys_where(|m| !m.is_signer && !m.is_writable);

        let components = MessageComponents {
            num_signers: to_u8(writable_signers.len() + readonly_signers.len())?,
            num_writable_signers: to_u8(writable_signers.len())?,
            num_writable_non_signers: to_u8(writable_non_signers.len())?,
            keys: [
                writable_signers,
                readonly_signers,
                writable_non_signers,
                readonly_non_signers,
            ]
            .concat(),
        };
        to_u8(components.keys.len())?;
        Ok(components)
    }

    fn try_extract_table_lookup(
        &mut self,
        table: &AddressLookupTableAccount,
    ) -> CoreResult<Option<TableLookup>> {
        let (writable_indexes, writable) = self
            .try_drain_keys_found_in_table(&table.addresses, |m| {
                !m.is_signer && !m.is_invoked && m.is_writable
            })?;
        let (readonly_indexes, readonly) = self
            .try_drain_keys_found_in_table(&table.addresses, |m| {
                !m.is_signer && !m.is_invoked && !m.is_writable
            })?;

        if writable_indexes.is_empty() && readonly_indexes.is_empty() {
            return Ok(None);
        }
        Ok(Some(TableLookup {
            account_key: table.key,
            writable_indexes,
            readonly_indexes,
            writable,
            readonly,
        }))
    }

    fn try_drain_keys_found_in_table(
        &mut self,
        table_addresses: &[Address],
        filter: impl Fn(&CompiledKeyMeta) -> bool,
    ) -> CoreResult<(Vec<u8>, Vec<Address>)> {
        let found = self
            .key_meta_map
            .iter()
            .filter(|(_, meta)| filter(meta))
            .filter_map(|(key, _)| {
                table_addresses
                    .iter()
                    .position(|address| address == key)
                    .map(|i| (i, *key))
            })
            .map(|(i, key)| {
                u8::try_from(i)
                    .map(|i| (i, key))
                    .map_err(|_| CoreError::AddressTableLookupIndexOverflow)
            })
            .collect::<CoreResult<Vec<_>>>()?;
        found.iter().for_each(|(_, key)| {
            self.key_meta_map.remove(key);
        });
        Ok(found.into_iter().unzip())
    }
}
