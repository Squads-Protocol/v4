use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
pub struct VaultTransactionExecute<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Multisig>>,

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
    pub transaction: Account<'info, VaultTransaction>,

    pub member: Signer<'info>,
    // `remaining_accounts` must include the following accounts in the exact order:
    // 1. AddressLookupTable accounts in the order they appear in `message.address_table_lookups`.
    // 2. Accounts in the order they appear in `message.account_keys`.
    // 3. Accounts in the order they appear in `message.address_table_lookups`.
}

impl VaultTransactionExecute<'_> {
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
        // Stale vault transaction proposals CAN be executed if they were approved
        // before becoming stale, hence no check for staleness here.

        // `transaction` is validated by its seeds.

        Ok(())
    }

    /// Execute the multisig transaction.
    /// The transaction must be `Approved`.
    #[access_control(ctx.accounts.validate())]
    pub fn vault_transaction_execute(ctx: Context<Self>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let proposal = &mut ctx.accounts.proposal;
        let transaction = &mut ctx.accounts.transaction;

        let multisig_key = multisig.key();
        let transaction_key = transaction.key();

        let vault_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            SEED_VAULT,
            &transaction.vault_index.to_le_bytes(),
            &[transaction.vault_bump],
        ];

        let transaction_message = &transaction.message;
        let num_lookups = transaction_message.address_table_lookups.len();

        let message_account_infos = ctx
            .remaining_accounts
            .get(num_lookups..)
            .ok_or(MultisigError::InvalidNumberOfAccounts)?;
        let address_lookup_table_account_infos = ctx
            .remaining_accounts
            .get(..num_lookups)
            .ok_or(MultisigError::InvalidNumberOfAccounts)?;

        let vault_pubkey = Pubkey::create_program_address(vault_seeds, ctx.program_id).unwrap();

        let (ephemeral_signer_keys, ephemeral_signer_seeds) =
            derive_ephemeral_signers(transaction_key, &transaction.ephemeral_signer_bumps);

        let executable_message = ExecutableTransactionMessage::new_validated(
            transaction_message,
            message_account_infos,
            address_lookup_table_account_infos,
            &vault_pubkey,
            &ephemeral_signer_keys,
        )?;

        let protected_accounts = &[proposal.key()];

        // Execute the transaction message instructions one-by-one.
        executable_message.execute_message(
            &vault_seeds
                .iter()
                .map(|seed| seed.to_vec())
                .collect::<Vec<Vec<u8>>>(),
            &ephemeral_signer_seeds,
            protected_accounts,
        )?;

        // Mark the proposal as executed.
        proposal.status = ProposalStatus::Executed {
            timestamp: Clock::get()?.unix_timestamp,
        };

        Ok(())
    }
}
