use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigAddMemberArgs {
    pub new_member: Member,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigRemoveMemberArgs {
    pub old_member: Pubkey,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigChangeThresholdArgs {
    pub new_threshold: u16,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigSetTimeLockArgs {
    pub time_lock: u32,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigSetConfigAuthorityArgs {
    pub config_authority: Pubkey,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigSetRentCollectorArgs {
    pub rent_collector: Option<Pubkey>,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

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

impl MultisigConfig<'_> {
    fn validate(&self) -> Result<()> {
        require_keys_eq!(
            self.config_authority.key(),
            self.multisig.config_authority,
            MultisigError::Unauthorized
        );

        Ok(())
    }

    /// Add a member/key to the multisig and reallocate space if necessary.
    ///
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_add_member(ctx: Context<Self>, args: MultisigAddMemberArgs) -> Result<()> {
        let MultisigAddMemberArgs { new_member, .. } = args;

        let multisig = &mut ctx.accounts.multisig;

        // Make sure that the new member is not already in the multisig.
        require!(
            multisig.is_member(new_member.key).is_none(),
            MultisigError::DuplicateMember
        );

        multisig.add_member(new_member);

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

        Ok(())
    }

    /// Remove a member/key from the multisig.
    ///
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
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

        Ok(())
    }

    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_change_threshold(
        ctx: Context<Self>,
        args: MultisigChangeThresholdArgs,
    ) -> Result<()> {
        let MultisigChangeThresholdArgs { new_threshold, .. } = args;

        let multisig = &mut ctx.accounts.multisig;

        multisig.threshold = new_threshold;

        multisig.invalidate_prior_transactions();

        multisig.invariant()?;

        Ok(())
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

        Ok(())
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

        Ok(())
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

        Ok(())
    }
}
