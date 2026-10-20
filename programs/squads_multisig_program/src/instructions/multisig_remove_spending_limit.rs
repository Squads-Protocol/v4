#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::*;
#[cfg(feature = "program")]
use crate::events::{
    self, ConfigSource, LogAuthority, MultisigEvent, SpendingLimitEvent, SpendingLimitEventKind,
};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
#[cfg(feature = "program")]
use crate::state::*;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigRemoveSpendingLimitArgs {
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigRemoveSpendingLimit<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    multisig: Account<'info, Multisig>,

    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Signer<'info>,

    #[account(mut, close = rent_collector)]
    pub spending_limit: Account<'info, SpendingLimit>,

    /// This is usually the same as `config_authority`, but can be a different account if needed.
    /// CHECK: can be any account.
    #[account(mut)]
    pub rent_collector: UncheckedAccount<'info>,
}

#[cfg(feature = "program")]
impl MultisigRemoveSpendingLimit<'_> {
    fn validate(&self) -> Result<()> {
        // config_authority
        require_keys_eq!(
            self.config_authority.key(),
            self.multisig.config_authority,
            MultisigError::Unauthorized
        );

        // `spending_limit`
        require_keys_eq!(
            self.spending_limit.multisig,
            self.multisig.key(),
            MultisigError::InvalidAccount
        );

        Ok(())
    }

    /// Remove the spending limit from the controlled multisig.
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_remove_spending_limit(
        ctx: Context<Self>,
        args: MultisigRemoveSpendingLimitArgs,
    ) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let spending_limit = &ctx.accounts.spending_limit;
        events::emit(
            events::enabled(ctx.remaining_accounts),
            || LogAuthority::multisig(multisig),
            || {
                vec![MultisigEvent::SpendingLimit(SpendingLimitEvent {
                    kind: SpendingLimitEventKind::Remove,
                    multisig: multisig.key(),
                    spending_limit: spending_limit.key(),
                    source: ConfigSource::ConfigAuthority {
                        authority: ctx.accounts.config_authority.key(),
                    },
                    memo: args.memo,
                    snapshot: Some(Cow::Borrowed(spending_limit)),
                })]
            },
        )
    }
}
