use anchor_lang::prelude::*;
use anchor_lang::solana_program::borsh0_10::get_instance_packed_len;

use crate::errors::*;
use crate::instructions::{CompiledInstruction, MessageAddressTableLookup, TransactionMessage};

/// Stores data required for tracking the voting and execution status of a vault transaction.
/// Vault transaction is a transaction that's executed on behalf of the multisig vault PDA
/// and wraps arbitrary Solana instructions, typically calling into other Solana programs.
#[account]
#[derive(Default)]
pub struct VaultTransaction {
    /// The multisig this belongs to.
    pub multisig: Pubkey,
    /// Member of the Multisig who submitted the transaction.
    pub creator: Pubkey,
    /// Index of this transaction within the multisig.
    pub index: u64,
    /// bump for the transaction seeds.
    pub bump: u8,
    /// Index of the vault this transaction belongs to.
    pub vault_index: u8,
    /// Derivation bump of the vault PDA this transaction belongs to.
    pub vault_bump: u8,
    /// Derivation bumps for additional signers.
    /// Some transactions require multiple signers. Often these additional signers are "ephemeral" keypairs
    /// that are generated on the client with a sole purpose of signing the transaction and be discarded immediately after.
    /// When wrapping such transactions into multisig ones, we replace these "ephemeral" signing keypairs
    /// with PDAs derived from the MultisigTransaction's `transaction_index` and controlled by the Multisig Program;
    /// during execution the program includes the seeds of these PDAs into the `invoke_signed` calls,
    /// thus "signing" on behalf of these PDAs.
    pub ephemeral_signer_bumps: Vec<u8>,
    /// data required for executing the transaction.
    pub message: VaultTransactionMessage,
}

impl VaultTransaction {
    pub fn size(ephemeral_signers_length: u8, transaction_message: &[u8]) -> Result<usize> {
        let transaction_message: VaultTransactionMessage =
            TransactionMessage::deserialize(&mut &transaction_message[..])?.try_into()?;
        let message_size = get_instance_packed_len(&transaction_message).unwrap_or_default();

        Ok(
            8 +   // anchor account discriminator
            32 +  // multisig
            32 +  // creator
            8 +   // index
            1 +   // bump
            1 +   // vault_index
            1 +   // vault_bump
            (4 + usize::from(ephemeral_signers_length)) +   // ephemeral_signers_bumps vec
            message_size, // message
        )
    }
    /// Reduces the VaultTransaction to its default empty value and moves
    /// ownership of the data to the caller/return value.
    pub fn take(&mut self) -> VaultTransaction {
        core::mem::take(self)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Default)]
pub struct VaultTransactionMessage {
    /// The number of signer pubkeys in the account_keys vec.
    pub num_signers: u8,
    /// The number of writable signer pubkeys in the account_keys vec.
    pub num_writable_signers: u8,
    /// The number of writable non-signer pubkeys in the account_keys vec.
    pub num_writable_non_signers: u8,
    /// Unique account pubkeys (including program IDs) required for execution of the tx.
    /// The signer pubkeys appear at the beginning of the vec, with writable pubkeys first, and read-only pubkeys following.
    /// The non-signer pubkeys follow with writable pubkeys first and read-only ones following.
    /// Program IDs are also stored at the end of the vec along with other non-signer non-writable pubkeys:
    ///
    /// ```plaintext
    /// [pubkey1, pubkey2, pubkey3, pubkey4, pubkey5, pubkey6, pubkey7, pubkey8]
    ///  |---writable---|  |---readonly---|  |---writable---|  |---readonly---|
    ///  |------------signers-------------|  |----------non-singers-----------|
    /// ```
    pub account_keys: Vec<Pubkey>,
    /// List of instructions making up the tx.
    pub instructions: Vec<MultisigCompiledInstruction>,
    /// List of address table lookups used to load additional accounts
    /// for this transaction.
    pub address_table_lookups: Vec<MultisigMessageAddressTableLookup>,
}

impl VaultTransactionMessage {
    /// Returns the number of all the account keys (static + dynamic) in the message.
    pub fn num_all_account_keys(&self) -> usize {
        let num_account_keys_from_lookups = self
            .address_table_lookups
            .iter()
            .map(|lookup| lookup.writable_indexes.len() + lookup.readonly_indexes.len())
            .sum::<usize>();

        self.account_keys.len() + num_account_keys_from_lookups
    }

