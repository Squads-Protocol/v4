//! Contains instructions for closing accounts related to ConfigTransactions,
//! VaultTransactions and Batches.
//!
//! The differences between the 3 is minor but still exist. For example,
//! a ConfigTransaction's accounts can always be closed if the proposal is stale,
//! while for VaultTransactions and Batches it's not allowed if the proposal is stale but Approved,
//! because they still can be executed in such a case.
//!
//! The other reason we have 3 different instructions is purely related to Anchor API which
//! allows adding the `close` attribute only to `Account<'info, XXX>` types, which forces us
//! into having 3 different `Accounts` structs.
use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
pub struct ConfigTransactionAccountsClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
        constraint = multisig.rent_collector.is_some() @ MultisigError::RentReclamationDisabled,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        has_one = multisig @ MultisigError::ProposalForAnotherMultisig,
        close = rent_collector
    )]
    pub proposal: Account<'info, Proposal>,

    /// ConfigTransaction corresponding to the `proposal`.
    #[account(
        mut,
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
        constraint = transaction.index == proposal.transaction_index @ MultisigError::TransactionNotMatchingProposal,
        close = rent_collector
    )]
    pub transaction: Account<'info, ConfigTransaction>,

    /// The rent collector.
    /// CHECK: We only need to validate the address.
    #[account(
        mut,
        address = multisig.rent_collector.unwrap().key() @ MultisigError::InvalidRentCollector,
    )]
    pub rent_collector: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl ConfigTransactionAccountsClose<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig, proposal, ..
        } = self;

        let is_stale = proposal.transaction_index <= multisig.stale_transaction_index;

        // Has to be either stale or in a terminal state.
        #[allow(deprecated)]
        let can_close = match proposal.status {
            // Draft proposals can only be closed if stale,
            // so they can't be activated anymore.
            ProposalStatus::Draft { .. } => is_stale,
            // Active proposals can only be closed if stale,
            // so they can't be voted on anymore.
            ProposalStatus::Active { .. } => is_stale,
            // Approved proposals for ConfigTransactions can be closed if stale,
            // because they cannot be executed anymore.
            ProposalStatus::Approved { .. } => is_stale,
            // Rejected proposals can be closed.
            ProposalStatus::Rejected { .. } => true,
            // Executed proposals can be closed.
            ProposalStatus::Executed { .. } => true,
            // Cancelled proposals can be closed.
            ProposalStatus::Cancelled { .. } => true,
            // Should never really be in this state.
            ProposalStatus::Executing => false,
        };

        require!(can_close, MultisigError::InvalidProposalStatus);

        Ok(())
    }

    /// Closes a `ConfigTransaction` and the corresponding `Proposal`.
    /// `transaction` can be closed if either:
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale.
    #[access_control(_ctx.accounts.validate())]
    pub fn config_transaction_accounts_close(_ctx: Context<Self>) -> Result<()> {
        // Anchor will close the accounts for us.
        Ok(())
    }
}

