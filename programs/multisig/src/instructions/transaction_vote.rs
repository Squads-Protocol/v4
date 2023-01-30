use anchor_lang::prelude::*;

use crate::errors::*;
use crate::events::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TransactionVoteArgs {
    pub memo: Option<String>,
}

#[derive(Accounts)]
pub struct TransactionVote<'info> {
    #[account(
        seeds = [SEED_PREFIX, multisig.create_key.as_ref(), SEED_MULTISIG],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            SEED_TRANSACTION
        ],
        bump = transaction.bump,
        constraint = transaction.status == TransactionStatus::Active @ MultisigError::InvalidTransactionStatus,
        constraint = transaction.transaction_index > multisig.stale_transaction_index @ MultisigError::StaleTransaction,
        constraint = transaction.multisig == multisig.key() @ MultisigError::TransactionNotForMultisig
    )]
    pub transaction: Account<'info, MultisigTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(member.key()).is_some() @ MultisigError::NotAMember,
        constraint = multisig.member_has_permission(member.key(), Permission::Vote) @ MultisigError::Unauthorized,
    )]
    pub member: Signer<'info>,
}

impl TransactionVote<'_> {
    /// Approve the transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn transaction_approve(ctx: Context<Self>, args: TransactionVoteArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let member = &mut ctx.accounts.member;

        require!(
            transaction.has_voted_approve(member.key()).is_none(),
            MultisigError::AlreadyApproved
        );

        // If `member` has previously voted to reject, remove that vote.
        if let Some(vote_index) = transaction.has_voted_reject(member.key()) {
            transaction.remove_rejection_vote(vote_index);
        }

        transaction.approve(member.key());

        // If current number of approvals reaches threshold, mark the transaction as `ExecuteReady`.
        if transaction.approved.len() >= usize::from(multisig.threshold) {
            transaction.status = TransactionStatus::ExecuteReady;
        }

        emit!(TransactionApproved {
            multisig: multisig.key(),
            transaction: transaction.key(),
            memo: args.memo,
        });

        Ok(())
    }

    /// Reject the transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn transaction_reject(ctx: Context<Self>, args: TransactionVoteArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let member = &mut ctx.accounts.member;

        require!(
            transaction.has_voted_reject(member.key()).is_none(),
            MultisigError::AlreadyApproved
        );

        // If `member` has previously voted to approve, remove that vote.
        if let Some(vote_index) = transaction.has_voted_approve(member.key()) {
            transaction.remove_approval_vote(vote_index);
        }

        transaction.reject(member.key());

        // How many "reject" votes are enough to make the transaction "Rejected".
        // The cutoff must be such that it is impossible for the remaining voters to reach the approval threshold.
        // For example: total voters = 7, threshold = 3, cutoff = 5.
        let cutoff = Multisig::num_voters(&multisig.members)
            .checked_sub(usize::from(multisig.threshold))
            .unwrap()
            .checked_add(1)
            .unwrap();
        if transaction.rejected.len() >= cutoff {
            transaction.status = TransactionStatus::Rejected;
        }

        emit!(TransactionRejected {
            multisig: multisig.key(),
            transaction: transaction.key(),
            memo: args.memo,
        });

        Ok(())
    }
}
