use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;
use crate::TransactionMessage;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VaultTransactionCreateFromBufferArgs {
    /// Number of ephemeral signing PDAs required by the transaction.
    pub ephemeral_signers: u8,
    /// Optional Memo
    pub memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: VaultTransactionCreateFromBufferArgs)]
pub struct VaultTransactionCreateFromBuffer<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        close = creator,
        // Only the creator of the buffer can create a VaultTransaction from it
        constraint = transaction_buffer.creator == creator.key(),
            seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION_BUFFER,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction_buffer: Box<Account<'info, TransactionBuffer>>,

    #[account(
        init,
        payer = rent_payer,
        space = VaultTransaction::size(args.ephemeral_signers, &transaction_buffer.buffer)?,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction: Account<'info, VaultTransaction>,

    /// The member of the multisig that is creating the transaction.
    pub creator: Signer<'info>,

    /// The payer for the transaction account rent.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl VaultTransactionCreateFromBuffer<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig,
            creator,
            transaction_buffer,
            ..
        } = self;

        // creator
        require!(
            multisig.is_member(creator.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            multisig.member_has_permission(creator.key(), Permission::Initiate),
            MultisigError::Unauthorized
        );

        // Transaction buffer hash validation
        transaction_buffer.validate_hash()?;
        // Transaction buffer size validation
        transaction_buffer.validate_size()?;

        Ok(())
    }

    /// Create a new vault transaction.
    #[access_control(ctx.accounts.validate())]
    pub fn vault_transaction_create_from_buffer(
        ctx: Context<Self>,
        args: VaultTransactionCreateFromBufferArgs,
    ) -> Result<()> {
        // Mutable Accounts
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let transaction_buffer = &mut ctx.accounts.transaction_buffer;

        // Readonly Accounts
        let creator = &mut ctx.accounts.creator;

        // Data
        let vault_index = transaction_buffer.vault_index;

        let transaction_message =
            TransactionMessage::deserialize(&mut transaction_buffer.buffer.as_slice())?;

        let multisig_key = multisig.key();
        let transaction_key = transaction.key();

        let vault_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            SEED_VAULT,
            &vault_index.to_le_bytes(),
        ];
        let (_, vault_bump) = Pubkey::find_program_address(vault_seeds, ctx.program_id);

        let ephemeral_signer_bumps: Vec<u8> = (0..args.ephemeral_signers)
            .map(|ephemeral_signer_index| {
                let ephemeral_signer_seeds = &[
                    SEED_PREFIX,
                    transaction_key.as_ref(),
                    SEED_EPHEMERAL_SIGNER,
                    &ephemeral_signer_index.to_le_bytes(),
                ];

                let (_, bump) =
                    Pubkey::find_program_address(ephemeral_signer_seeds, ctx.program_id);
                bump
            })
            .collect();

        // Increment the transaction index.
        let transaction_index = multisig.transaction_index.checked_add(1).unwrap();

        // Initialize the transaction fields.
        transaction.multisig = multisig_key;
        transaction.creator = creator.key();
        transaction.index = transaction_index;
        transaction.bump = ctx.bumps.transaction;
        transaction.vault_index = vault_index;
        transaction.vault_bump = vault_bump;
        transaction.ephemeral_signer_bumps = ephemeral_signer_bumps;
        transaction.message = transaction_message.try_into()?;

        // Updated last transaction index in the multisig account.
        multisig.transaction_index = transaction_index;

        multisig.invariant()?;

        // Logs for indexing.
        msg!("transaction index: {}", transaction_index);

        Ok(())
    }
}
