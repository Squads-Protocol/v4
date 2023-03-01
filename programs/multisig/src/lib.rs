#![allow(clippy::result_large_err)]
#![deny(unused_must_use)]

use anchor_lang::prelude::*;

pub use events::*;
pub use instructions::*;
pub use state::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;
mod utils;

declare_id!("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");

#[program]
pub mod multisig {
    use super::*;

    /// Create a multisig.
    pub fn multisig_create(ctx: Context<MultisigCreate>, args: MultisigCreateArgs) -> Result<()> {
        MultisigCreate::multisig_create(ctx, args)
    }

    /// Add a new member to the multisig.
    pub fn multisig_add_member(
        ctx: Context<MultisigConfig>,
        args: MultisigAddMemberArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_add_member(ctx, args)
    }

    /// Remove a member/key from the multisig.
    pub fn multisig_remove_member(
        ctx: Context<MultisigConfig>,
        args: MultisigRemoveMemberArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_remove_member(ctx, args)
    }

    /// Create a new multisig transaction.
    pub fn transaction_create(
        ctx: Context<TransactionCreate>,
        args: TransactionCreateArgs,
    ) -> Result<()> {
        TransactionCreate::transaction_create(ctx, args)
    }

    /// Approve the transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn transaction_approve(
        ctx: Context<TransactionVote>,
        args: TransactionVoteArgs,
    ) -> Result<()> {
        TransactionVote::transaction_approve(ctx, args)
    }

    /// Reject the transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn transaction_reject(
        ctx: Context<TransactionVote>,
        args: TransactionVoteArgs,
    ) -> Result<()> {
        TransactionVote::transaction_reject(ctx, args)
    }

    /// Execute the multisig transaction.
    /// The transaction must be `ExecuteReady`.
    pub fn transaction_execute(ctx: Context<TransactionExecute>) -> Result<()> {
        TransactionExecute::transaction_execute(ctx)
    }
}
