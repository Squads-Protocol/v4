use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(Accounts)]
pub struct ConfigTransactionAccountsClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut, close = rent_collector)]
    pub proposal: Account<'info, Proposal>,

    /// ConfigTransaction corresponding to the `proposal`.
    #[account(mut, close = rent_collector)]
    pub transaction: Account<'info, ConfigTransaction>,

    /// The rent collector.
    /// CHECK: We do the checks in validate().
    #[account(mut)]
    pub rent_collector: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl ConfigTransactionAccountsClose<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig,
            proposal,
            transaction,
            rent_collector,
            ..
        } = self;

        //region multisig

        // Has to have `rent_collector` set.
        let multisig_rent_collector_key = multisig
            .rent_collector
            .ok_or(MultisigError::RentReclamationDisabled)?
            .key();
        //endregion

        //region rent_collector

        // Has to match the `multisig.rent_collector`.
        require_keys_eq!(
            multisig_rent_collector_key,
            rent_collector.key(),
            MultisigError::InvalidRentCollector
        );
        //endregion

        //region proposal

        // Has to be for the `multisig`.
        require_keys_eq!(
            proposal.multisig,
            multisig.key(),
            MultisigError::ProposalForAnotherMultisig
        );

        // Has to be either stale or in a terminal state.
        require!(
            proposal.transaction_index <= multisig.stale_transaction_index
                || proposal.status.is_terminal(),
            MultisigError::InvalidProposalStatus
        );
        //endregion

        //region transaction

        // Has to be for the `multisig`.
        require_keys_eq!(
            transaction.multisig,
            multisig.key(),
            MultisigError::TransactionForAnotherMultisig
        );

        // Has to be for the `proposal`.
        require_eq!(
            transaction.index,
            proposal.transaction_index,
            MultisigError::TransactionForAnotherMultisig
        );
        //endregion

        Ok(())
    }

    /// Close accounts for stale config transactions or config transactions in terminal states: `Executed`, `Rejected`, or `Cancelled`.
    #[access_control(_ctx.accounts.validate())]
    pub fn config_transaction_accounts_close(_ctx: Context<Self>) -> Result<()> {
        // Anchor will close the accounts for us.
        Ok(())
    }
}
// The difference between `VaultTransactionAccountsClose` and `ConfigTransactionAccountsClose`:
// - types: VaultTransactionAccountsClose is for VaultTransaction, obviously;
// - closing conditions for stale txs are a bit more strict for VaultTransactionAccountsClose:
//   not all stale transactions can be closed, only the ones that are also non-Approved.
#[derive(Accounts)]
pub struct VaultTransactionAccountsClose<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(mut, close = rent_collector)]
    pub proposal: Account<'info, Proposal>,

    /// VaultTransaction corresponding to the `proposal`.
    #[account(mut, close = rent_collector)]
    pub transaction: Account<'info, VaultTransaction>,

    /// The rent collector.
    /// CHECK: We do the checks in validate().
    #[account(mut)]
    pub rent_collector: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

impl VaultTransactionAccountsClose<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig,
            proposal,
            transaction,
            rent_collector,
            ..
        } = self;

        //region multisig

        // Has to have `rent_collector` set.
        let multisig_rent_collector_key = multisig
            .rent_collector
            .ok_or(MultisigError::RentReclamationDisabled)?
            .key();
        //endregion

        //region rent_collector

        // Has to match the `multisig.rent_collector`.
        require_keys_eq!(
            multisig_rent_collector_key,
            rent_collector.key(),
            MultisigError::InvalidRentCollector
        );
        //endregion

        //region proposal

        // Has to be for the `multisig`.
        require_keys_eq!(
            proposal.multisig,
            multisig.key(),
            MultisigError::ProposalForAnotherMultisig
        );

        // Has to be in a terminal state or stale and non-Approved,
        // because vault transactions still can be executed if they
        // were Approved before they became stale.
        let is_stale = proposal.transaction_index <= multisig.stale_transaction_index;
        let is_approved = matches!(proposal.status, ProposalStatus::Approved { .. });
        require!(
            proposal.status.is_terminal() || (is_stale && !is_approved),
            MultisigError::InvalidProposalStatus
        );
        //endregion

        //region transaction

        // Has to be for the `multisig`.
        require_keys_eq!(
            transaction.multisig,
            multisig.key(),
            MultisigError::TransactionForAnotherMultisig
        );

        // Has to be for the `proposal`.
        require_eq!(
            transaction.index,
            proposal.transaction_index,
            MultisigError::TransactionForAnotherMultisig
        );
        //endregion

        Ok(())
    }

    /// Close accounts for vault transactions in terminal states: `Executed`, `Rejected`, or `Cancelled`
    /// or non-Approved stale vault transactions.
    #[access_control(_ctx.accounts.validate())]
    pub fn vault_transaction_accounts_close(_ctx: Context<Self>) -> Result<()> {
        // Anchor will close the accounts for us.
        Ok(())
    }
}
