use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VersionedProposalCreateArgs {
    /// Index of the multisig transaction this proposal is associated with.
    pub transaction_index: u64,
}


#[derive(Accounts)]
#[instruction(args: VersionedProposalCreateArgs)]
pub struct CreateVersionedProposal<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, VersionedMultisig>,
    
    #[account(
        init,
        payer = payer,
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
    pub creator: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateVersionedProposal>, args: VersionedProposalCreateArgs ) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    let proposal = &mut ctx.accounts.proposal;
    
    // Verify creator is eligible to create proposals
    require!(
        multisig.members.iter().any(|m| 
            m.key == ctx.accounts.creator.key() && 
            m.permissions.has(Permission::Initiate)
        ),
        VersionedMultisigError::Unauthorized
    );

    // We can only create a proposal for an existing transaction.
    require!(
        args.transaction_index <= multisig.transaction_index,
        VersionedMultisigError::InvalidTransactionIndex
    );

    
    // Set up proposal
    proposal.multisig = multisig.key();
    proposal.bump = ctx.bumps.proposal;
    proposal.transaction_index = args.transaction_index;
    proposal.status = ProposalStatus::Active { timestamp: Clock::get()?.unix_timestamp };
    proposal.approved = vec![];
    proposal.rejected = vec![];
    proposal.cancelled = vec![];
    proposal.proposer = ctx.accounts.creator.key();
    //Increment proposal index
    multisig.current_proposal_index += 1;

    msg!("Proposal created: {}", proposal.key().to_string());
    msg!("New proposal index: {}", multisig.current_proposal_index);
    Ok(())
} 