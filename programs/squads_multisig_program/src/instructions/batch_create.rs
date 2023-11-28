use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct BatchCreateArgs {
    /// Index of the vault this transaction belongs to.
    pub vault_index: u8,
    pub memo: Option<String>,
}

#[derive(Accounts)]
pub struct BatchCreate<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = rent_payer,
        space = 8 + Batch::INIT_SPACE,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub batch: Account<'info, Batch>,

    /// The member of the multisig that is creating the batch.
    pub creator: Signer<'info>,

    /// The payer for the batch account rent.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl BatchCreate<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig, creator, ..
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

        Ok(())
    }

    /// Create a new batch.
    #[access_control(ctx.accounts.validate())]
    pub fn batch_create(ctx: Context<Self>, args: BatchCreateArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let creator = &mut ctx.accounts.creator;
        let batch = &mut ctx.accounts.batch;

        let multisig_key = multisig.key();

        // Increment the transaction index.
        let index = multisig.transaction_index.checked_add(1).expect("overflow");

        let vault_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            SEED_VAULT,
            &args.vault_index.to_le_bytes(),
        ];
        let (_, vault_bump) = Pubkey::find_program_address(vault_seeds, ctx.program_id);

        batch.multisig = multisig_key;
        batch.creator = creator.key();
        batch.index = index;
        batch.bump = ctx.bumps.batch;
        batch.vault_index = args.vault_index;
        batch.vault_bump = vault_bump;
        batch.size = 0;
        batch.executed_transaction_index = 0;

        batch.invariant()?;

        // Updated last transaction index in the multisig account.
        multisig.transaction_index = index;

        multisig.invariant()?;

        // Logs for indexing.
        msg!("batch index: {}", index);

        Ok(())
    }
}
