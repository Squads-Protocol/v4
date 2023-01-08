use anchor_lang::prelude::*;

use instructions::*;

mod errors;
mod events;
mod instructions;
mod state;
mod utils;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod multisig {
    use super::*;

    /// Create a multisig.
    pub fn multisig_create(ctx: Context<MultisigCreate>, args: MultisigCreateArgs) -> Result<()> {
        MultisigCreate::multisig_create(ctx, args)
    }

    /// Add a new member to the multisig.
    pub fn multisig_add_member(
        ctx: Context<MultisigConfig>,
        args: MultisigAddMemberArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_add_member(ctx, args)
    }

    /// Create a new multisig transaction.
    pub fn transaction_create(
        ctx: Context<TransactionCreate>,
        args: TransactionCreateArgs,
    ) -> Result<()> {
        TransactionCreate::transaction_create(ctx, args)
    }

    /// Approve the transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn transaction_approve(
        ctx: Context<TransactionVote>,
        args: TransactionVoteArgs,
    ) -> Result<()> {
        TransactionVote::transaction_approve(ctx, args)
    }

    // // instruction to remove a member/key from the multisig
    // pub fn remove_member(ctx: Context<MsAuth>, old_member: Pubkey) -> Result<()> {
    //     // if there is only one key in this multisig, reject the removal
    //     if ctx.accounts.multisig.keys.len() == 1 {
    //         return err!(MsError::CannotRemoveSoloMember);
    //     }
    //     ctx.accounts.multisig.remove_member(old_member)?;
    //
    //     // if the number of keys is now less than the threshold, adjust it
    //     if ctx.accounts.multisig.keys.len() < usize::from(ctx.accounts.multisig.threshold) {
    //         let new_threshold: u16 = ctx.accounts.multisig.keys.len().try_into().unwrap();
    //         ctx.accounts.multisig.change_threshold(new_threshold)?;
    //     }
    //     let new_index = ctx.accounts.multisig.transaction_index;
    //     ctx.accounts.multisig.set_change_index(new_index)
    // }
    //
    // // instruction to remove a member/key from the multisig and change the threshold
    // pub fn remove_member_and_change_threshold<'info>(
    //     ctx: Context<'_,'_,'_,'info, MsAuth<'info>>, old_member: Pubkey, new_threshold: u16
    // ) -> Result<()> {
    //     remove_member(
    //         Context::new(
    //             ctx.program_id,
    //             ctx.accounts,
    //             ctx.remaining_accounts,
    //             ctx.bumps.clone()
    //         ), old_member
    //     )?;
    //     change_threshold(ctx, new_threshold)
    // }
    //
    // // instruction to add a member/key from the multisig and change the threshold
    // pub fn add_member_and_change_threshold<'info>(
    //     ctx: Context<'_,'_,'_,'info, MsAuthRealloc<'info>>, new_member: Pubkey, new_threshold: u16
    // ) -> Result<()> {
    //     // add the member
    //     add_member(
    //         Context::new(
    //             ctx.program_id,
    //             ctx.accounts,
    //             ctx.remaining_accounts,
    //             ctx.bumps.clone()
    //         ), new_member
    //     )?;
    //
    //     // check that the threshold value is valid
    //     if ctx.accounts.multisig.keys.len() < usize::from(new_threshold) {
    //         let new_threshold: u16 = ctx.accounts.multisig.keys.len().try_into().unwrap();
    //         ctx.accounts.multisig.change_threshold(new_threshold)?;
    //     } else if new_threshold < 1 {
    //         return err!(MsError::InvalidThreshold);
    //     } else {
    //         ctx.accounts.multisig.change_threshold(new_threshold)?;
    //     }
    //     let new_index = ctx.accounts.multisig.transaction_index;
    //     ctx.accounts.multisig.set_change_index(new_index)
    // }
    //
    // // instruction to change the threshold
    // pub fn change_threshold(ctx: Context<MsAuth>, new_threshold: u16) -> Result<()> {
    //     // if the new threshold value is valid
    //     if ctx.accounts.multisig.keys.len() < usize::from(new_threshold) {
    //         let new_threshold: u16 = ctx.accounts.multisig.keys.len().try_into().unwrap();
    //         ctx.accounts.multisig.change_threshold(new_threshold)?;
    //     } else if new_threshold < 1 {
    //         return err!(MsError::InvalidThreshold);
    //     } else {
    //         ctx.accounts.multisig.change_threshold(new_threshold)?;
    //     }
    //     let new_index = ctx.accounts.multisig.transaction_index;
    //     ctx.accounts.multisig.set_change_index(new_index)
    // }
}

