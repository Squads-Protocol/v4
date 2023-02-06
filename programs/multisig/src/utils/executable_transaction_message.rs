use std::collections::HashMap;
use std::convert::From;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use solana_address_lookup_table_program::state::AddressLookupTable;

use crate::errors::*;
use crate::state::*;

/// Sanitized and validated combination of a `MsTransactionMessage` and `AccountInfo`s it references.
pub struct ExecutableTransactionMessage<'a, 'info> {
    /// Message which loaded a collection of lookup table addresses.
    message: &'a MultisigTransactionMessage,
    /// Cache that maps `AccountInfo`s mentioned in the message to the indices they are referred by in the message.
    account_infos_by_message_index: HashMap<usize, &'a AccountInfo<'info>>,
}

impl<'a, 'info> ExecutableTransactionMessage<'a, 'info> {
    /// # Arguments
    /// `message` - a `MsTransactionMessage`.
    /// `message_account_infos` - AccountInfo's that are expected to be mentioned in the message.
    /// `address_lookup_table_account_infos` - AccountInfo's that are expected to correspond to the lookup tables mentioned in `message.address_table_lookups`.
    /// `authority_pubkey` - The authority PDA that is expected to sign the message.
    pub fn new_validated(
        message: &'a MultisigTransactionMessage,
        message_account_infos: &'a [AccountInfo<'info>],
        address_lookup_table_account_infos: &'a [AccountInfo<'info>],
        authority_pubkey: &'a Pubkey,
        additional_signer_pdas: &'a [Pubkey],
    ) -> Result<Self> {
        // CHECK: `address_lookup_table_account_infos` must be valid `AddressLookupTable`s
        //         and be the ones mentioned in `message.address_table_lookups`.
        require_eq!(
            address_lookup_table_account_infos.len(),
            message.address_table_lookups.len(),
            MultisigError::InvalidNumberOfAccounts
        );
        let lookup_tables: HashMap<&Pubkey, &AccountInfo> = address_lookup_table_account_infos
            .iter()
            .map(|maybe_lookup_table| {
                // The lookup table account must be owned by SolanaAddressLookupTableProgram.
                require!(
                    maybe_lookup_table.owner == &solana_address_lookup_table_program::id(),
                    MultisigError::InvalidAccount
                );
                // The lookup table must be mentioned in `message.address_table_lookups`.
                require!(
                    message
                        .address_table_lookups
                        .iter()
                        .any(|lookup| &lookup.account_key == maybe_lookup_table.key),
                    MultisigError::InvalidAccount
                );
                Ok((maybe_lookup_table.key, maybe_lookup_table))
            })
            .collect::<Result<HashMap<&Pubkey, &AccountInfo>>>()?;

        // CHECK: `account_infos` should exactly match the number of accounts mentioned in the message.
        require_eq!(
            message_account_infos.len(),
            message.num_all_account_keys(),
            MultisigError::InvalidNumberOfAccounts
        );

        let mut account_infos_by_message_index = HashMap::new();

        // CHECK: `message.account_keys` should come first in `account_infos` and have modifiers expected by the message.
        for (i, account_key) in message.account_keys.iter().enumerate() {
            let account_info = &message_account_infos[i];
            require_keys_eq!(
                *account_info.key,
                *account_key,
                MultisigError::InvalidAccount
            );
            require_eq!(
                account_info.is_writable,
                message.is_static_writable_index(i),
                MultisigError::InvalidAccount
            );
            // For authority or additional_signer_pdas `is_signer` might differ because it's always false in the passed account infos.
            if account_info.key != authority_pubkey
                && !additional_signer_pdas.contains(account_info.key)
            {
                require_eq!(
                    account_info.is_signer,
                    message.is_signer_index(i),
                    MultisigError::InvalidAccount
                );
            }
            account_infos_by_message_index.insert(i, account_info);
        }

        // CHECK: `message_account_infos` loaded with lookup tables should come after `message.account_keys`,
        //        in the same order and with the same modifiers as listed in lookups.
        // Track where we are in the message account indexes. Start after `message.account_keys`.
        let mut message_indexes_cursor = message.account_keys.len();
        for lookup in message.address_table_lookups.iter() {
            // This is cheap deserialization, it doesn't allocate/clone space for addresses.
            let lookup_table_data = &lookup_tables
                .get(&lookup.account_key)
                .unwrap()
                .data
                .borrow()[..];
            let lookup_table = AddressLookupTable::deserialize(lookup_table_data)
                .map_err(|_| MultisigError::InvalidAccount)?;

            // Accounts listed as writable in lookup, should be loaded as writable and non-signers.
            for (i, index_in_lookup_table) in lookup.writable_indexes.iter().enumerate() {
                // Check the modifiers.
                let index = message_indexes_cursor + i;
                let loaded_account_info = &message_account_infos
                    .get(index)
                    .ok_or(MultisigError::InvalidNumberOfAccounts)?;
                require_eq!(
                    loaded_account_info.is_writable,
                    true,
                    MultisigError::InvalidAccount
                );
                require_eq!(
                    loaded_account_info.is_signer,
                    false,
                    MultisigError::InvalidAccount
                );
                // Check that the pubkey matches the one from the actual lookup table.
                let pubkey_from_lookup_table = lookup_table
                    .addresses
                    .get(usize::from(*index_in_lookup_table))
                    .ok_or(MultisigError::InvalidAccount)?;
                require_keys_eq!(
                    *loaded_account_info.key,
                    *pubkey_from_lookup_table,
                    MultisigError::InvalidAccount
                );

                account_infos_by_message_index.insert(index, loaded_account_info);
            }
            message_indexes_cursor += lookup.writable_indexes.len();

            // Accounts listed as readonly in lookup, should be loaded as readonly and non-signers.
            for (i, index_in_lookup_table) in lookup.readonly_indexes.iter().enumerate() {
                // Check the modifiers.
                let index = message_indexes_cursor + i;
                let loaded_account_info = &message_account_infos
                    .get(index)
                    .ok_or(MultisigError::InvalidNumberOfAccounts)?;
                require_eq!(
                    loaded_account_info.is_writable,
                    false,
                    MultisigError::InvalidAccount
                );
                require_eq!(
                    loaded_account_info.is_signer,
                    false,
                    MultisigError::InvalidAccount
                );
                // Check that the pubkey matches the one from the actual lookup table.
                let pubkey_from_lookup_table = lookup_table
                    .addresses
                    .get(usize::from(*index_in_lookup_table))
                    .ok_or(MultisigError::InvalidAccount)?;
                require_keys_eq!(
                    *loaded_account_info.key,
                    *pubkey_from_lookup_table,
                    MultisigError::InvalidAccount
                );

                account_infos_by_message_index.insert(index, loaded_account_info);
            }
            message_indexes_cursor += lookup.readonly_indexes.len();
        }

        Ok(Self {
            message,
            account_infos_by_message_index,
        })
    }

    pub fn to_instructions_and_accounts(&self) -> Vec<(Instruction, Vec<AccountInfo<'info>>)> {
        let mut executable_instructions = vec![];

        for ms_compiled_instruction in self.message.instructions.iter() {
            let ix_accounts: Vec<(AccountInfo<'info>, AccountMeta)> = ms_compiled_instruction
                .account_indexes
                .iter()
                .map(|account_index| {
                    let account_info = *self
                        .account_infos_by_message_index
                        .get(&usize::from(*account_index))
                        .unwrap();

                    // `is_signer` cannot just be taken from the account info, because for `authority`
                    // it's always false in the passed account infos, but might be true in the actual instructions.
                    let is_signer = self.message.is_signer_index(usize::from(*account_index));

                    let account_meta = if account_info.is_writable {
                        AccountMeta::new(*account_info.key, is_signer)
                    } else {
                        AccountMeta::new_readonly(*account_info.key, is_signer)
                    };

                    (account_info.clone(), account_meta)
                })
                .collect();

            // Program ID should always be in the static accounts list.
            let ix_program_account_info = *self
                .account_infos_by_message_index
                .get(&usize::from(ms_compiled_instruction.program_id_index))
                .unwrap();

            let ix = Instruction {
                program_id: *ix_program_account_info.key,
                accounts: ix_accounts
                    .iter()
                    .map(|(_, account_meta)| account_meta.clone())
                    .collect(),
                data: ms_compiled_instruction.data.clone(),
            };

            let mut account_infos: Vec<AccountInfo> = ix_accounts
                .into_iter()
                .map(|(account_info, _)| account_info)
                .collect();
            // Add Program ID
            account_infos.push(ix_program_account_info.clone());

            executable_instructions.push((ix, account_infos));
        }

        executable_instructions
    }
}
