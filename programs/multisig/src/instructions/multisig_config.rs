use anchor_lang::prelude::*;
use anchor_spl::token::Mint;

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
    new_threshold: u16,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigSetTimeLockArgs {
    time_lock: u32,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigSetConfigAuthorityArgs {
    config_authority: Pubkey,
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

        let system_program = &ctx
            .accounts
            .system_program
            .as_ref()
            .ok_or(MultisigError::MissingAccount)?;
        let rent_payer = &ctx
            .accounts
            .rent_payer
            .as_ref()
            .ok_or(MultisigError::MissingAccount)?;
        let multisig = &mut ctx.accounts.multisig;

        // Check if we need to reallocate space.
        let reallocated = Multisig::realloc_if_needed(
            multisig.to_account_info(),
            multisig.members.len() + 1,
            rent_payer.to_account_info(),
            system_program.to_account_info(),
        )?;

        if reallocated {
            multisig.reload()?;
        }

        multisig.add_member(new_member);

        multisig.invariant()?;

        multisig.invalidate_prior_transactions();

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

        // Update the threshold if necessary.
        if usize::from(multisig.threshold) > multisig.members.len() {
            multisig.threshold = multisig
                .members
                .len()
                .try_into()
                .expect("didn't expect more that `u16::MAX` members");
        };

        multisig.invariant()?;

        multisig.invalidate_prior_transactions();

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

        multisig.invariant()?;

        multisig.invalidate_prior_transactions();

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

        multisig.invariant()?;

        multisig.invalidate_prior_transactions();

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

        multisig.invariant()?;

        multisig.invalidate_prior_transactions();

        Ok(())
    }

    // /// Create a new spending limit for a vault.
    // /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    // ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    // #[access_control(ctx.accounts.validate(&args))]
    // pub fn multisig_add_spending_limit(
    //     ctx: Context<Self>,
    //     args: MultisigAddSpendingLimitArgs,
    // ) -> Result<()> {
    //     todo!()
    // }
}
