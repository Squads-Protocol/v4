use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::*;
use crate::events::ConfigUpdateType;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigAddMemberArgs {
    new_member: Member,
    /// Memo isn't used for anything, but is included in `AddMemberEvent` that can later be parsed and indexed.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigRemoveMemberArgs {
    old_member: Member,
    /// Memo isn't used for anything, but is included in `RemoveMemberEvent` that can later be parsed and indexed.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigChangeThresholdArgs {
    new_threshold: u16,
    /// Memo isn't used for anything, but is included in `ChangeThreshold` that can later be parsed and indexed.
    pub memo: Option<String>,
}

#[derive(Accounts)]
pub struct MultisigConfig<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, multisig.create_key.as_ref(), SEED_MULTISIG],
        bump = multisig.bump,
    )]
    multisig: Account<'info, Multisig>,

    #[account(
        mut,
        constraint = config_authority.key() == multisig.config_authority @ MultisigError::Unauthorized,
    )]
    pub config_authority: Signer<'info>,

    /// We might need it in case reallocation is needed.
    pub system_program: Program<'info, System>,
}

impl MultisigConfig<'_> {
    /// Add a member/key to the multisig and reallocate space if necessary.
    pub fn multisig_add_member(ctx: Context<Self>, args: MultisigAddMemberArgs) -> Result<()> {
        let MultisigAddMemberArgs { new_member, memo } = args;

        let multisig = &mut ctx.accounts.multisig;
        let multisig_key = multisig.to_account_info().key();

        let current_members_length = multisig.members.len();
        let current_account_size = multisig.to_account_info().data.borrow().len();

        // Check if we need to reallocate space.
        let reallocated = if current_account_size < Multisig::size(current_members_length + 1) {
            // We need to allocate more space. To avoid doing this operation too often, we increment it by 10 members.
            let new_size = current_account_size + (10 * Member::size());
            // Reallocate more space.
            AccountInfo::realloc(&multisig.to_account_info(), new_size, false)?;

            // If more lamports are needed, transfer them to the account
            let rent_exempt_lamports = Rent::get().unwrap().minimum_balance(new_size).max(1);
            let top_up_lamports =
                rent_exempt_lamports.saturating_sub(multisig.to_account_info().lamports());
            if top_up_lamports > 0 {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.to_account_info(),
                        system_program::Transfer {
                            from: ctx.accounts.config_authority.to_account_info(),
                            to: multisig.to_account_info(),
                        },
                    ),
                    top_up_lamports,
                )?;
            }
            multisig.reload()?;
            true
        } else {
            false
        };

        multisig.add_member(new_member);

        multisig.invariant()?;

        multisig.config_updated(
            multisig_key,
            ConfigUpdateType::AddMember { reallocated },
            memo,
        );

        Ok(())
    }

    /// Remove a member/key from the multisig.
    pub fn multisig_remove_member(
        ctx: Context<Self>,
        args: MultisigRemoveMemberArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let multisig_key = multisig.to_account_info().key();

        require!(multisig.members.len() > 1, MultisigError::RemoveLastMember);

        let old_member_index = match multisig.is_member(args.old_member.key) {
            Some(old_member_index) => old_member_index,
            None => return err!(MultisigError::NotAMember),
        };

        multisig.members.remove(old_member_index);

        // Update the threshold if necessary.
        if usize::from(multisig.threshold) > multisig.members.len() {
            multisig.threshold = multisig
                .members
                .len()
                .try_into()
                .expect("didn't expect more that `u16::MAX` members");
        }

        multisig.invariant()?;

        multisig.config_updated(multisig_key, ConfigUpdateType::RemoveMember, args.memo);

        Ok(())
    }

    pub fn multisig_change_threshold(
        ctx: Context<Self>,
        args: MultisigChangeThresholdArgs,
    ) -> Result<()> {
        let MultisigChangeThresholdArgs {
            new_threshold,
            memo,
        } = args;

        let multisig = &mut ctx.accounts.multisig;
        let multisig_key = multisig.to_account_info().key();

        multisig.threshold = new_threshold;

        multisig.invariant()?;

        multisig.config_updated(multisig_key, ConfigUpdateType::ChangeThreshold, memo);

        Ok(())
    }
}
