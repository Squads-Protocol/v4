#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::*;
#[cfg(feature = "program")]
use crate::events::{
    self, LogAuthority, MultisigEvent, TransactionContent, TransactionEvent, TransactionEventKind,
};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
use crate::state::*;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct ConfigTransactionCreateArgs {
    pub actions: Vec<ConfigAction>,
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
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

#[cfg(feature = "program")]
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

        let multisig = &ctx.accounts.multisig;
        let transaction = &ctx.accounts.transaction;
        events::emit(
            events::enabled(ctx.remaining_accounts),
            || LogAuthority::multisig(multisig),
            || {
                vec![MultisigEvent::Transaction(TransactionEvent {
                    kind: TransactionEventKind::Create,
                    multisig: multisig.key(),
                    transaction: transaction.key(),
                    transaction_index,
                    member: Some(ctx.accounts.creator.key()),
                    memo: args.memo,
                    content: Some(TransactionContent::Config(Cow::Borrowed(transaction))),
                })]
            },
        )
    }
}
