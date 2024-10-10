use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
pub struct TransactionBufferClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        // Rent gets returned to the creator
        close = creator,
        // Only the creator can close the buffer
        constraint = transaction_buffer.creator == creator.key() @ MultisigError::Unauthorized,
        // Account can be closed anytime by the creator, regardless of the
        // current multisig transaction index
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION_BUFFER,
            creator.key().as_ref(),
            &transaction_buffer.buffer_index.to_le_bytes()
        ],
        bump
    )]
    pub transaction_buffer: Account<'info, TransactionBuffer>,

    /// The member of the multisig that created the TransactionBuffer.
    pub creator: Signer<'info>,
}

impl TransactionBufferClose<'_> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }

    /// Close a transaction buffer account.
    #[access_control(ctx.accounts.validate())]
    pub fn transaction_buffer_close(ctx: Context<Self>) -> Result<()> {
        Ok(())
    }
}
