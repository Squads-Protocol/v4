use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;
use crate::utils::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TransactionBufferCreateArgs {
    /// Index of the vault this transaction belongs to.
    pub vault_index: u8,
    /// Hash of the final assembled transaction message.
    pub final_buffer_hash: [u8; 32],
    /// Final size of the buffer.
    pub final_buffer_size: u16,
    /// Initial slice of the buffer.
    pub buffer: Vec<u8>,
}

#[derive(Accounts)]
#[instruction(args: TransactionBufferCreateArgs)]
pub struct VaultTransactionCreate<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = rent_payer,
        space = TransactionBuffer::size(args.final_buffer_size)?,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION_BUFFER,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction_buffer: Account<'info, TransactionBuffer>,

    /// The member of the multisig that is creating the transaction.
    pub creator: Signer<'info>,

    /// The payer for the transaction account rent.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl VaultTransactionCreate<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig, creator, ..
        } = self;

        // creator
        require!(
            multisig.is_member(creator.key()).is_some(),
            MultisigError::NotAMember
        );
        // initiator permissions
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
        args: TransactionBufferCreateArgs,
    ) -> Result<()> {
        // Mutable Accounts
        let transaction_buffer = &mut ctx.accounts.transaction_buffer;

        // Readonly Accounts
        let multisig = &ctx.accounts.multisig;
        let creator = &mut ctx.accounts.creator;

        // Get the transaction index.
        let transaction_index = multisig.transaction_index.checked_add(1).unwrap();

        // Initialize the transaction fields.
        transaction_buffer.multisig = multisig.key();
        transaction_buffer.creator = creator.key();
        transaction_buffer.vault_index = args.vault_index;
        transaction_buffer.transaction_index = transaction_index;
        transaction_buffer.final_buffer_hash = args.final_buffer_hash;
        transaction_buffer.buffer = args.buffer;

        Ok(())
    }
}

