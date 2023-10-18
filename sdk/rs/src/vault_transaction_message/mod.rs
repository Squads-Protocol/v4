use squads_multisig_program::{CompiledInstruction, MessageAddressTableLookup, TransactionMessage};

use crate::solana_program::address_lookup_table_account::AddressLookupTableAccount;
use crate::solana_program::instruction::Instruction;
use crate::solana_program::message::{AccountKeys, CompileError};
use crate::solana_program::pubkey::Pubkey;
use crate::vault_transaction_message::compiled_keys::CompiledKeys;

mod compiled_keys;

pub trait VaultTransactionMessageExt {
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
}

impl VaultTransactionMessageExt for TransactionMessage {}
