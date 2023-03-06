use anchor_lang::prelude::*;

use crate::errors::*;
use crate::events::*;
use crate::state::*;

#[derive(Accounts)]
pub struct ConfigTransactionExecute<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Multisig>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.transaction_index.to_le_bytes(),
        ],
        bump = transaction.bump,
        constraint = transaction.multisig == multisig.key() @ MultisigError::TransactionNotForMultisig,
        constraint = transaction.status == TransactionStatus::ExecuteReady @ MultisigError::InvalidTransactionStatus,
        constraint = Clock::get()?.unix_timestamp - transaction.settled_at > i64::from(multisig.time_lock) @ MultisigError::TimeLockNotReleased
    )]
    pub transaction: Account<'info, ConfigTransaction>,

    /// One of the multisig members with `Execute` permission.
    #[account(
        constraint = multisig.is_member(member.key()).is_some() @ MultisigError::NotAMember,
        constraint = multisig.member_has_permission(member.key(), Permission::Execute) @ MultisigError::Unauthorized,
    )]
    pub member: Signer<'info>,

    /// The account that will be charged in case the multisig account needs to reallocate space,
    /// for example when adding a new member.
    /// This is usually the same as `member`, but can be a different account if needed.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    /// We might need it in case reallocation is needed.
    pub system_program: Program<'info, System>,
}

impl ConfigTransactionExecute<'_> {
    /// Execute the multisig transaction.
    /// The transaction must be `ExecuteReady`.
    pub fn config_transaction_execute(ctx: Context<Self>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let rent_payer = &ctx.accounts.rent_payer;
        let system_program = &ctx.accounts.system_program;

        let multisig_key = multisig.key();
        let transaction_key = transaction.key();

        // Check applying the config actions will require reallocation of space for the multisig account.
        let new_members_length =
            members_length_after_actions(multisig.members.len(), &transaction.actions);
        let reallocated = Multisig::realloc_if_needed(
            multisig.to_account_info(),
            new_members_length,
            rent_payer.to_account_info(),
            system_program.to_account_info(),
        )?;
        if reallocated {
            multisig.reload()?;
        }

        // Execute the actions one by one.
        for action in transaction.actions.iter() {
            match action {
                ConfigAction::AddMember { new_member } => {
                    multisig.add_member(new_member.to_owned());

                    multisig.config_updated(
                        multisig_key,
                        ConfigUpdateType::AddMember { reallocated },
                        None,
                    );
                }

                ConfigAction::RemoveMember { old_member } => {
                    multisig.remove_member(old_member.to_owned())?;

                    multisig.config_updated(multisig_key, ConfigUpdateType::RemoveMember, None);
                }

                ConfigAction::ChangeThreshold { new_threshold } => {
                    multisig.threshold = *new_threshold;

                    multisig.config_updated(multisig_key, ConfigUpdateType::ChangeThreshold, None);
                }
            }
        }

        // After all the actions are applied, update the threshold if necessary.
        if usize::from(multisig.threshold) > multisig.members.len() {
            multisig.threshold = multisig
                .members
                .len()
                .try_into()
                .expect("didn't expect more that `u16::MAX` members");
        };

        // Make sure the multisig state is valid after applying the actions.
        multisig.invariant()?;

        // Mark the tx as executed.
        transaction.status = TransactionStatus::Executed;

        emit!(TransactionExecuted {
            multisig: multisig_key,
            transaction: transaction_key,
        });

        Ok(())
    }
}

fn members_length_after_actions(members_length: usize, actions: &[ConfigAction]) -> usize {
    let members_delta: isize = actions.iter().fold(0, |acc, action| match action {
        ConfigAction::AddMember { .. } => acc + 1,
        ConfigAction::RemoveMember { .. } => acc - 1,
        ConfigAction::ChangeThreshold { .. } => acc,
    });

    let abs_members_delta =
        usize::try_from(members_delta.checked_abs().expect("overflow")).expect("overflow");

    if members_delta.is_negative() {
        members_length
            .checked_sub(abs_members_delta)
            .expect("overflow")
    } else {
        members_length
            .checked_add(abs_members_delta)
            .expect("overflow")
    }
}
