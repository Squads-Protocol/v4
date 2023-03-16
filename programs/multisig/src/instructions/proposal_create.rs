use anchor_lang::prelude::*;

use crate::errors::*;
use crate::events::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProposalCreateArgs {
    /// Index of the multisig transaction this proposal is associated with.
    pub transaction_index: u64,
}

#[derive(Accounts)]
#[instruction(args: ProposalCreateArgs)]
pub struct ProposalCreate<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = rent_payer,
        space = Proposal::size(multisig.members.len()),
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &args.transaction_index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl ProposalCreate<'_> {
    fn validate(&self, args: &ProposalCreateArgs) -> Result<()> {
        let Self { multisig, .. } = self;

        // args
        // We can only create a proposal for an existing transaction.
        require!(
            args.transaction_index <= multisig.transaction_index,
            MultisigError::InvalidTransactionIndex
        );

        // Anyone can create a Proposal account. It's similar to ATA in this regard.
        // We don't require `Permission::Initiate` here because it's already implicitly checked
        // by the fact that a proposal can only be initialized if the corresponding transaction exists,
        // so the transaction initializer "approves" the creation of the proposal implicitly when it creates the transaction.

        Ok(())
    }

    /// Create a new multisig proposal.
    #[access_control(ctx.accounts.validate(&args))]
    pub fn proposal_create(ctx: Context<Self>, args: ProposalCreateArgs) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;

        proposal.multisig = ctx.accounts.multisig.key();
        proposal.transaction_index = args.transaction_index;
        proposal.status = ProposalStatus::Active {
            timestamp: Clock::get()?.unix_timestamp,
        };
        proposal.bump = *ctx.bumps.get("proposal").unwrap();
        proposal.approved = vec![];
        proposal.rejected = vec![];
        proposal.cancelled = vec![];

        emit!(ProposalCreated {
            multisig: ctx.accounts.multisig.key(),
            proposal: proposal.key(),
        });

        Ok(())
    }
}
