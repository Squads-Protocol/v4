use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct VoteOnVersionedProposal<'info> {
    pub multisig: Account<'info, VersionedMultisig>,
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub voter: Signer<'info>,
}

pub fn handler(ctx: Context<VoteOnVersionedProposal>, approve: bool) -> Result<()> {
    let multisig = &ctx.accounts.multisig;
    let proposal = &mut ctx.accounts.proposal;
    let voter_key = ctx.accounts.voter.key();

    // Find member
    let member = multisig.members
        .iter()
        .find(|m| m.key == voter_key)
        .ok_or(VersionedMultisigError::MemberNotFound)?;

    // Check eligibility
    require!(
        multisig.can_vote(member, proposal.transaction_index),
        VersionedMultisigError::MemberNotEligible
    );

    let threshold = multisig.calculate_threshold_for_proposal(proposal.transaction_index);

    // Add vote
    if approve {
        proposal.approve(voter_key, threshold as usize)?;
    } else {
        proposal.reject(voter_key, threshold as usize)?;
    }

    Ok(())
} 