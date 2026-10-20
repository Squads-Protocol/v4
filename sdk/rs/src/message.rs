//! Compiles instructions into the vault `TransactionMessage` (u8/u16 length-prefixed
//! wire format) and derives the remaining accounts for executing a vault transaction.

use std::collections::{BTreeMap, HashMap};

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use solana_message::v0::{LoadedAddresses, MessageAddressTableLookup as V0Lookup};
use solana_message::{AccountKeys, AddressLookupTableAccount, CompileError, MessageHeader};

use crate::error::{ClientError, ClientResult};
use crate::pda::get_ephemeral_signer_pda;
use crate::types::{
    CompiledInstruction, MessageAddressTableLookup, MultisigCompiledInstruction,
    MultisigMessageAddressTableLookup, TransactionMessage, VaultTransactionMessage,
};

/// Compiles `instructions` for execution by `vault`. Accounts found in the given lookup
/// tables are loaded through them; tables that contribute no account are dropped.
pub fn compile_transaction_message(
    vault: &Address,
    instructions: &[Instruction],
    address_lookup_tables: &[AddressLookupTableAccount],
) -> ClientResult<TransactionMessage> {
    let mut compiled_keys = CompiledKeys::compile(instructions, *vault);
    let (lookups, loaded): (Vec<V0Lookup>, Vec<LoadedAddresses>) = address_lookup_tables
        .iter()
        .map(|table| compiled_keys.try_extract_table_lookup(table))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .unzip();

    let (header, static_keys) = compiled_keys.try_into_message_components()?;
    let dynamic_keys = loaded.into_iter().collect();
    let account_keys = AccountKeys::new(&static_keys, Some(&dynamic_keys));
    let compiled = account_keys.try_compile_instructions(instructions)?;
    let num_static_keys =
        u8::try_from(static_keys.len()).map_err(|_| CompileError::AccountIndexOverflow)?;

    Ok(TransactionMessage {
        num_signers: header.num_required_signatures,
        num_writable_signers: header.num_required_signatures - header.num_readonly_signed_accounts,
        num_writable_non_signers: num_static_keys
            - header.num_required_signatures
            - header.num_readonly_unsigned_accounts,
        account_keys: static_keys.into(),
        instructions: compiled
            .into_iter()
            .map(|ix| CompiledInstruction {
                program_id_index: ix.program_id_index,
                account_indexes: ix.accounts.into(),
                data: ix.data.into(),
            })
            .collect::<Vec<_>>()
            .into(),
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
) -> ClientResult<Vec<u8>> {
    let message = compile_transaction_message(vault, instructions, address_lookup_tables)?;
    borsh::to_vec(&message).map_err(|_| ClientError::InvalidTransactionMessage)
}

impl From<&TransactionMessage> for VaultTransactionMessage {
    fn from(message: &TransactionMessage) -> Self {
        Self {
            num_signers: message.num_signers,
            num_writable_signers: message.num_writable_signers,
            num_writable_non_signers: message.num_writable_non_signers,
            account_keys: message.account_keys.to_vec(),
            instructions: message
                .instructions
                .iter()
                .map(|ix| MultisigCompiledInstruction {
                    program_id_index: ix.program_id_index,
                    account_indexes: ix.account_indexes.to_vec(),
                    data: ix.data.to_vec(),
                })
                .collect(),
            address_table_lookups: message
                .address_table_lookups
                .iter()
                .map(|lookup| MultisigMessageAddressTableLookup {
                    account_key: lookup.account_key,
                    writable_indexes: lookup.writable_indexes.to_vec(),
                    readonly_indexes: lookup.readonly_indexes.to_vec(),
                })
                .collect(),
        }
    }
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
) -> ClientResult<Vec<AccountMeta>> {
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
            .ok_or(ClientError::MissingAddressLookupTable(*key))
    };

    let table_metas = message
        .address_table_lookups
        .iter()
        .map(|lookup| {
            table_for(&lookup.account_key)
                .map(|_| AccountMeta::new_readonly(lookup.account_key, false))
        })
        .collect::<ClientResult<Vec<_>>>()?;

    let static_metas = message
        .account_keys
        .iter()
        .enumerate()
        .map(|(index, key)| AccountMeta {
            pubkey: *key,
            is_writable: is_static_writable_index(message, index),
            is_signer: is_signer_index(message, index)
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
                    .ok_or(ClientError::InvalidLookupIndex {
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
                .collect::<ClientResult<Vec<_>>>()
        })
        .collect::<ClientResult<Vec<_>>>()?;

    Ok(table_metas
        .into_iter()
        .chain(static_metas)
        .chain(loaded_metas.into_iter().flatten())
        .collect())
}

/// Builds `vault_transaction_execute` with the remaining accounts the program expects.
/// The lookup-table metas follow `message`, not the order or length of the given tables.
pub fn vault_transaction_execute(
    accounts: &crate::instructions::VaultTransactionExecute,
    vault_index: u8,
    num_ephemeral_signers: u8,
    message: &VaultTransactionMessage,
    address_lookup_tables: &[AddressLookupTableAccount],
    program_id: Option<&Address>,
) -> ClientResult<Instruction> {
    let vault = crate::pda::get_vault_pda(&accounts.multisig, vault_index, program_id).0;
    let remaining = accounts_for_execute(
        message,
        &vault,
        &accounts.transaction,
        address_lookup_tables,
        num_ephemeral_signers,
        program_id,
    )?;
    // No optional accounts here, and the remaining accounts must match the message
    // exactly, so only the program ID changes.
    Ok(Instruction {
        program_id: *program_id.unwrap_or(&crate::ID),
        ..accounts.instruction_with_remaining_accounts(&remaining)
    })
}

fn is_signer_index(message: &VaultTransactionMessage, index: usize) -> bool {
    index < usize::from(message.num_signers)
}

fn is_static_writable_index(message: &VaultTransactionMessage, index: usize) -> bool {
    let num_signers = usize::from(message.num_signers);
    match index {
        i if i >= message.account_keys.len() => false,
        i if i < usize::from(message.num_writable_signers) => true,
        i if i >= num_signers => i - num_signers < usize::from(message.num_writable_non_signers),
        _ => false,
    }
}

#[derive(Default, Debug, Clone, PartialEq, Eq)]
struct CompiledKeyMeta {
    is_signer: bool,
    is_writable: bool,
    is_invoked: bool,
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

    fn try_into_message_components(self) -> Result<(MessageHeader, Vec<Address>), CompileError> {
        let to_u8 = |n: usize| u8::try_from(n).map_err(|_| CompileError::AccountIndexOverflow);
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

        let header = MessageHeader {
            num_required_signatures: to_u8(writable_signers.len() + readonly_signers.len())?,
            num_readonly_signed_accounts: to_u8(readonly_signers.len())?,
            num_readonly_unsigned_accounts: to_u8(readonly_non_signers.len())?,
        };
        let keys = [
            writable_signers,
            readonly_signers,
            writable_non_signers,
            readonly_non_signers,
        ]
        .concat();
        Ok((header, keys))
    }

    fn try_extract_table_lookup(
        &mut self,
        table: &AddressLookupTableAccount,
    ) -> Result<Option<(V0Lookup, LoadedAddresses)>, CompileError> {
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
        Ok(Some((
            V0Lookup {
                account_key: table.key,
                writable_indexes,
                readonly_indexes,
            },
            LoadedAddresses { writable, readonly },
        )))
    }

    fn try_drain_keys_found_in_table(
        &mut self,
        table_addresses: &[Address],
        filter: impl Fn(&CompiledKeyMeta) -> bool,
    ) -> Result<(Vec<u8>, Vec<Address>), CompileError> {
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
                    .map_err(|_| CompileError::AddressTableLookupIndexOverflow)
            })
            .collect::<Result<Vec<_>, _>>()?;
        found.iter().for_each(|(_, key)| {
            self.key_meta_map.remove(key);
        });
        Ok(found.into_iter().unzip())
    }
}
