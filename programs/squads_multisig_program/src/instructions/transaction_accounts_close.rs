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
use crate::utils;

#[derive(Accounts)]
pub struct ConfigTransactionAccountsClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
        constraint = multisig.rent_collector.is_some() @ MultisigError::RentReclamationDisabled,
    )]
    pub multisig: Account<'info, Multisig>,

    /// CHECK: `seeds` and `bump` verify that the account is the canonical Proposal,
    ///         the logic within `config_transaction_accounts_close` does the rest of the checks.
    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump,
    )]
    pub proposal: AccountInfo<'info>,

    /// ConfigTransaction corresponding to the `proposal`.
    #[account(
        mut,
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
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
    /// Closes a `ConfigTransaction` and the corresponding `Proposal`.
    /// `transaction` can be closed if either:
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale.
    pub fn config_transaction_accounts_close(ctx: Context<Self>) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let transaction = &ctx.accounts.transaction;
        let proposal = &mut ctx.accounts.proposal;
        let rent_collector = &ctx.accounts.rent_collector;

        let is_stale = transaction.index <= multisig.stale_transaction_index;

        let proposal_account = if proposal.data.borrow().is_empty() {
            None
        } else {
            Some(Proposal::try_deserialize(
                &mut &**proposal.data.borrow_mut(),
            )?)
        };

        #[allow(deprecated)]
        let can_close = if let Some(proposal_account) = &proposal_account {
            match proposal_account.status {
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
            }
        } else {
            // If no Proposal account exists then the ConfigTransaction can only be closed if stale
            is_stale
        };

        require!(can_close, MultisigError::InvalidProposalStatus);

        // Close the `proposal` account if exists.
        if proposal_account.is_some() {
            utils::close(
                ctx.accounts.proposal.to_account_info(),
                rent_collector.to_account_info(),
            )?;
        }

        // Anchor will close the `transaction` account for us.
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

    /// CHECK: `seeds` and `bump` verify that the account is the canonical Proposal,
    ///         the logic within `vault_transaction_accounts_close` does the rest of the checks.
    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump,
    )]
    pub proposal: AccountInfo<'info>,

    /// VaultTransaction corresponding to the `proposal`.
    #[account(
        mut,
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
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
    /// Closes a `VaultTransaction` and the corresponding `Proposal`.
    /// `transaction` can be closed if either:
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale and not `Approved`.
    pub fn vault_transaction_accounts_close(
        ctx: Context<VaultTransactionAccountsClose>,
    ) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let transaction = &ctx.accounts.transaction;
        let proposal = &mut ctx.accounts.proposal;
        let rent_collector = &ctx.accounts.rent_collector;

        let is_stale = transaction.index <= multisig.stale_transaction_index;

        let proposal_account = if proposal.data.borrow().is_empty() {
            None
        } else {
            Some(Proposal::try_deserialize(
                &mut &**proposal.data.borrow_mut(),
            )?)
        };

        #[allow(deprecated)]
        let can_close = if let Some(proposal_account) = &proposal_account {
            match proposal_account.status {
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
            }
        } else {
            // If no Proposal account exists then the VaultTransaction can only be closed if stale
            is_stale
        };

        require!(can_close, MultisigError::InvalidProposalStatus);

        // Close the `proposal` account if exists.
        if proposal_account.is_some() {
            utils::close(
                ctx.accounts.proposal.to_account_info(),
                rent_collector.to_account_info(),
            )?;
        }

        // Anchor will close the `transaction` account for us.
        Ok(())
    }
}

