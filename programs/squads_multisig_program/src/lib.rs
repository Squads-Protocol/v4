#![allow(clippy::result_large_err)]
#![deny(arithmetic_overflow)]
#![deny(unused_must_use)]
// #![deny(clippy::arithmetic_side_effects)]
// #![deny(clippy::integer_arithmetic)]

// Re-export anchor_lang for convenience.
pub use anchor_lang;
use anchor_lang::prelude::*;
#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;

pub use instructions::ProgramConfig;
pub use instructions::*;
pub use state::*;
pub use utils::SmallVec;

pub mod allocator;
pub mod errors;
pub mod instructions;
pub mod state;
mod utils;

#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "Squads Multisig Program",
    project_url: "https://squads.so",
    contacts: "email:security@sqds.io,email:contact@osec.io",
    policy: "https://github.com/Squads-Protocol/v4/blob/main/SECURITY.md",
    preferred_languages: "en",
    source_code: "https://github.com/squads-protocol/v4",
    auditors: "OtterSec, Neodyme"
}

#[cfg(not(feature = "testing"))]
declare_id!("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");

#[cfg(feature = "testing")]
declare_id!("GyhGAqjokLwF9UXdQ2dR5Zwiup242j4mX4J1tSMKyAmD");

#[program]
pub mod squads_multisig_program {
    use errors::MultisigError;

    use super::*;

    /// Initialize the program config.
    pub fn program_config_init(
        ctx: Context<ProgramConfigInit>,
        args: ProgramConfigInitArgs,
    ) -> Result<()> {
        ProgramConfigInit::program_config_init(ctx, args)
    }

    /// Set the `authority` parameter of the program config.
    pub fn program_config_set_authority(
        ctx: Context<ProgramConfig>,
        args: ProgramConfigSetAuthorityArgs,
    ) -> Result<()> {
        ProgramConfig::program_config_set_authority(ctx, args)
    }

    /// Set the `multisig_creation_fee` parameter of the program config.
    pub fn program_config_set_multisig_creation_fee(
        ctx: Context<ProgramConfig>,
        args: ProgramConfigSetMultisigCreationFeeArgs,
    ) -> Result<()> {
        ProgramConfig::program_config_set_multisig_creation_fee(ctx, args)
    }

    /// Set the `treasury` parameter of the program config.
    pub fn program_config_set_treasury(
        ctx: Context<ProgramConfig>,
        args: ProgramConfigSetTreasuryArgs,
    ) -> Result<()> {
        ProgramConfig::program_config_set_treasury(ctx, args)
    }

    /// Create a multisig.
    pub fn multisig_create(_ctx: Context<Deprecated>) -> Result<()> {
        msg!("multisig_create has been deprecated. Use multisig_create_v2 instead.");
        Err(MultisigError::MultisigCreateDeprecated.into())
    }

    /// Create a multisig.
    pub fn multisig_create_v2(
        ctx: Context<MultisigCreateV2>,
        args: MultisigCreateArgsV2,
    ) -> Result<()> {
        MultisigCreateV2::multisig_create(ctx, args)
    }

    /// Add a new member to the controlled multisig.
    pub fn multisig_add_member(
        ctx: Context<MultisigConfig>,
        args: MultisigAddMemberArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_add_member(ctx, args)
    }

    /// Remove a member/key from the controlled multisig.
    pub fn multisig_remove_member(
        ctx: Context<MultisigConfig>,
        args: MultisigRemoveMemberArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_remove_member(ctx, args)
    }

    /// Set the `time_lock` config parameter for the controlled multisig.
    pub fn multisig_set_time_lock(
        ctx: Context<MultisigConfig>,
        args: MultisigSetTimeLockArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_set_time_lock(ctx, args)
    }

    /// Set the `threshold` config parameter for the controlled multisig.
    pub fn multisig_change_threshold(
        ctx: Context<MultisigConfig>,
        args: MultisigChangeThresholdArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_change_threshold(ctx, args)
    }

    /// Set the multisig `config_authority`.
    pub fn multisig_set_config_authority(
        ctx: Context<MultisigConfig>,
        args: MultisigSetConfigAuthorityArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_set_config_authority(ctx, args)
    }

