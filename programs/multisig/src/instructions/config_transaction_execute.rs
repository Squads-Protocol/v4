use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

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
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
        ],
        bump = transaction.bump,
    )]
    pub transaction: Account<'info, ConfigTransaction>,

    /// The account that will be charged in case the multisig account needs to reallocate space,
    /// for example when adding a new member.
    /// This is usually the same as `member`, but can be a different account if needed.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    /// We might need it in case reallocation is needed.
    pub system_program: Program<'info, System>,
}

impl ConfigTransactionExecute<'_> {
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

        // `transaction` is validated by its seeds.

        Ok(())
    }

    /// Execute the multisig transaction.
    /// The transaction must be `Approved`.
    #[access_control(ctx.accounts.validate())]
    pub fn config_transaction_execute(ctx: Context<Self>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let proposal = &mut ctx.accounts.proposal;
        let rent_payer = &ctx.accounts.rent_payer;
        let system_program = &ctx.accounts.system_program;

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

                    multisig.config_updated();
                }

                ConfigAction::RemoveMember { old_member } => {
                    multisig.remove_member(old_member.to_owned())?;

                    multisig.config_updated();
                }

                ConfigAction::ChangeThreshold { new_threshold } => {
                    multisig.threshold = *new_threshold;

                    multisig.config_updated();
                }

                ConfigAction::SetTimeLock { new_time_lock } => {
                    multisig.time_lock = *new_time_lock;

                    multisig.config_updated();
                }

                ConfigAction::AddVault { new_vault_index } => {
                    require!(
                        *new_vault_index == multisig.vault_index.checked_add(1).expect("overflow"),
                        MultisigError::InvalidVaultIndex
                    );
                    multisig.vault_index = *new_vault_index;

                    multisig.config_updated();
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

        // Mark the proposal as executed.
        proposal.status = ProposalStatus::Executed {
            timestamp: Clock::get()?.unix_timestamp,
        };

        Ok(())
    }
}

fn members_length_after_actions(members_length: usize, actions: &[ConfigAction]) -> usize {
    let members_delta: isize = actions.iter().fold(0, |acc, action| match action {
        ConfigAction::AddMember { .. } => acc.checked_add(1).expect("overflow"),
        ConfigAction::RemoveMember { .. } => acc.checked_sub(1).expect("overflow"),
        ConfigAction::ChangeThreshold { .. } => acc,
        ConfigAction::SetTimeLock { .. } => acc,
        ConfigAction::AddVault { .. } => acc,
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
