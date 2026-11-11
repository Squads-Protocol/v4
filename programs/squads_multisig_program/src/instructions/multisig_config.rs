#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::*;
#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use crate::events::{
    self, ConfigAuthorityChangeEvent, ConfigSource, LogAuthority, MultisigConfigEvent,
    MultisigEvent,
};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
use crate::state::*;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigAddMemberArgs {
    pub new_member: Member,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigRemoveMemberArgs {
    pub old_member: Pubkey,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigChangeThresholdArgs {
    pub new_threshold: u16,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigSetTimeLockArgs {
    pub time_lock: u32,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigSetConfigAuthorityArgs {
    pub config_authority: Pubkey,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigSetRentCollectorArgs {
    pub rent_collector: Option<Pubkey>,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigConfig<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    multisig: Account<'info, Multisig>,

    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Signer<'info>,

    /// The account that will be charged or credited in case the multisig account needs to reallocate space,
    /// for example when adding a new member or a spending limit.
    /// This is usually the same as `config_authority`, but can be a different account if needed.
    #[account(mut)]
    pub rent_payer: Option<Signer<'info>>,

    /// We might need it in case reallocation is needed.
    pub system_program: Option<Program<'info, System>>,
}

#[cfg(feature = "program")]
impl MultisigConfig<'_> {
    fn validate(&self) -> Result<()> {
        require_keys_eq!(
            self.config_authority.key(),
            self.multisig.config_authority,
            MultisigError::Unauthorized
        );

        Ok(())
    }

    fn emit_config_event(
        ctx: &Context<Self>,
        action: ConfigAction,
        memo: Option<String>,
    ) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        events::emit(
            events::enabled(ctx.remaining_accounts),
            || LogAuthority::multisig(multisig),
            || {
                vec![MultisigEvent::MultisigConfig(MultisigConfigEvent {
                    multisig: multisig.key(),
                    source: ConfigSource::ConfigAuthority {
                        authority: ctx.accounts.config_authority.key(),
                    },
                    actions: Cow::Owned(vec![action]),
                    memo,
                    snapshot: Some(Cow::Borrowed(multisig)),
                })]
            },
        )
    }

    /// Add a member/key to the multisig and reallocate space if necessary.
    ///
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_add_member(ctx: Context<Self>, args: MultisigAddMemberArgs) -> Result<()> {
        let MultisigAddMemberArgs { new_member, memo } = args;

        let multisig = &mut ctx.accounts.multisig;

        // Make sure that the new member is not already in the multisig.
        require!(
            multisig.is_member(new_member.key).is_none(),
            MultisigError::DuplicateMember
        );

        multisig.add_member(new_member.clone());

        // Make sure the multisig account can fit the newly set rent_collector.
        Multisig::realloc_if_needed(
            multisig.to_account_info(),
            multisig.members.len(),
            ctx.accounts
                .rent_payer
                .as_ref()
                .map(ToAccountInfo::to_account_info),
            ctx.accounts
                .system_program
                .as_ref()
                .map(ToAccountInfo::to_account_info),
        )?;

        multisig.invalidate_prior_transactions();

        multisig.invariant()?;

        Self::emit_config_event(&ctx, ConfigAction::AddMember { new_member }, memo)
    }

    /// Remove a member/key from the multisig.
    ///
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    /// NOTE: Removing a member from the multisig does NOT revoke any Spending Limit access.
    ///       Spending Limit membership is tracked independently (see `SpendingLimit::members`);
    ///       to revoke a member's Spending Limit access, update the relevant Spending Limit(s).
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_remove_member(
        ctx: Context<Self>,
        args: MultisigRemoveMemberArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;

        require!(multisig.members.len() > 1, MultisigError::RemoveLastMember);

        multisig.remove_member(args.old_member)?;

        multisig.invalidate_prior_transactions();

        multisig.invariant()?;

        Self::emit_config_event(
            &ctx,
            ConfigAction::RemoveMember {
                old_member: args.old_member,
            },
            args.memo,
        )
    }

    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_change_threshold(
        ctx: Context<Self>,
        args: MultisigChangeThresholdArgs,
    ) -> Result<()> {
        let MultisigChangeThresholdArgs {
            new_threshold,
            memo,
        } = args;

        let multisig = &mut ctx.accounts.multisig;

        multisig.threshold = new_threshold;

        multisig.invalidate_prior_transactions();

        multisig.invariant()?;

        Self::emit_config_event(&ctx, ConfigAction::ChangeThreshold { new_threshold }, memo)
    }

    /// Set the `time_lock` config parameter for the multisig.
    ///
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_set_time_lock(ctx: Context<Self>, args: MultisigSetTimeLockArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;

        multisig.time_lock = args.time_lock;

        multisig.invalidate_prior_transactions();

        multisig.invariant()?;

        Self::emit_config_event(
            &ctx,
            ConfigAction::SetTimeLock {
                new_time_lock: args.time_lock,
            },
            args.memo,
        )
    }

    /// Set the multisig `config_authority`.
    ///
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_set_config_authority(
        ctx: Context<Self>,
        args: MultisigSetConfigAuthorityArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;

        multisig.config_authority = args.config_authority;

        multisig.invalidate_prior_transactions();

        multisig.invariant()?;

        let multisig = &ctx.accounts.multisig;
        events::emit(
            events::enabled(ctx.remaining_accounts),
            || LogAuthority::multisig(multisig),
            || {
                vec![MultisigEvent::ConfigAuthorityChange(
                    ConfigAuthorityChangeEvent {
                        multisig: multisig.key(),
                        authority: ctx.accounts.config_authority.key(),
                        new_config_authority: args.config_authority,
                        memo: args.memo,
                        snapshot: Some(Cow::Borrowed(multisig)),
                    },
                )]
            },
        )
    }

    /// Set the multisig `rent_collector` and reallocate space if necessary.
    ///
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_set_rent_collector(
        ctx: Context<Self>,
        args: MultisigSetRentCollectorArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;

        multisig.rent_collector = args.rent_collector;

        // Make sure the multisig account can fit the newly set rent_collector.
        Multisig::realloc_if_needed(
            multisig.to_account_info(),
            multisig.members.len(),
            ctx.accounts
                .rent_payer
                .as_ref()
                .map(ToAccountInfo::to_account_info),
            ctx.accounts
                .system_program
                .as_ref()
                .map(ToAccountInfo::to_account_info),
        )?;

        // We don't need to invalidate prior transactions here because changing
        // `rent_collector` doesn't affect the consensus parameters of the multisig.

        multisig.invariant()?;

        Self::emit_config_event(
            &ctx,
            ConfigAction::SetRentCollector {
                new_rent_collector: args.rent_collector,
            },
            args.memo,
        )
    }
}
