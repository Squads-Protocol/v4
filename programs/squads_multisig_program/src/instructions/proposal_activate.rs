use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
pub struct ProposalActivate<'info> {
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

impl ProposalActivate<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig,
            proposal,
            member,
            ..
        } = self;

        // `member`
        require!(
            multisig.is_member(member.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            // We consider this action a part of the proposal initiation.
            multisig.member_has_permission(member.key(), Permission::Initiate),
            MultisigError::Unauthorized
        );

        // `proposal`
        require!(
            matches!(proposal.status, ProposalStatus::Draft { .. }),
            MultisigError::InvalidProposalStatus
        );
        require!(
            proposal.transaction_index > multisig.stale_transaction_index,
            MultisigError::StaleProposal
        );

        Ok(())
    }

    /// Update status of a multisig proposal from `Draft` to `Active`.
    #[access_control(ctx.accounts.validate())]
    pub fn proposal_activate(ctx: Context<Self>) -> Result<()> {
        ctx.accounts.proposal.status = ProposalStatus::Active {
            timestamp: Clock::get()?.unix_timestamp,
        };

        Ok(())
    }
}
