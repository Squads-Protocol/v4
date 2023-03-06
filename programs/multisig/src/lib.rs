#![allow(clippy::result_large_err)]
#![deny(unused_must_use)]
// #![deny(clippy::arithmetic_side_effects)]
// #![deny(clippy::integer_arithmetic)]

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

    /// Create a new vault transaction.
    pub fn vault_transaction_create(
        ctx: Context<VaultTransactionCreate>,
        args: VaultTransactionCreateArgs,
    ) -> Result<()> {
        VaultTransactionCreate::vault_transaction_create(ctx, args)
    }

    /// Approve a vault transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn vault_transaction_approve(
        ctx: Context<VaultTransactionVote>,
        args: VaultTransactionVoteArgs,
    ) -> Result<()> {
        VaultTransactionVote::vault_transaction_approve(ctx, args)
    }

    /// Reject a vault transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn vault_transaction_reject(
        ctx: Context<VaultTransactionVote>,
        args: VaultTransactionVoteArgs,
    ) -> Result<()> {
        VaultTransactionVote::vault_transaction_reject(ctx, args)
    }

    /// Execute a vault transaction.
    /// The transaction must be `ExecuteReady`.
    pub fn vault_transaction_execute(ctx: Context<VaultTransactionExecute>) -> Result<()> {
        VaultTransactionExecute::vault_transaction_execute(ctx)
    }

    /// Create a new config transaction.
    pub fn config_transaction_create(
        ctx: Context<ConfigTransactionCreate>,
        args: ConfigTransactionCreateArgs,
    ) -> Result<()> {
        ConfigTransactionCreate::config_transaction_create(ctx, args)
    }

    /// Approve a config transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn config_transaction_approve(
        ctx: Context<ConfigTransactionVote>,
        args: ConfigTransactionVoteArgs,
    ) -> Result<()> {
        ConfigTransactionVote::config_transaction_approve(ctx, args)
    }

    /// Reject a config transaction on behalf of the `member`.
    /// The transaction must be `Active`.
    pub fn config_transaction_reject(
        ctx: Context<ConfigTransactionVote>,
        args: ConfigTransactionVoteArgs,
    ) -> Result<()> {
        ConfigTransactionVote::config_transaction_reject(ctx, args)
    }

    /// Execute a config transaction.
    /// The transaction must be `ExecuteReady`.
    pub fn config_transaction_execute(ctx: Context<ConfigTransactionExecute>) -> Result<()> {
        ConfigTransactionExecute::config_transaction_execute(ctx)
    }
}
