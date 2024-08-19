use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

use crate::errors::MultisigError;

#[account]
#[derive(Default)]
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
    /// The buffer of the transaction message.
    pub buffer: Vec<u8>,
}

impl TransactionBuffer {
    pub fn size(final_message_buffer_size: u16) -> Result<usize> {
        // Make sure final size is not greater than 10_000 bytes.
        if (final_message_buffer_size as usize) > 10_000 {
            return err!(MultisigError::FinalBufferSizeExceeded);
        }
        Ok(
            8 +   // anchor account discriminator
            32 +  // multisig
            32 +  // creator
            8 +   // vault_index
            8 +   // transaction_index
            32 +  // transaction_message_hash
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
}