// #[derive(Accounts)]
// pub struct MsAuth<'info> {
//     #[account(
//         mut,
//         seeds = [
//             b"squad",
//             multisig.create_key.as_ref(),
//             b"multisig"
//         ], bump = multisig.bump,
//         constraint = multisig.external_authority == external_authority.key() @GraphsError::InvalidExternalAuthority
//     )]
//     multisig: Box<Account<'info, Ms>>,
//     #[account(mut)]
//     pub external_authority: Signer<'info>,
// }
//
// #[derive(Accounts)]
// pub struct MsAuthRealloc<'info> {
//     #[account(
//         mut,
//         seeds = [
//             b"squad",
//             multisig.create_key.as_ref(),
//             b"multisig"
//         ], bump = multisig.bump,
//         constraint = multisig.external_authority == external_authority.key() @GraphsError::InvalidExternalAuthority
//     )]
//     multisig: Box<Account<'info, Ms>>,
//     #[account(mut)]
//     pub external_authority: Signer<'info>,
//     pub rent: Sysvar<'info, Rent>,
//     pub system_program: Program<'info, System>
// }
//

/*
    THIS WOULD BE A VALIDATION FUNCTIOn
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &user.role_index.to_le_bytes(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote @RolesError::InvalidRole
    )]
    pub user: Account<'info, Member>,
*/

/* TX META

pub mod txmeta {
    use super::*;

    #[access_control(Track::validate(&ctx))]
    pub fn track_meta(ctx: Context<Track>, meta: String) -> Result<()> {
        let remaining = ctx.remaining_accounts;
        remaining.iter().for_each(|account| {
            msg!("Account: {:?}", account.key());
        });
        msg!("Track Meta: {:?}", meta);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Track<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

    #[account(constraint = multisig.to_account_info().owner == &squads_mpl::ID @ ErrorCode::InvalidOwner)]
    pub multisig: Account<'info, Ms>,

    #[account(constraint = transaction.to_account_info().owner == &squads_mpl::ID @ ErrorCode::InvalidOwner)]
    pub transaction: Account<'info, MsTransaction>,
}

impl<'info> Track<'info> {
    fn validate(ctx: &Context<Track>) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let signer = &ctx.accounts.member;
        let transaction = &ctx.accounts.transaction;

        // Check to make sure that the signer is a member of the supplied [squads_mpl::state::Ms] account
        match multisig.is_member(signer.key()) {
            Some(_) => {
                // Check to make sure the signer is the creator of the supplied [squads_mpl::state::MsTransaction] account
                // and that the transaction comes from the supplied [squads_mpl::state::Ms] account
                if transaction.creator == signer.key() && transaction.ms == multisig.key() {
                    return Ok(());
                };
                return err!(ErrorCode::InvalidTransaction);
            }
            None => err!(ErrorCode::Unauthorized),
        }
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Signer is not a member of the specified multisig.")]
    Unauthorized,
    #[msg("The owner of the account is not the expected program.")]
    InvalidOwner,
    #[msg("The transaction is either not associated with the supplied multisig or it's creator is not the supplied signer")]
    InvalidTransaction,
}
*/
