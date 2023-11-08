use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ConfigTransactionCreateArgs {
    pub actions: Vec<ConfigAction>,
    pub memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: ConfigTransactionCreateArgs)]
pub struct ConfigTransactionCreate<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = rent_payer,
        space = ConfigTransaction::size(&args.actions),
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction: Account<'info, ConfigTransaction>,

    /// The member of the multisig that is creating the transaction.
    pub creator: Signer<'info>,

    /// The payer for the transaction account rent.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl ConfigTransactionCreate<'_> {
    fn validate(&self, args: &ConfigTransactionCreateArgs) -> Result<()> {
        // multisig
        require_keys_eq!(
            self.multisig.config_authority,
            Pubkey::default(),
            MultisigError::NotSupportedForControlled
        );

        // creator
        require!(
            self.multisig.is_member(self.creator.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            self.multisig
                .member_has_permission(self.creator.key(), Permission::Initiate),
            MultisigError::Unauthorized
        );

        // args

        // Config transaction must have at least one action
        require!(!args.actions.is_empty(), MultisigError::NoActions);

        // time_lock must not exceed the maximum allowed.
        for action in &args.actions {
            if let ConfigAction::SetTimeLock { new_time_lock, .. } = action {
                require!(
                    *new_time_lock <= MAX_TIME_LOCK,
                    MultisigError::TimeLockExceedsMaxAllowed
                );
            }
        }

        Ok(())
    }

    /// Create a new config transaction.
    #[access_control(ctx.accounts.validate(&args))]
    pub fn config_transaction_create(
        ctx: Context<Self>,
        args: ConfigTransactionCreateArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let creator = &mut ctx.accounts.creator;

        let multisig_key = multisig.key();

        // Increment the transaction index.
        let transaction_index = multisig.transaction_index.checked_add(1).unwrap();

        // Initialize the transaction fields.
        transaction.multisig = multisig_key;
        transaction.creator = creator.key();
        transaction.index = transaction_index;
        transaction.bump = ctx.bumps.transaction;
        transaction.actions = args.actions;

        // Updated last transaction index in the multisig account.
        multisig.transaction_index = transaction_index;

        multisig.invariant()?;

        // Logs for indexing.
        msg!("transaction index: {}", transaction_index);

        Ok(())
    }
}