    /// Set the multisig `rent_collector`.
    pub fn multisig_set_rent_collector(
        ctx: Context<MultisigConfig>,
        args: MultisigSetRentCollectorArgs,
    ) -> Result<()> {
        MultisigConfig::multisig_set_rent_collector(ctx, args)
    }

    /// Create a new spending limit for the controlled multisig.
    pub fn multisig_add_spending_limit(
        ctx: Context<MultisigAddSpendingLimit>,
        args: MultisigAddSpendingLimitArgs,
    ) -> Result<()> {
        MultisigAddSpendingLimit::multisig_add_spending_limit(ctx, args)
    }

    /// Remove the spending limit from the controlled multisig.
    pub fn multisig_remove_spending_limit(
        ctx: Context<MultisigRemoveSpendingLimit>,
        args: MultisigRemoveSpendingLimitArgs,
    ) -> Result<()> {
        MultisigRemoveSpendingLimit::multisig_remove_spending_limit(ctx, args)
    }

    /// Create a new config transaction.
    pub fn config_transaction_create(
        ctx: Context<ConfigTransactionCreate>,
        args: ConfigTransactionCreateArgs,
    ) -> Result<()> {
        ConfigTransactionCreate::config_transaction_create(ctx, args)
    }

    /// Execute a config transaction.
    /// The transaction must be `Approved`.
    pub fn config_transaction_execute<'info>(
        ctx: Context<'_, '_, 'info, 'info, ConfigTransactionExecute<'info>>,
    ) -> Result<()> {
        ConfigTransactionExecute::config_transaction_execute(ctx)
    }

    /// Create a new vault transaction.
    pub fn vault_transaction_create(
        ctx: Context<VaultTransactionCreate>,
        args: VaultTransactionCreateArgs,
    ) -> Result<()> {
        VaultTransactionCreate::vault_transaction_create(ctx, args)
    }

    /// Create a transaction buffer account.
    pub fn transaction_buffer_create(
        ctx: Context<TransactionBufferCreate>,
        args: TransactionBufferCreateArgs,
    ) -> Result<()> {
        TransactionBufferCreate::transaction_buffer_create(ctx, args)
    }

    /// Close a transaction buffer account.
    pub fn transaction_buffer_close(ctx: Context<TransactionBufferClose>) -> Result<()> {
        TransactionBufferClose::transaction_buffer_close(ctx)
    }

    /// Extend a transaction buffer account.
    pub fn transaction_buffer_extend(
        ctx: Context<TransactionBufferExtend>,
        args: TransactionBufferExtendArgs,
    ) -> Result<()> {
        TransactionBufferExtend::transaction_buffer_extend(ctx, args)
    }

    /// Create a new vault transaction from a completed transaction buffer.
    /// Finalized buffer hash must match `final_buffer_hash`
    pub fn vault_transaction_create_from_buffer<'info>(
        ctx: Context<'_, '_, 'info, 'info, VaultTransactionCreateFromBuffer<'info>>,
        args: VaultTransactionCreateArgs,
    ) -> Result<()> {
        VaultTransactionCreateFromBuffer::vault_transaction_create_from_buffer(ctx, args)
    }

    /// Execute a vault transaction.
    /// The transaction must be `Approved`.
    pub fn vault_transaction_execute(ctx: Context<VaultTransactionExecute>) -> Result<()> {
        VaultTransactionExecute::vault_transaction_execute(ctx)
    }

    /// Create a new batch.
    pub fn batch_create(ctx: Context<BatchCreate>, args: BatchCreateArgs) -> Result<()> {
        BatchCreate::batch_create(ctx, args)
    }

    /// Add a transaction to the batch.
    pub fn batch_add_transaction(
        ctx: Context<BatchAddTransaction>,
        args: BatchAddTransactionArgs,
    ) -> Result<()> {
        BatchAddTransaction::batch_add_transaction(ctx, args)
    }

    /// Execute a transaction from the batch.
    pub fn batch_execute_transaction(ctx: Context<BatchExecuteTransaction>) -> Result<()> {
        BatchExecuteTransaction::batch_execute_transaction(ctx)
    }

    /// Create a new multisig proposal.
    pub fn proposal_create(ctx: Context<ProposalCreate>, args: ProposalCreateArgs) -> Result<()> {
        ProposalCreate::proposal_create(ctx, args)
    }

    /// Update status of a multisig proposal from `Draft` to `Active`.
    pub fn proposal_activate(ctx: Context<ProposalActivate>) -> Result<()> {
        ProposalActivate::proposal_activate(ctx)
    }

    /// Approve a multisig proposal on behalf of the `member`.
    /// The proposal must be `Active`.
    pub fn proposal_approve(ctx: Context<ProposalVote>, args: ProposalVoteArgs) -> Result<()> {
        ProposalVote::proposal_approve(ctx, args)
    }

    /// Reject a multisig proposal on behalf of the `member`.
    /// The proposal must be `Active`.
    pub fn proposal_reject(ctx: Context<ProposalVote>, args: ProposalVoteArgs) -> Result<()> {
        ProposalVote::proposal_reject(ctx, args)
    }

    /// Cancel a multisig proposal on behalf of the `member`.
    /// The proposal must be `Approved`.
    pub fn proposal_cancel(ctx: Context<ProposalVote>, args: ProposalVoteArgs) -> Result<()> {
        ProposalVote::proposal_cancel(ctx, args)
    }

    /// Cancel a multisig proposal on behalf of the `member`.
    /// The proposal must be `Approved`.
    /// This was introduced to incorporate proper state update, as old multisig members
    /// may have lingering votes, and the proposal size may need to be reallocated to
    /// accommodate the new amount of cancel votes.
    /// The previous implemenation still works if the proposal size is in line with the
    /// threshold size.
    pub fn proposal_cancel_v2<'info>(
        ctx: Context<'_, '_, 'info, 'info, ProposalCancelV2<'info>>,
        args: ProposalVoteArgs,
    ) -> Result<()> {
        ProposalCancelV2::proposal_cancel_v2(ctx, args)
    }

    /// Use a spending limit to transfer tokens from a multisig vault to a destination account.
    pub fn spending_limit_use(
        ctx: Context<SpendingLimitUse>,
        args: SpendingLimitUseArgs,
    ) -> Result<()> {
        SpendingLimitUse::spending_limit_use(ctx, args)
    }

    /// Closes a `ConfigTransaction` and the corresponding `Proposal`.
    /// `transaction` can be closed if either:
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale.
    pub fn config_transaction_accounts_close(
        ctx: Context<ConfigTransactionAccountsClose>,
    ) -> Result<()> {
        ConfigTransactionAccountsClose::config_transaction_accounts_close(ctx)
    }

    /// Closes a `VaultTransaction` and the corresponding `Proposal`.
    /// `transaction` can be closed if either:
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale and not `Approved`.
    pub fn vault_transaction_accounts_close(
        ctx: Context<VaultTransactionAccountsClose>,
    ) -> Result<()> {
        VaultTransactionAccountsClose::vault_transaction_accounts_close(ctx)
    }

    /// Closes a `VaultBatchTransaction` belonging to the `batch` and `proposal`.
    /// `transaction` can be closed if either:
    /// - it's marked as executed within the `batch`;
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale and not `Approved`.
    pub fn vault_batch_transaction_account_close(
        ctx: Context<VaultBatchTransactionAccountClose>,
    ) -> Result<()> {
        VaultBatchTransactionAccountClose::vault_batch_transaction_account_close(ctx)
    }

    /// Closes Batch and the corresponding Proposal accounts for proposals in terminal states:
    /// `Executed`, `Rejected`, or `Cancelled` or stale proposals that aren't `Approved`.
    ///
    /// This instruction is only allowed to be executed when all `VaultBatchTransaction` accounts
    /// in the `batch` are already closed: `batch.size == 0`.
    pub fn batch_accounts_close(ctx: Context<BatchAccountsClose>) -> Result<()> {
        BatchAccountsClose::batch_accounts_close(ctx)
    }
}