#[derive(Accounts)]
pub struct VaultTransactionAccountsClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
        constraint = multisig.rent_collector.is_some() @ MultisigError::RentReclamationDisabled,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        mut,
        has_one = multisig @ MultisigError::ProposalForAnotherMultisig,
        close = rent_collector
    )]
    pub proposal: Account<'info, Proposal>,

    /// VaultTransaction corresponding to the `proposal`.
    #[account(
        mut,
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
        constraint = transaction.index == proposal.transaction_index @ MultisigError::TransactionNotMatchingProposal,
        close = rent_collector
    )]
    pub transaction: Account<'info, VaultTransaction>,

    /// The rent collector.
    /// CHECK: We only need to validate the address.
    #[account(
        mut,
        address = multisig.rent_collector.unwrap().key() @ MultisigError::InvalidRentCollector,
    )]
    pub rent_collector: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl VaultTransactionAccountsClose<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig, proposal, ..
        } = self;

        let is_stale = proposal.transaction_index <= multisig.stale_transaction_index;

        #[allow(deprecated)]
        let can_close = match proposal.status {
            // Draft proposals can only be closed if stale,
            // so they can't be activated anymore.
            ProposalStatus::Draft { .. } => is_stale,
            // Active proposals can only be closed if stale,
            // so they can't be voted on anymore.
            ProposalStatus::Active { .. } => is_stale,
            // Approved proposals for VaultTransactions cannot be closed even if stale,
            // because they still can be executed.
            ProposalStatus::Approved { .. } => false,
            // Rejected proposals can be closed.
            ProposalStatus::Rejected { .. } => true,
            // Executed proposals can be closed.
            ProposalStatus::Executed { .. } => true,
            // Cancelled proposals can be closed.
            ProposalStatus::Cancelled { .. } => true,
            // Should never really be in this state.
            ProposalStatus::Executing => false,
        };

        require!(can_close, MultisigError::InvalidProposalStatus);

        Ok(())
    }

    /// Closes a `VaultTransaction` and the corresponding `Proposal`.
    /// `transaction` can be closed if either:
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale and not `Approved`.
    #[access_control(_ctx.accounts.validate())]
    pub fn vault_transaction_accounts_close(_ctx: Context<Self>) -> Result<()> {
        // Anchor will close the accounts for us.
        Ok(())
    }
}

//region VaultBatchTransactionAccountClose

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VaultBatchTransactionAccountCloseArgs {
    pub transaction_index: u32,
}

#[derive(Accounts)]
#[instruction(args: VaultBatchTransactionAccountCloseArgs)]
pub struct VaultBatchTransactionAccountClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
        constraint = multisig.rent_collector.is_some() @ MultisigError::RentReclamationDisabled,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        has_one = multisig @ MultisigError::ProposalForAnotherMultisig,
    )]
    pub proposal: Account<'info, Proposal>,

    /// `Batch` corresponding to the `proposal`.
    #[account(
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
        constraint = batch.index == proposal.transaction_index @ MultisigError::TransactionNotMatchingProposal,
    )]
    pub batch: Account<'info, Batch>,

    /// `VaultBatchTransaction` account to close.
    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &batch.index.to_le_bytes(),
            SEED_BATCH_TRANSACTION,
            &args.transaction_index.to_le_bytes(),
        ],
        bump = transaction.bump,
        close = rent_collector,
    )]
    pub transaction: Account<'info, VaultBatchTransaction>,

    /// The rent collector.
    /// CHECK: We only need to validate the address.
    #[account(
        mut,
        address = multisig.rent_collector.unwrap().key() @ MultisigError::InvalidRentCollector,
    )]
    pub rent_collector: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl VaultBatchTransactionAccountClose<'_> {
    fn validate(&self, args: &VaultBatchTransactionAccountCloseArgs) -> Result<()> {
        let Self {
            multisig,
            proposal,
            batch,
            ..
        } = self;

        // `args.transaction_index` is checked with Anchor via `transaction`'s seeds.

        let is_batch_transaction_executed =
            args.transaction_index <= batch.executed_transaction_index;

        let is_proposal_stale = proposal.transaction_index <= multisig.stale_transaction_index;

        // Batch transactions that are marked as executed within the batch can be closed,
        // otherwise we need to check the proposal status.
        #[allow(deprecated)]
        let can_close = is_batch_transaction_executed
            || match proposal.status {
                // Transactions of Draft proposals can only be closed if stale,
                // so the proposal can't be activated anymore.
                ProposalStatus::Draft { .. } => is_proposal_stale,
                // Transactions of Active proposals can only be closed if stale,
                // so the proposal can't be voted on anymore.
                ProposalStatus::Active { .. } => is_proposal_stale,
                // Transactions of Approved proposals for `Batch`es cannot be closed even if stale,
                // because they still can be executed.
                ProposalStatus::Approved { .. } => false,
                // Transactions of Rejected proposals can be closed.
                ProposalStatus::Rejected { .. } => true,
                // Transactions of Executed proposals can be closed.
                ProposalStatus::Executed { .. } => true,
                // Transactions of Cancelled proposals can be closed.
                ProposalStatus::Cancelled { .. } => true,
                // Should never really be in this state.
                ProposalStatus::Executing => false,
            };

        require!(can_close, MultisigError::InvalidProposalStatus);

        Ok(())
    }

    /// Closes a `VaultBatchTransaction` belonging to the `batch` and `proposal`.
    /// `transaction` can be closed if either:
    /// - it's marked as executed within the `batch`;
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale and not `Approved`.
    #[access_control(_ctx.accounts.validate(&_args))]
    pub fn vault_batch_transaction_account_close(
        _ctx: Context<Self>,
        _args: VaultBatchTransactionAccountCloseArgs,
    ) -> Result<()> {
        // Anchor will close the account for us.
        Ok(())
    }
}
//endregion

