use anchor_lang::prelude::*;

use crate::errors::*;
use crate::events::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigCreateArgs {
    /// The authority that can configure the multisig: add/remove members, change the threshold, etc.
    pub config_authority: Pubkey,
    /// The number of signatures required to execute a transaction.
    pub threshold: u16,
    /// The members of the multisig.
    pub members: Vec<Member>,
    /// Any key that is used to seed the multisig pda. Used solely as bytes for the seed, doesn't have any other meaning.
    pub create_key: Pubkey,
    /// Memo isn't used for anything, but is included in `CreatedEvent` that can later be parsed and indexed.
    pub memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: MultisigCreateArgs)]
pub struct MultisigCreate<'info> {
    #[account(
        init,
        payer = creator,
        space = Multisig::size(args.members.len()),
        seeds = [SEED_PREFIX, args.create_key.as_ref(), SEED_MULTISIG],
        bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// The creator of the multisig.
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl MultisigCreate<'_> {
    /// Creates a multisig.
    pub fn multisig_create(ctx: Context<Self>, args: MultisigCreateArgs) -> Result<()> {
        // Sort the members by pubkey.
        let mut members = args.members;
        members.sort_by_key(|m| m.key);

        // Make sure there is no members with duplicate keys.
        for i in (1..members.len()).rev() {
            if members[i].key == members[i - 1].key {
                err!(MultisigError::DuplicateMember)?;
            }
        }

        // Make sure length of members is within bounds.
        let num_members = members.len();
        let max_members = usize::from(u16::MAX);
        require!(num_members > 0, MultisigError::EmptyMembers);
        require!(num_members <= max_members, MultisigError::TooManyMembers);

        // Make sure threshold is within bounds.
        let threshold = usize::from(args.threshold);
        let num_voters = Multisig::num_voters(&members);
        require!(threshold > 0, MultisigError::InvalidThreshold);
        require!(threshold <= num_voters, MultisigError::InvalidThreshold);

        // Initialize the multisig.
        let multisig = &mut ctx.accounts.multisig;
        multisig.config_authority = args.config_authority;
        multisig.threshold = args.threshold;
        multisig.members = members;
        multisig.authority_index = 1; // Default vault is the first authority.
        multisig.transaction_index = 0;
        multisig.stale_transaction_index = 0;
        multisig.create_key = args.create_key;
        multisig.bump = *ctx.bumps.get("multisig").unwrap();

        multisig.invariant()?;

        emit!(MultisigCreated {
            multisig: multisig.to_account_info().key(),
            memo: args.memo,
        });

        Ok(())
    }
}
