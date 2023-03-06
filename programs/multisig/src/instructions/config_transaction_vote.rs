use anchor_lang::prelude::*;

use crate::errors::*;
use crate::events::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ConfigTransactionVoteArgs {
    pub memo: Option<String>,
}

#[derive(Accounts)]
pub struct ConfigTransactionVote<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.transaction_index.to_le_bytes(),
        ],
        bump = transaction.bump,
        constraint = transaction.status == TransactionStatus::Active @ MultisigError::InvalidTransactionStatus,
        constraint = transaction.transaction_index > multisig.stale_transaction_index @ MultisigError::StaleTransaction,
        constraint = transaction.multisig == multisig.key() @ MultisigError::TransactionNotForMultisig
    )]
    pub transaction: Account<'info, ConfigTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(member.key()).is_some() @ MultisigError::NotAMember,
        constraint = multisig.member_has_permission(member.key(), Permission::Vote) @ MultisigError::Unauthorized,
    )]
    pub member: Signer<'info>,
}

impl ConfigTransactionVote<'_> {
    /// Approve the transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn config_transaction_approve(
        ctx: Context<Self>,
        args: ConfigTransactionVoteArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let member = &mut ctx.accounts.member;

        transaction.approve(member.key(), usize::from(multisig.threshold))?;

        emit!(TransactionApproved {
            multisig: multisig.key(),
            transaction: transaction.key(),
            memo: args.memo,
        });

        Ok(())
    }

    /// Reject the transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn config_transaction_reject(
        ctx: Context<Self>,
        args: ConfigTransactionVoteArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let member = &mut ctx.accounts.member;

        let cutoff = Multisig::cutoff(multisig);

        transaction.reject(member.key(), cutoff)?;

        emit!(TransactionRejected {
            multisig: multisig.key(),
            transaction: transaction.key(),
            memo: args.memo,
        });

        Ok(())
    }
}
