use anchor_lang::prelude::*;

use crate::errors::*;
use crate::id;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
pub struct ConfigTransactionExecute<'info> {
    /// The multisig account that owns the transaction.
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Multisig>>,

    /// One of the multisig members with `Execute` permission.
    pub member: Signer<'info>,

    /// The proposal account associated with the transaction.
    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,

    /// The transaction to execute.
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
        ],
        bump = transaction.bump,
    )]
    pub transaction: Account<'info, ConfigTransaction>,

    /// The account that will be charged/credited in case the config transaction causes space reallocation,
    /// for example when adding a new member, adding or removing a spending limit.
    /// This is usually the same as `member`, but can be a different account if needed.
    #[account(mut)]
    pub rent_payer: Option<Signer<'info>>,

    /// We might need it in case reallocation is needed.
    pub system_program: Option<Program<'info, System>>,
    // In case the transaction contains Add(Remove)SpendingLimit actions,
    // `remaining_accounts` must contain the SpendingLimit accounts to be initialized/closed.
    // remaining_accounts
}

impl<'info> ConfigTransactionExecute<'info> {
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
            multisig.member_has_permission(member.key(), Permission::Execute),
            MultisigError::Unauthorized
        );

        // proposal
        match proposal.status {
            ProposalStatus::Approved { timestamp } => {
                require!(
                    Clock::get()?.unix_timestamp - timestamp >= i64::from(multisig.time_lock),
                    MultisigError::TimeLockNotReleased
                );
            }
            _ => return err!(MultisigError::InvalidProposalStatus),
        }
        // Stale config transaction proposals CANNOT be executed even if approved.
        require!(
            proposal.transaction_index > multisig.stale_transaction_index,
            MultisigError::StaleProposal
        );

        // `transaction` is validated by its seeds.

        Ok(())
    }

    /// Execute the multisig transaction.
    /// The transaction must be `Approved`.
    #[access_control(ctx.accounts.validate())]
    pub fn config_transaction_execute(ctx: Context<'_, '_, 'info, 'info, Self>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &ctx.accounts.transaction;
        let proposal = &mut ctx.accounts.proposal;

        let rent = Rent::get()?;

        // Execute the actions one by one.
        for action in transaction.actions.iter() {
            match action {
                ConfigAction::AddMember { new_member } => {
                    multisig.add_member(new_member.to_owned());

                    multisig.invalidate_prior_transactions();
                }

                ConfigAction::RemoveMember { old_member } => {
                    multisig.remove_member(old_member.to_owned())?;

                    multisig.invalidate_prior_transactions();
                }

                ConfigAction::ChangeThreshold { new_threshold } => {
                    multisig.threshold = *new_threshold;

                    multisig.invalidate_prior_transactions();
                }

                ConfigAction::SetTimeLock { new_time_lock } => {
                    multisig.time_lock = *new_time_lock;

                    multisig.invalidate_prior_transactions();
                }

                ConfigAction::AddSpendingLimit {
                    create_key,
                    vault_index,
                    mint,
                    amount,
                    period,
                    members,
                    destinations,
                } => {
                    let (spending_limit_key, spending_limit_bump) = Pubkey::find_program_address(
                        &[
                            SEED_PREFIX,
                            multisig.key().as_ref(),
                            SEED_SPENDING_LIMIT,
                            create_key.as_ref(),
                        ],
                        ctx.program_id,
                    );

                    // Find the SpendingLimit account in `remaining_accounts`.
                    let spending_limit_info = ctx
                        .remaining_accounts
                        .iter()
                        .find(|acc| acc.key == &spending_limit_key)
                        .ok_or(MultisigError::MissingAccount)?;

                    // `rent_payer` and `system_program` must also be present.
                    let rent_payer = &ctx
                        .accounts
                        .rent_payer
                        .as_ref()
                        .ok_or(MultisigError::MissingAccount)?;
                    let system_program = &ctx
                        .accounts
                        .system_program
                        .as_ref()
                        .ok_or(MultisigError::MissingAccount)?;

                    // Initialize the SpendingLimit account.
                    create_account(
                        rent_payer,
                        spending_limit_info,
                        system_program,
                        &id(),
                        &rent,
                        SpendingLimit::size(members.len(), destinations.len()),
                        vec![
                            SEED_PREFIX.to_vec(),
                            multisig.key().as_ref().to_vec(),
                            SEED_SPENDING_LIMIT.to_vec(),
                            create_key.as_ref().to_vec(),
                            vec![spending_limit_bump],
                        ],
                    )?;

                    let mut members = members.to_vec();
                    // Make sure members are sorted.
                    members.sort();

                    // Serialize the SpendingLimit data into the account info.
                    let spending_limit = SpendingLimit {
                        multisig: multisig.key().to_owned(),
                        create_key: create_key.to_owned(),
                        vault_index: *vault_index,
                        amount: *amount,
                        mint: *mint,
                        period: *period,
                        remaining_amount: *amount,
                        last_reset: Clock::get()?.unix_timestamp,
                        bump: spending_limit_bump,
                        members,
                        destinations: destinations.to_vec(),
                    };

                    spending_limit.invariant()?;

                    spending_limit
                        .try_serialize(&mut &mut spending_limit_info.data.borrow_mut()[..])?;
                }

                ConfigAction::RemoveSpendingLimit {
                    spending_limit: spending_limit_key,
                } => {
                    // Find the SpendingLimit account in `remaining_accounts`.
                    let spending_limit_info = ctx
                        .remaining_accounts
                        .iter()
                        .find(|acc| acc.key == spending_limit_key)
                        .ok_or(MultisigError::MissingAccount)?;

                    // `rent_payer` must also be present.
                    let rent_payer = &ctx
                        .accounts
                        .rent_payer
                        .as_ref()
                        .ok_or(MultisigError::MissingAccount)?;

                    let spending_limit = Account::<SpendingLimit>::try_from(spending_limit_info)?;

                    // SpendingLimit must belong to the `multisig`.
                    require_keys_eq!(
                        spending_limit.multisig,
                        multisig.key(),
                        MultisigError::InvalidAccount
                    );

                    spending_limit.close(rent_payer.to_account_info())?;

                    // We don't need to invalidate prior transactions here because adding
                    // a spending limit doesn't affect the consensus parameters of the multisig.
                }

                ConfigAction::SetRentCollector { new_rent_collector } => {
                    multisig.rent_collector = *new_rent_collector;

                    // We don't need to invalidate prior transactions here because changing
                    // `rent_collector` doesn't affect the consensus parameters of the multisig.
                }
            }
        }

        // Make sure the multisig account can fit the updated state: added members or newly set rent_collector.
        Multisig::realloc_if_needed(
            multisig.to_account_info(),
            multisig.members.len(),
            ctx.accounts
                .rent_payer
                .as_ref()
                .map(ToAccountInfo::to_account_info),
            ctx.accounts
                .system_program
                .as_ref()
                .map(ToAccountInfo::to_account_info),
        )?;

        // Make sure the multisig state is valid after applying the actions.
        multisig.invariant()?;

        // Mark the proposal as executed.
        proposal.status = ProposalStatus::Executed {
            timestamp: Clock::get()?.unix_timestamp,
        };

        Ok(())
    }
}