//region VaultBatchTransactionAccountClose
#[derive(Accounts)]
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
        mut,
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
        constraint = batch.index == proposal.transaction_index @ MultisigError::TransactionNotMatchingProposal,
    )]
    pub batch: Account<'info, Batch>,

    /// `VaultBatchTransaction` account to close.
    /// The transaction must be the current last one in the batch.
    #[account(
        mut,
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
    fn validate(&self) -> Result<()> {
        let Self {
            multisig,
            proposal,
            batch,
            transaction,
            ..
        } = self;

        // Transaction must be the last one in the batch.
        // We do it here instead of the Anchor macro because we want to throw a more specific error,
        // and the macro doesn't allow us to override the default "seeds constraint is violated" one.
        // First, derive the address of the last transaction as if provided transaction is the last one.
        let last_transaction_address = Pubkey::create_program_address(
            &[
                SEED_PREFIX,
                multisig.key().as_ref(),
                SEED_TRANSACTION,
                &batch.index.to_le_bytes(),
                SEED_BATCH_TRANSACTION,
                // Last transaction index.
                &batch.size.to_le_bytes(),
                // We can assume the transaction bump is correct here.
                &transaction.bump.to_le_bytes(),
            ],
            &crate::id(),
        )
        .map_err(|_| MultisigError::TransactionNotLastInBatch)?;

        // Then compare it to the provided transaction address.
        require_keys_eq!(
            transaction.key(),
            last_transaction_address,
            MultisigError::TransactionNotLastInBatch
        );

        let is_proposal_stale = proposal.transaction_index <= multisig.stale_transaction_index;

        #[allow(deprecated)]
        let can_close = match proposal.status {
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
    /// Closing a transaction reduces the `batch.size` by 1.
    /// `transaction` must be closed in the order from the last to the first,
    /// and the operation is only allowed if any of the following conditions is met:
    /// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
    /// - the `proposal` is stale and not `Approved`.
    #[access_control(ctx.accounts.validate())]
    pub fn vault_batch_transaction_account_close(ctx: Context<Self>) -> Result<()> {
        let batch = &mut ctx.accounts.batch;

        batch.size = batch.size.checked_sub(1).expect("overflow");

        // Anchor macro will close the `transaction` account for us.

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

    // pub proposal: Account<'info, Proposal>,
    /// CHECK: `seeds` and `bump` verify that the account is the canonical Proposal,
    ///         the logic within `batch_accounts_close` does the rest of the checks.
    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &batch.index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump,
    )]
    pub proposal: AccountInfo<'info>,

    /// `Batch` corresponding to the `proposal`.
    #[account(
        mut,
        has_one = multisig @ MultisigError::TransactionForAnotherMultisig,
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
    /// Closes Batch and the corresponding Proposal accounts for proposals in terminal states:
    /// `Executed`, `Rejected`, or `Cancelled` or stale proposals that aren't `Approved`.
    ///
    /// This instruction is only allowed to be executed when all `VaultBatchTransaction` accounts
    /// in the `batch` are already closed: `batch.size == 0`.
    pub fn batch_accounts_close(ctx: Context<Self>) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let batch = &ctx.accounts.batch;
        let proposal = &mut ctx.accounts.proposal;
        let rent_collector = &ctx.accounts.rent_collector;

        let is_stale = batch.index <= multisig.stale_transaction_index;

        let proposal_account = if proposal.data.borrow().is_empty() {
            None
        } else {
            Some(Proposal::try_deserialize(
                &mut &**proposal.data.borrow_mut(),
            )?)
        };

        #[allow(deprecated)]
        let can_close = if let Some(proposal_account) = &proposal_account {
            match proposal_account.status {
                // Draft proposals can only be closed if stale,
                // so they can't be activated anymore.
                ProposalStatus::Draft { .. } => is_stale,
                // Active proposals can only be closed if stale,
                // so they can't be voted on anymore.
                ProposalStatus::Active { .. } => is_stale,
                // Approved proposals for `Batch`s cannot be closed even if stale,
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
            }
        } else {
            // If no Proposal account exists then the Batch can only be closed if stale
            is_stale
        };

        require!(can_close, MultisigError::InvalidProposalStatus);

        // Batch must be empty.
        require_eq!(batch.size, 0, MultisigError::BatchNotEmpty);

        // Close the `proposal` account if exists.
        if proposal_account.is_some() {
            utils::close(
                ctx.accounts.proposal.to_account_info(),
                rent_collector.to_account_info(),
            )?;
        }

        // Anchor will close the `batch` account for us.
        Ok(())
    }
}
//endregion
