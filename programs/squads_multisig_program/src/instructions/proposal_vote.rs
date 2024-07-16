use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProposalVoteArgs {
    pub memo: Option<String>,
}

#[derive(Accounts)]
pub struct ProposalVote<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub member: Signer<'info>,

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
}

#[derive(Accounts)]
pub struct ProposalCancel<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut)]
    pub member: Signer<'info>,

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

    pub system_program: Program<'info, System>,
}

impl ProposalVote<'_> {
    fn validate(&self, vote: Vote) -> Result<()> {
        let Self {
            multisig,
            proposal,
            member,
            ..
        } = self;

        // member
        require!(
            multisig.is_member(member.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            multisig.member_has_permission(member.key(), Permission::Vote),
            MultisigError::Unauthorized
        );

        // proposal
        match vote {
            Vote::Approve | Vote::Reject => {
                require!(
                    matches!(proposal.status, ProposalStatus::Active { .. }),
                    MultisigError::InvalidProposalStatus
                );
                // CANNOT approve or reject a stale proposal
                require!(
                    proposal.transaction_index > multisig.stale_transaction_index,
                    MultisigError::StaleProposal
                );
            }
            Vote::Cancel => {
                require!(
                    matches!(proposal.status, ProposalStatus::Approved { .. }),
                    MultisigError::InvalidProposalStatus
                );
                // CAN cancel a stale proposal.
            }
        }

        Ok(())
    }

    /// Approve a multisig proposal on behalf of the `member`.
    /// The proposal must be `Active`.
    #[access_control(ctx.accounts.validate(Vote::Approve))]
    pub fn proposal_approve(ctx: Context<Self>, _args: ProposalVoteArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let proposal = &mut ctx.accounts.proposal;
        let member = &mut ctx.accounts.member;

        proposal.approve(member.key(), usize::from(multisig.threshold))?;

        Ok(())
    }

    /// Reject a multisig proposal on behalf of the `member`.
    /// The proposal must be `Active`.
    #[access_control(ctx.accounts.validate(Vote::Reject))]
    pub fn proposal_reject(ctx: Context<Self>, _args: ProposalVoteArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let proposal = &mut ctx.accounts.proposal;
        let member = &mut ctx.accounts.member;

        let cutoff = Multisig::cutoff(multisig);

        proposal.reject(member.key(), cutoff)?;

        Ok(())
    }

    /// Cancel a multisig proposal on behalf of the `member`.
    /// The proposal must be `Approved`.
    #[access_control(ctx.accounts.validate(Vote::Cancel))]
    pub fn proposal_cancel(ctx: Context<Self>, _args: ProposalVoteArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let proposal = &mut ctx.accounts.proposal;
        let member = &mut ctx.accounts.member;

        proposal.cancel(member.key(), usize::from(multisig.threshold))?;

        Ok(())
    }
}

impl ProposalCancel<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig,
            proposal,
            member,
            ..
        } = self;

        // member
        require!(
            multisig.is_member(member.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            multisig.member_has_permission(member.key(), Permission::Vote),
            MultisigError::Unauthorized
        );


        require!(
            matches!(proposal.status, ProposalStatus::Approved { .. }),
            MultisigError::InvalidProposalStatus
        );
        // CAN cancel a stale proposal.

        Ok(())
    }

    /// Cancel a multisig proposal on behalf of the `member`.
    /// The proposal must be `Approved`.
    #[access_control(ctx.accounts.validate())]
    pub fn proposal_cancel(ctx: Context<Self>, _args: ProposalVoteArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let proposal = &mut ctx.accounts.proposal;
        let member = &mut ctx.accounts.member;
        let system_program = &ctx.accounts.system_program;

        // ensure that the cancel array contains no keys that are not currently members
        proposal.cancelled.retain(|k| multisig.is_member(*k).is_some());

        proposal.cancel(member.key(), usize::from(multisig.threshold))?;

        // reallocate the proposal size if needed
        Proposal::realloc_if_needed(proposal.to_account_info(), multisig.members.len(), Some(member.to_account_info()), Some(system_program.to_account_info()))?;
        Ok(())
    }
}

pub enum Vote {
    Approve,
    Reject,
    Cancel,
}
