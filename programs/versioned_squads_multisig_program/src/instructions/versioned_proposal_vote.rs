use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct VoteOnVersionedProposal<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, VersionedMultisig>,
    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &proposal.transaction_index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,
    #[account(mut)]
    pub voter: Signer<'info>,
}

fn validate_proposal_status(proposal: &Proposal) -> Result<()> {
    match proposal.status {
        ProposalStatus::Approved { timestamp }  => {
            require!(timestamp == 0, VersionedMultisigError::AlreadyApproved);
        },
        ProposalStatus::Rejected { timestamp } => {
            require!(timestamp == 0, VersionedMultisigError::AlreadyRejected);
        },
        ProposalStatus::Executed { timestamp } => {
            require!(timestamp == 0, VersionedMultisigError::AlreadyExecuted);
        },
        _ => {}
    }
    Ok(())
}


pub fn handler(ctx: Context<VoteOnVersionedProposal>, approve: bool) -> Result<()> {
    let multisig = &ctx.accounts.multisig;
    let proposal = &mut ctx.accounts.proposal;
    let voter_key = ctx.accounts.voter.key();

    // Check if proposal is already executed
    validate_proposal_status(proposal)?;

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

    msg!("Voting on proposal: {}", proposal.key().to_string());
    msg!("Voter: {} - Join Index: {}", voter_key.to_string(), member.join_proposal_index);
    msg!("Approve: {}", approve);   

    let threshold = multisig.calculate_threshold_for_proposal(proposal.transaction_index);

    // Add vote
    if approve {
        proposal.approve(voter_key, threshold as usize)?;
    } else {
        proposal.reject(voter_key, threshold as usize)?;
    }

    Ok(())
} 