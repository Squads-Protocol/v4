use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct CreateVersionedProposal<'info> {
    #[account(mut)]
    pub multisig: Account<'info, VersionedMultisig>,
    
    #[account(
        init,
        payer = creator,
        space = Proposal::size(multisig.members.len()),
        seeds = [
            b"proposal",
            multisig.key().as_ref(),
            multisig.current_proposal_index.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub proposal: Account<'info, Proposal>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CreateVersionedProposal>) -> Result<()> {
    let multisig = &mut ctx.accounts.multisig;
    let proposal = &mut ctx.accounts.proposal;
    
    // Verify creator is eligible to create proposals
    require!(
        multisig.members.iter().any(|m| 
            m.key == ctx.accounts.creator.key() && 
            m.permissions.has(Permission::Initiate)
        ),
        MultisigError::Unauthorized
    );

    // Set up proposal
    proposal.transaction_index = multisig.current_proposal_index;
    proposal.status = ProposalStatus::Active { timestamp: Clock::get()?.unix_timestamp };
    
    // Increment proposal index
    multisig.current_proposal_index += 1;

    Ok(())
} 