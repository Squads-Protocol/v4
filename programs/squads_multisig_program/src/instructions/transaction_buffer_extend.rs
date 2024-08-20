use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;
use crate::utils::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TransactionBufferExtendArgs {
    // Buffer to extend the TransactionBuffer with.
    pub buffer: Vec<u8>,
}

#[derive(Accounts)]
#[instruction(args: TransactionBufferExtendArgs)]
pub struct TransactionBufferExtend<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        // Only the creator can extend the buffer
        constraint = transaction_buffer.creator == creator.key(),
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION_BUFFER,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction_buffer: Account<'info, TransactionBuffer>,

    /// The member of the multisig that created the TransactionBuffer.
    pub creator: Signer<'info>,
}

impl TransactionBufferExtend<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig, creator, ..
        } = self;

        // creator is still a member in the multisig
        require!(
            multisig.is_member(creator.key()).is_some(),
            MultisigError::NotAMember
        );

        // creator still has initiate permissions
        require!(
            multisig.member_has_permission(creator.key(), Permission::Initiate),
            MultisigError::Unauthorized
        );

        Ok(())
    }

    /// Create a new vault transaction.
    #[access_control(ctx.accounts.validate())]
    pub fn transaction_buffer_create(
        ctx: Context<Self>,
        args: TransactionBufferExtendArgs,
    ) -> Result<()> {
        // Mutable Accounts
        let transaction_buffer = &mut ctx.accounts.transaction_buffer;

        // Required Data
        let buffer_slice_extension = args.buffer;
        
        // Extend the Buffer inside the TransactionBuffer
        transaction_buffer
            .buffer
            .extend_from_slice(&buffer_slice_extension);

        // Invariant function on the transaction buffer
        transaction_buffer.invariant()?;

        Ok(())
    }
}
