use anchor_lang::prelude::*;
use anchor_lang::solana_program::borsh0_10::get_instance_packed_len;

use crate::{TransactionMessage, VaultTransactionMessage};

/// Stores data required for serial execution of a batch of multisig vault transactions.
/// Vault transaction is a transaction that's executed on behalf of the multisig vault PDA
/// and wraps arbitrary Solana instructions, typically calling into other Solana programs.
/// The transactions themselves are stored in separate PDAs associated with the this account.
#[account]
#[derive(InitSpace)]
pub struct Batch {
    /// The multisig this belongs to.
    pub multisig: Pubkey,
    /// Member of the Multisig who submitted the batch.
    pub creator: Pubkey,
    /// Index of this batch within the multisig transactions.
    pub index: u64,
    /// PDA bump.
    pub bump: u8,
    /// Index of the vault this batch belongs to.
    pub vault_index: u8,
    /// Derivation bump of the vault PDA this batch belongs to.
    pub vault_bump: u8,
    /// Number of transactions in the batch.
    pub size: u32,
    /// Index of the last executed transaction within the batch.
    /// 0 means that no transactions have been executed yet.
    pub executed_transaction_index: u32,
}

impl Batch {
    pub fn invariant(&self) -> Result<()> {
        // Just a sanity check.
        require_gte!(self.size, self.executed_transaction_index);

        Ok(())
    }
}

/// Stores data required for execution of one transaction from a batch.
#[account]
#[derive(Default)]
pub struct VaultBatchTransaction {
    /// PDA bump.
    pub bump: u8,
    /// Derivation bumps for additional signers.
    /// Some transactions require multiple signers. Often these additional signers are "ephemeral" keypairs
    /// that are generated on the client with a sole purpose of signing the transaction and be discarded immediately after.
    /// When wrapping such transactions into multisig ones, we replace these "ephemeral" signing keypairs
    /// with PDAs derived from the transaction's `transaction_index` and controlled by the Multisig Program;
    /// during execution the program includes the seeds of these PDAs into the `invoke_signed` calls,
    /// thus "signing" on behalf of these PDAs.
    pub ephemeral_signer_bumps: Vec<u8>,
    /// data required for executing the transaction.
    pub message: VaultTransactionMessage,
}

impl VaultBatchTransaction {
    pub fn size(ephemeral_signers_length: u8, transaction_message: &[u8]) -> Result<usize> {
        let transaction_message: VaultTransactionMessage =
            TransactionMessage::deserialize(&mut &transaction_message[..])?.try_into()?;

        let message_size = get_instance_packed_len(&transaction_message).unwrap_or_default();

        Ok(
            8 +   // anchor account discriminator
            1 +   // bump
            (4 + usize::from(ephemeral_signers_length)) +   // ephemeral_signers_bumps vec
            message_size, // message
        )
    }

    /// Reduces the VaultBatchTransaction to its default empty value and moves
    /// ownership of the data to the caller/return value.
    pub fn take(&mut self) -> VaultBatchTransaction {
        core::mem::take(self)
    }
}
