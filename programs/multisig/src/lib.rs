use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod multisig {
    use super::*;

    /// Creates a multisig.
    pub fn create(ctx: Context<Create>, args: CreateArgs) -> Result<()> {
        // // sort the members and remove duplicates
        // let mut members = members;
        // members.sort();
        // members.dedup();
        //
        // // check we don't exceed u16
        // let total_members = members.len();
        // if total_members < 1 {
        //     return err!(GraphsError::EmptyMembers);
        // }
        //
        // // make sure we don't exceed u16 on first call
        // if total_members > usize::from(u16::MAX) {
        //     return err!(GraphsError::MaxMembersReached);
        // }
        //
        // // make sure threshold is valid
        // if usize::from(threshold) < 1 || usize::from(threshold) > total_members {
        //     return err!(GraphsError::InvalidThreshold);
        // }
        //
        // ctx.accounts.multisig.init(
        //     external_authority,
        //     threshold,
        //     create_key,
        //     members,
        //     *ctx.bumps.get("multisig").unwrap(),
        // )

        emit!(CreatedEvent {
            multisig: ctx.accounts.creator.to_account_info().key.clone(),
            memo: args.memo,
        });

        Ok(())
    }
    //
    // pub fn add_member(ctx: Context<MsAuthRealloc>, new_member: Pubkey) -> Result<()> {
    //     // if max is already reached, we can't have more members
    //     if ctx.accounts.multisig.keys.len() >= usize::from(u16::MAX) {
    //         return err!(MsError::MaxMembersReached);
    //     }
    //
    //     // check if realloc is needed
    //     let multisig_account_info = ctx.accounts.multisig.to_account_info();
    //     if *multisig_account_info.owner != squads_mpl::ID {
    //         return err!(MsError::InvalidInstructionAccount);
    //     }
    //     let curr_data_size = multisig_account_info.data.borrow().len();
    //     let spots_left = ((curr_data_size - Ms::SIZE_WITHOUT_MEMBERS) / 32 ) - ctx.accounts.multisig.keys.len();
    //
    //     // if not enough, add (10 * 32) to size - bump it up by 10 accounts
    //     if spots_left < 1 {
    //         // add space for 10 more keys
    //         let needed_len = curr_data_size + ( 10 * 32 );
    //         // reallocate more space
    //         AccountInfo::realloc(&multisig_account_info, needed_len, false)?;
    //         // if more lamports are needed, transfer them to the account
    //         let rent_exempt_lamports = ctx.accounts.rent.minimum_balance(needed_len).max(1);
    //         let top_up_lamports = rent_exempt_lamports.saturating_sub(ctx.accounts.multisig.to_account_info().lamports());
    //         if top_up_lamports > 0 {
    //             invoke(
    //                 &transfer(ctx.accounts.member.key, &ctx.accounts.multisig.key(), top_up_lamports),
    //                 &[
    //                     ctx.accounts.member.to_account_info().clone(),
    //                     multisig_account_info.clone(),
    //                     ctx.accounts.system_program.to_account_info().clone(),
    //                 ],
    //             )?;
    //         }
    //     }
    //     ctx.accounts.multisig.reload()?;
    //     ctx.accounts.multisig.add_member(new_member)?;
    //     let new_index = ctx.accounts.multisig.transaction_index;
    //     ctx.accounts.multisig.set_change_index(new_index)
    // }
    //
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

#[derive(Accounts)]
#[instruction(args: CreateArgs)]
pub struct Create<'info> {
    // #[account(
    //     init,
    //     payer = creator,
    //     space = Ms::SIZE_WITHOUT_MEMBERS + (members.len() * 32),
    //     seeds = [b"squad", create_key.as_ref(), b"multisig"], bump
    // )]
    // pub multisig: Account<'info, Ms>,
    /// The creator of the multisig.
    #[account(mut)]
    pub creator: Signer<'info>,
    // pub system_program: Program<'info, System>
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CreateArgs {
    /// The authority that can configure the multisig: add/remove members, change the threshold, etc.
    config_authority: Pubkey,
    /// The number of signatures required to execute a transaction.
    threshold: u16,
    /// Any key that is used to seed the multisig pda. Used solely as bytes for the seed, doesn't have any other meaning.
    create_key: Pubkey,
    /// The members of the multisig.
    members: Vec<Pubkey>,
    /// Memo isn't used for anything, but is included in `CreatedEvent` that can later be parsed and indexed.
    memo: Option<String>,
}

#[event]
pub struct CreatedEvent {
    /// The multisig account.
    pub multisig: Pubkey,
    #[index]
    /// Memo that was added by the creator.
    pub memo: Option<String>,
}

// #[derive(Accounts)]
// pub struct Initialize {}
//
//
// #[account]
// pub struct Ms {
//     pub threshold: u16,                 // threshold for signatures
//     pub authority_index: u16,           // index to seed other authorities under this multisig
//     pub transaction_index: u32,         // look up and seed reference for transactions
//     pub ms_change_index: u32,           // the last executed/closed transaction
//     pub bump: u8,                       // bump for the multisig seed
//     pub create_key: Pubkey,             // random key(or not) used to seed the multisig pda
//     pub allow_external_execute: bool,   // allow non-member keys to execute txs
//     pub keys: Vec<Member>,              // keys of the members
//     pub config_authority: Pubkey               // the external multisig authority
// }
//
// #[derive(AnchorDeserialize, AnchorSerialize)]
// pub struct Member {
//     pub key: Pubkey,
//     pub role: Role,
// }
//
// #[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Debug)]
// pub enum Role {
//     All,
//     Initiate,
//     Vote,
//     Execute,
//     InitiateAndExecute,
//     InitiateAndVote,
//     VoteAndExecute,
// }
//
// impl Role {
//     pub const MAXIMUM_SIZE: usize = 1 + 18;
// }
//
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
