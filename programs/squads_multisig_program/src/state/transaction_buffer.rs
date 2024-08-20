use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

use crate::errors::MultisigError;

// Since VaultTransaction doesn't implement zero-copy, we are limited to
// deserializing the account onto the Stack. This means we are limited to a
// theoretical max size of 4KiB
pub const MAX_BUFFER_SIZE: usize = 4000;

#[account]
#[derive(Default, Debug)]
pub struct TransactionBuffer {
    /// The multisig this belongs to.
    pub multisig: Pubkey,
    /// Member of the Multisig who created the TransactionBuffer.
    pub creator: Pubkey,
    /// Vault index of the transaction this buffer belongs to.
    pub vault_index: u8,
    /// Index of the transaction this buffer belongs to.
    pub transaction_index: u64,
    /// Hash of the final assembled transaction message.
    pub final_buffer_hash: [u8; 32],
    /// The size of the final assembled transaction message.
    pub final_buffer_size: u16,
    /// The buffer of the transaction message.
    pub buffer: Vec<u8>,
}

impl TransactionBuffer {
    pub fn size(final_message_buffer_size: u16) -> Result<usize> {
        // Make sure final size is not greater than MAX_BUFFER_SIZE bytes.
        if (final_message_buffer_size as usize) > MAX_BUFFER_SIZE {
            return err!(MultisigError::FinalBufferSizeExceeded);
        }
        Ok(
            8 +   // anchor account discriminator
            32 +  // multisig
            32 +  // creator
            8 +   // vault_index
            8 +   // transaction_index
            32 +  // transaction_message_hash
            2 +  // final_buffer_size
            final_message_buffer_size as usize, // transaction_message
        )
    }

    pub fn validate_hash(&self) -> Result<()> {
        let message_buffer_hash = hash(&self.buffer);
        require!(
            message_buffer_hash.to_bytes() == self.final_buffer_hash,
            MultisigError::FinalBufferHashMismatch
        );
        Ok(())
    }

    pub fn invariant(&self) -> Result<()> {
        require!(
            self.final_buffer_size as usize <= MAX_BUFFER_SIZE,
            MultisigError::FinalBufferSizeExceeded
        );
        require!(
            self.buffer.len() < MAX_BUFFER_SIZE,
            MultisigError::FinalBufferSizeExceeded
        );

        Ok(())
    }
}
