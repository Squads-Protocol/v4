use anchor_lang::prelude::*;

use anchor_spl::token::ID as TOKEN_PROGRAM_ID;
use spl_token::instruction::TokenInstruction;

use squads_multisig_program::{
    Multisig, Proposal, ProposalStatus, VaultTransaction, SEED_PREFIX, SEED_PROPOSAL,
    SEED_TRANSACTION, SEED_VAULT,
};

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct SquadsHookSpendingLimitUseArgs {
    pub vault_index: u8,
}

#[derive(Accounts)]
#[instruction(args: SquadsHookSpendingLimitUseArgs)]
pub struct SquadsHookSpendingLimitUse<'info> {
    // Make sure the multisig belongs to the spending limit config
    #[account(
        address = spending_limit_config.multisig,
    )]
    pub multisig: Account<'info, Multisig>,
    // Make sure the vault belongs to the multisig
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_VAULT,
            args.vault_index.to_le_bytes().as_ref(),
        ],
        bump
    )]
    pub vault: Signer<'info>,
    // Check that the proposal belongs to the transaction
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
            SEED_PROPOSAL],
            bump
        )]
    pub proposal: Account<'info, Proposal>,

    // Check that the transaction belongs to the multisig
    #[account(
            constraint = transaction.multisig == multisig.key(),
        )]
    pub transaction: Account<'info, VaultTransaction>,
    // Make sure the spending limit config belongs to the multisig
    #[account(
        seeds = [
            SEED_HOOK,
            multisig.key().as_ref(),
            SEED_SPENDING_LIMIT,
        ],
        bump,
    )]
    pub spending_limit_config: Account<'info, SpendingLimitConfig>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl SquadsHookSpendingLimitUse<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            spending_limit_config,
            proposal,
            transaction,
            ..
        } = self;
        // Check that the proposal is active
        require!(
            matches!(proposal.status, ProposalStatus::Active { .. }),
            HookError::ProposalNotActive
        );
        // Check that proposal has at lease one approval
        require!(proposal.approved.len() > 0, HookError::ProposalNotApproved);

        // Check that the approval is from a member that is a part of the
        // spending limit config
        let approvals: Vec<&Pubkey> = proposal.approved.iter().collect();
        let spending_limit_config_members = &spending_limit_config.members;
        let is_valid_member = approvals
            .iter()
            .any(|approval| spending_limit_config_members.contains(approval));

        require!(is_valid_member, HookError::InvalidMember);
        // Check that the proposal does not have a cancellation vote
        require!(
            proposal.cancelled.len() == 0,
            HookError::ProposalNotApproved
        );

        // Check that each instruction invokes the token program with the
        // correct mint and discriminator for a transfer
        let instructions = transaction.message.instructions.iter();
        let account_keys = &transaction.message.account_keys;
        let token_program_index = account_keys
            .iter()
            .position(|key| key.eq(&TOKEN_PROGRAM_ID));
        // If the token program is not in the account keys, then the transaction is invalid
        require!(token_program_index.is_some(), HookError::InvalidTransaction);

        // Get the remaining spending limit
        let mut remaining_spending_limit = spending_limit_config.remaining_amount;
        let current_timestamp = Clock::get()?.unix_timestamp;
        let last_limit_reset = spending_limit_config.last_reset;
        let period = spending_limit_config.period;

        if last_limit_reset
            .checked_add(period.to_seconds().unwrap())
            .unwrap()
            < current_timestamp
        {
            // Consider the spending limit reset (Actually resetting of the
            // limit occurs in the handler function)
            remaining_spending_limit = spending_limit_config.amount;
        }
        // Spending limit must be greater than 0
        require!(
            remaining_spending_limit > 0,
            HookError::SpendingLimitExhausted
        );

        // Total transfer amounts in the transaction
        let mut total_transfer_amount: u64 = 0;

        // Check that each instruction invokes the token program with a transfer
        for instruction in instructions {
            if instruction.program_id_index as usize == token_program_index.unwrap() {
                let instruction_data = &instruction.data;
                let transfer_instruction =
                    TokenInstruction::unpack(instruction_data.as_slice()).unwrap();
                match transfer_instruction {
                    TokenInstruction::Transfer { amount } => {
                        total_transfer_amount = total_transfer_amount.checked_add(amount).unwrap();

                        // Check that the destination is a valid address
                        let transfer_destination_index = instruction.account_indexes[1] as usize;
                        let transfer_destination_address = account_keys[transfer_destination_index];

                        require!(
                            spending_limit_config
                                .destinations
                                .contains(&transfer_destination_address),
                            HookError::InvalidDestination
                        );
                    }
                    _ => {
                        return err!(HookError::InvalidTransaction);
                    }
                }
            }
        }
        // Check that the total transfer amount is equal to the remaining
        // spending limit
        require!(
            total_transfer_amount <= remaining_spending_limit,
            HookError::AmountExceedsSpendingLimit
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn handler(ctx: Context<Self>) -> Result<()> {
        // Mutable Accounts
        let spending_limit_config = &mut ctx.accounts.spending_limit_config;

        // Readonly Accounts
        let transaction = &ctx.accounts.transaction;

        // Data
        let current_timestamp = Clock::get()?.unix_timestamp;
        let mut new_reset_timestamp = spending_limit_config.last_reset;

        // Check if reset is needed
        let mut reset_needed = false;
        if let Some(reset_period) = spending_limit_config.period.to_seconds() {
            let time_since_last_reset = current_timestamp
                .checked_sub(spending_limit_config.last_reset)
                .unwrap();

            if time_since_last_reset >= reset_period {
                reset_needed = true;
                let periods_passed = time_since_last_reset.checked_div(reset_period).unwrap();
                new_reset_timestamp = spending_limit_config
                    .last_reset
                    .checked_add(periods_passed.checked_mul(reset_period).unwrap())
                    .unwrap();
            }
        }

        // Reset the spending limit if needed
        if reset_needed {
            spending_limit_config.remaining_amount = spending_limit_config.amount;
            spending_limit_config.last_reset = new_reset_timestamp;
        }

        // Get total transfer amounts in the transaction
        let mut total_transfer_amount: u64 = 0;
        for instruction in transaction.message.instructions.iter() {
            let instruction_data = &instruction.data;
            let transfer_instruction =
                TokenInstruction::unpack(instruction_data.as_slice()).unwrap();
            match transfer_instruction {
                TokenInstruction::Transfer { amount } => {
                    total_transfer_amount = total_transfer_amount.checked_add(amount).unwrap();
                }
                _ => {
                    // Should never happen since the transaction is validated in validate()
                    return err!(HookError::InvalidTransaction);
                }
            }
        }

        // Set the remaining spending limit
        spending_limit_config.remaining_amount = spending_limit_config
            .amount
            .checked_sub(total_transfer_amount)
            .unwrap();
        Ok(())
    }
}