    /// Returns true if the account at the specified index is a part of static `account_keys` and was requested to be writable.
    pub fn is_static_writable_index(&self, key_index: usize) -> bool {
        let num_account_keys = self.account_keys.len();
        let num_signers = usize::from(self.num_signers);
        let num_writable_signers = usize::from(self.num_writable_signers);
        let num_writable_non_signers = usize::from(self.num_writable_non_signers);

        if key_index >= num_account_keys {
            // `index` is not a part of static `account_keys`.
            return false;
        }

        if key_index < num_writable_signers {
            // `index` is within the range of writable signer keys.
            return true;
        }

        if key_index >= num_signers {
            // `index` is within the range of non-signer keys.
            let index_into_non_signers = key_index.saturating_sub(num_signers);
            // Whether `index` is within the range of writable non-signer keys.
            return index_into_non_signers < num_writable_non_signers;
        }

        false
    }

    /// Returns true if the account at the specified index was requested to be a signer.
    pub fn is_signer_index(&self, key_index: usize) -> bool {
        key_index < usize::from(self.num_signers)
    }
}

impl TryFrom<TransactionMessage> for VaultTransactionMessage {
    type Error = Error;

    fn try_from(message: TransactionMessage) -> Result<Self> {
        let account_keys: Vec<Pubkey> = message.account_keys.into();
        let instructions: Vec<CompiledInstruction> = message.instructions.into();
        let instructions: Vec<MultisigCompiledInstruction> = instructions
            .into_iter()
            .map(MultisigCompiledInstruction::from)
            .collect();
        let address_table_lookups: Vec<MessageAddressTableLookup> =
            message.address_table_lookups.into();

        let num_all_account_keys = account_keys.len()
            + address_table_lookups
                .iter()
                .map(|lookup| lookup.writable_indexes.len() + lookup.readonly_indexes.len())
                .sum::<usize>();

        require!(
            usize::from(message.num_signers) <= account_keys.len(),
            MultisigError::InvalidTransactionMessage
        );
        require!(
            message.num_writable_signers <= message.num_signers,
            MultisigError::InvalidTransactionMessage
        );
        require!(
            usize::from(message.num_writable_non_signers)
                <= account_keys
                    .len()
                    .saturating_sub(usize::from(message.num_signers)),
            MultisigError::InvalidTransactionMessage
        );

        // Validate that all program ID indices and account indices are within the bounds of the account keys.
        for instruction in &instructions {
            require!(
                usize::from(instruction.program_id_index) < num_all_account_keys,
                MultisigError::InvalidTransactionMessage
            );

            for account_index in &instruction.account_indexes {
                require!(
                    usize::from(*account_index) < num_all_account_keys,
                    MultisigError::InvalidTransactionMessage
                );
            }
        }

        Ok(Self {
            num_signers: message.num_signers,
            num_writable_signers: message.num_writable_signers,
            num_writable_non_signers: message.num_writable_non_signers,
            account_keys,
            instructions,
            address_table_lookups: address_table_lookups
                .into_iter()
                .map(MultisigMessageAddressTableLookup::from)
                .collect(),
        })
    }
}

/// Concise serialization schema for instructions that make up a transaction.
/// Closely mimics the Solana transaction wire format.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MultisigCompiledInstruction {
    pub program_id_index: u8,
    /// Indices into the tx's `account_keys` list indicating which accounts to pass to the instruction.
    pub account_indexes: Vec<u8>,
    /// Instruction data.
    pub data: Vec<u8>,
}

impl From<CompiledInstruction> for MultisigCompiledInstruction {
    fn from(compiled_instruction: CompiledInstruction) -> Self {
        Self {
            program_id_index: compiled_instruction.program_id_index,
            account_indexes: compiled_instruction.account_indexes.into(),
            data: compiled_instruction.data.into(),
        }
    }
}

/// Address table lookups describe an on-chain address lookup table to use
/// for loading more readonly and writable accounts into a transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MultisigMessageAddressTableLookup {
    /// Address lookup table account key.
    pub account_key: Pubkey,
    /// List of indexes used to load writable accounts.
    pub writable_indexes: Vec<u8>,
    /// List of indexes used to load readonly accounts.
    pub readonly_indexes: Vec<u8>,
}

impl From<MessageAddressTableLookup> for MultisigMessageAddressTableLookup {
    fn from(m: MessageAddressTableLookup) -> Self {
        Self {
            account_key: m.account_key,
            writable_indexes: m.writable_indexes.into(),
            readonly_indexes: m.readonly_indexes.into(),
        }
    }
}
