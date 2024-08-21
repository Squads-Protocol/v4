use std::collections::HashMap;
use std::convert::From;

use anchor_lang::prelude::*;
use anchor_lang::solana_program::address_lookup_table;
use anchor_lang::solana_program::address_lookup_table::state::AddressLookupTable;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::solana_program::program::invoke_signed;

use crate::errors::*;
use crate::state::*;

/// Sanitized and validated combination of a `MsTransactionMessage` and `AccountInfo`s it references.
pub struct ExecutableTransactionMessage<'a, 'info> {
    /// Message which loaded a collection of lookup table addresses.
    message: VaultTransactionMessage,
    /// Resolved `account_keys` of the message.
    static_accounts: Vec<&'a AccountInfo<'info>>,
    /// Concatenated vector of resolved `writable_indexes` from all address lookups.
    loaded_writable_accounts: Vec<&'a AccountInfo<'info>>,
    /// Concatenated vector of resolved `readonly_indexes` from all address lookups.
    loaded_readonly_accounts: Vec<&'a AccountInfo<'info>>,
}

impl<'a, 'info> ExecutableTransactionMessage<'a, 'info> {
    /// # Arguments
    /// `message` - a `MsTransactionMessage`.
    /// `message_account_infos` - AccountInfo's that are expected to be mentioned in the message.
    /// `address_lookup_table_account_infos` - AccountInfo's that are expected to correspond to the lookup tables mentioned in `message.address_table_lookups`.
    /// `vault_pubkey` - The vault PDA that is expected to sign the message.
    pub fn new_validated(
        message: VaultTransactionMessage,
        message_account_infos: &'a [AccountInfo<'info>],
        address_lookup_table_account_infos: &'a [AccountInfo<'info>],
        vault_pubkey: &'a Pubkey,
        ephemeral_signer_pdas: &'a [Pubkey],
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
            .enumerate()
            .map(|(index, maybe_lookup_table)| {
                // The lookup table account must be owned by SolanaAddressLookupTableProgram.
                require!(
                    maybe_lookup_table.owner == &address_lookup_table::program::ID,
                    MultisigError::InvalidAccount
                );
                // The lookup table must be mentioned in `message.address_table_lookups` at the same index.
                require!(
                    message
                        .address_table_lookups
                        .get(index)
                        .map(|lookup| &lookup.account_key)
                        == Some(maybe_lookup_table.key),
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

        let mut static_accounts = Vec::new();

        // CHECK: `message.account_keys` should come first in `account_infos` and have modifiers expected by the message.
        for (i, account_key) in message.account_keys.iter().enumerate() {
            let account_info = &message_account_infos[i];
            require_keys_eq!(
                *account_info.key,
                *account_key,
                MultisigError::InvalidAccount
            );
            // If the account is marked as signer in the message, it must be a signer in the account infos too.
            // Unless it's a vault or an ephemeral signer PDA, as they cannot be passed as signers to `remaining_accounts`,
            // because they are PDA's and can't sign the transaction.
            if message.is_signer_index(i)
                && account_info.key != vault_pubkey
                && !ephemeral_signer_pdas.contains(account_info.key)
            {
                require!(account_info.is_signer, MultisigError::InvalidAccount);
            }
            // If the account is marked as writable in the message, it must be writable in the account infos too.
            if message.is_static_writable_index(i) {
                require!(account_info.is_writable, MultisigError::InvalidAccount);
            }
            static_accounts.push(account_info);
        }

        let mut writable_accounts = Vec::new();
        let mut readonly_accounts = Vec::new();

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

            // Accounts listed as writable in lookup, should be loaded as writable.
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

                writable_accounts.push(*loaded_account_info);
            }
            message_indexes_cursor += lookup.writable_indexes.len();

            // Accounts listed as readonly in lookup.
            for (i, index_in_lookup_table) in lookup.readonly_indexes.iter().enumerate() {
                // Check the modifiers.
                let index = message_indexes_cursor + i;
                let loaded_account_info = &message_account_infos
                    .get(index)
                    .ok_or(MultisigError::InvalidNumberOfAccounts)?;
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

                readonly_accounts.push(*loaded_account_info);
            }
            message_indexes_cursor += lookup.readonly_indexes.len();
        }

        Ok(Self {
            message,
            static_accounts,
            loaded_writable_accounts: writable_accounts,
            loaded_readonly_accounts: readonly_accounts,
        })
    }

    /// Executes all instructions in the message via CPI calls.
    /// # Arguments
    /// * `vault_seeds` - Seeds for the vault PDA.
    /// * `ephemeral_signer_seeds` - Seeds for the ephemeral signer PDAs.
    /// * `protected_accounts` - Accounts that must not be passed as writable to the CPI calls to prevent potential reentrancy attacks.
    pub fn execute_message(
        self,
        vault_seeds: &[&[u8]],
        ephemeral_signer_seeds: &[Vec<Vec<u8>>],
        protected_accounts: &[Pubkey],
    ) -> Result<()> {
        // First round of type conversion; from Vec<Vec<Vec<u8>>> to Vec<Vec<&[u8]>>.
        let ephemeral_signer_seeds = &ephemeral_signer_seeds
            .iter()
            .map(|seeds| seeds.iter().map(Vec::as_slice).collect::<Vec<&[u8]>>())
            .collect::<Vec<Vec<&[u8]>>>();
        // Second round of type conversion; from Vec<Vec<&[u8]>> to Vec<&[&[u8]]>.
        let mut signer_seeds = ephemeral_signer_seeds
            .iter()
            .map(Vec::as_slice)
            .collect::<Vec<&[&[u8]]>>();
        // Add the vault seeds.
        signer_seeds.push(&vault_seeds);

        // NOTE: `self.to_instructions_and_accounts()` calls `take()` on
        // `self.message.instructions`, therefore after this point no more
        // references or usages of `self.message` should be made to avoid
        // faulty behavior.
        for (ix, account_infos) in self.to_instructions_and_accounts().iter() {
            // Make sure we don't pass protected accounts as writable to CPI calls.
            for account_meta in ix.accounts.iter().filter(|m| m.is_writable) {
                require!(
                    !protected_accounts.contains(&account_meta.pubkey),
                    MultisigError::ProtectedAccount
                );
            }
            invoke_signed(&ix, &account_infos, &signer_seeds)?;
        }
        Ok(())
    }

    /// Account indices are resolved in the following order:
    /// 1. Static accounts.
    /// 2. All loaded writable accounts.
    /// 3. All loaded readonly accounts.
    fn get_account_by_index(&self, index: usize) -> Result<&'a AccountInfo<'info>> {
        if index < self.static_accounts.len() {
            return Ok(self.static_accounts[index]);
        }

        let index = index - self.static_accounts.len();
        if index < self.loaded_writable_accounts.len() {
            return Ok(self.loaded_writable_accounts[index]);
        }

        let index = index - self.loaded_writable_accounts.len();
        if index < self.loaded_readonly_accounts.len() {
            return Ok(self.loaded_readonly_accounts[index]);
        }

        Err(MultisigError::InvalidTransactionMessage.into())
    }

    /// Whether the account at the `index` is requested as writable.
    fn is_writable_index(&self, index: usize) -> bool {
        if self.message.is_static_writable_index(index) {
            return true;
        }

        if index < self.static_accounts.len() {
            // Index is within static accounts but is not writable.
            return false;
        }

        // "Skip" the static account indexes.
        let index = index - self.static_accounts.len();

        index < self.loaded_writable_accounts.len()
    }

    pub fn to_instructions_and_accounts(mut self) -> Vec<(Instruction, Vec<AccountInfo<'info>>)> {
        let mut executable_instructions = vec![];

        for ms_compiled_instruction in core::mem::take(&mut self.message.instructions) {
            let ix_accounts: Vec<(AccountInfo<'info>, AccountMeta)> = ms_compiled_instruction
                .account_indexes
                .iter()
                .map(|account_index| {
                    let account_index = usize::from(*account_index);
                    let account_info = self.get_account_by_index(account_index).unwrap();

                    // `is_signer` cannot just be taken from the account info, because for `authority`
                    // it's always false in the passed account infos, but might be true in the actual instructions.
                    let is_signer = self.message.is_signer_index(account_index);

                    let account_meta = if self.is_writable_index(account_index) {
                        AccountMeta::new(*account_info.key, is_signer)
                    } else {
                        AccountMeta::new_readonly(*account_info.key, is_signer)
                    };

                    (account_info.clone(), account_meta)
                })
                .collect();

            let ix_program_account_info = self
                .get_account_by_index(usize::from(ms_compiled_instruction.program_id_index))
                .unwrap();

            let ix = Instruction {
                program_id: *ix_program_account_info.key,
                accounts: ix_accounts
                    .iter()
                    .map(|(_, account_meta)| account_meta.clone())
                    .collect(),
                data: ms_compiled_instruction.data,
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
