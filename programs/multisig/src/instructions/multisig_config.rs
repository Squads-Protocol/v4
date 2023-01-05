use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::*;
use crate::events::ConfigUpdateType;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigAddMemberArgs {
    new_member: Member,
    /// Memo isn't used for anything, but is included in `CreatedEvent` that can later be parsed and indexed.
    pub memo: Option<String>,
}

#[derive(Accounts)]
pub struct MultisigConfig<'info> {
    #[account(
        mut,
        seeds = [b"multisig", multisig.create_key.as_ref(), b"multisig"],
        bump = multisig.bump,
        has_one = config_authority @ MultisigError::Unauthorized,
    )]
    multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub config_authority: Signer<'info>,

    /// We might need it in case reallocation is needed.
    pub system_program: Program<'info, System>,
}

impl MultisigConfig<'_> {
    /// Add a member/key to the multisig and reallocate space if necessary.
    pub fn multisig_add_member(ctx: Context<Self>, args: MultisigAddMemberArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;

        let MultisigAddMemberArgs { new_member, memo } = args;

        require!(
            multisig.is_member(new_member.key).is_none(),
            MultisigError::MemberAlreadyExists
        );

        let current_members_length = multisig.members.len();
        // If max is already reached, we can't have more members.
        require!(
            current_members_length < usize::from(u16::MAX),
            MultisigError::MaxMembersReached
        );

        let current_account_size = multisig.to_account_info().data.borrow().len();
        // Check if we need to reallocate space.
        let reallocated = if current_account_size < Multisig::size(current_members_length + 1) {
            // We need to allocate more space. To avoid doing this operation too often, we increment it by 10 members.
            let new_size = current_account_size + (10 * Member::size());
            // Reallocate more space
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

        multisig.add_member_if_not_exists(new_member);

        let multisig_key = multisig.to_account_info().key();
        multisig.config_updated(
            multisig_key,
            ConfigUpdateType::AddMember { reallocated },
            memo,
        );

        Ok(())
    }
}