//region BatchAccountsClose
#[derive(Accounts)]
pub struct BatchAccountsClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
        constraint = multisig.rent_collector.is_some() @ MultisigError::RentReclamationDisabled,
    )]
    pub multisig: Account<'info, Multisig>,

    /// Has to be a member of the `multisig`.
    /// This is checked to prevent potential attackers from closing the `Batch` and `Proposal`
    /// accounts before all `VaultBatchTransaction`s are closed.
    #[account(
        constraint = multisig.is_member(member.key()).is_some() @ MultisigError::NotAMember,
    )]
    pub member: Signer<'info>,

    #[account(
        mut,
        has_one = multisig @ MultisigError::ProposalForAnotherMultisig,
        close = rent_collector
    )]
    pub proposal: Account<'info, Proposal>,

    /// `Batch` corresponding to the `proposal`.
    #[account(
        mut,
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
        constraint = batch.index == proposal.transaction_index @ MultisigError::TransactionNotMatchingProposal,
        close = rent_collector
    )]
    pub batch: Account<'info, Batch>,

    /// The rent collector.
    /// CHECK: We only need to validate the address.
    #[account(
        mut,
        address = multisig.rent_collector.unwrap().key() @ MultisigError::InvalidRentCollector,
    )]
    pub rent_collector: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl BatchAccountsClose<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig, proposal, ..
        } = self;

        let is_stale = proposal.transaction_index <= multisig.stale_transaction_index;

        #[allow(deprecated)]
        let can_close = match proposal.status {
            // Draft proposals can only be closed if stale,
            // so they can't be activated anymore.
            ProposalStatus::Draft { .. } => is_stale,
            // Active proposals can only be closed if stale,
            // so they can't be voted on anymore.
            ProposalStatus::Active { .. } => is_stale,
            // Approved proposals for Batch'es cannot be closed even if stale,
            // because they still can be executed.
            ProposalStatus::Approved { .. } => false,
            // Rejected proposals can be closed.
            ProposalStatus::Rejected { .. } => true,
            // Executed proposals can be closed.
            ProposalStatus::Executed { .. } => true,
            // Cancelled proposals can be closed.
            ProposalStatus::Cancelled { .. } => true,
            // Should never really be in this state.
            ProposalStatus::Executing => false,
        };

        require!(can_close, MultisigError::InvalidProposalStatus);

        Ok(())
    }

    /// Closes Batch and the corresponding Proposal accounts for proposals in terminal states:
    /// `Executed`, `Rejected`, or `Cancelled` or stale proposals that aren't Approved.
    ///
    /// WARNING: Make sure that to call this instruction only after all `VaultBatchTransaction`s
    /// are already closed via `vault_batch_transaction_account_close`,
    /// because the latter requires existing `Batch` and `Proposal` accounts, which this instruction closes.
    /// There is no on-chain check preventing you from closing the `Batch` and `Proposal` accounts
    /// first, so you will end up with no way to close the corresponding `VaultBatchTransaction`s.
    #[access_control(_ctx.accounts.validate())]
    pub fn batch_accounts_close(_ctx: Context<Self>) -> Result<()> {
        // Anchor will close the accounts for us.
        Ok(())
    }
}
//endregion
