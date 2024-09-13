use anchor_lang::prelude::*;
use anchor_spl::token::ID as TOKEN_PROGRAM_ID;
use anchor_spl::token_2022::TransferChecked;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use spl_token::instruction::TokenInstruction;

use spl_token::solana_program::system_instruction::SystemInstruction;
use squads_multisig_program::{
    Multisig, Proposal, ProposalStatus, VaultTransaction, SEED_HOOK_AUTHORITY, SEED_PREFIX,
    SEED_PROPOSAL, SEED_TRANSACTION, SEED_VAULT,
};

use crate::errors::*;
use crate::state::*;

// SOL mint address
pub const SOL_MINT: Pubkey = Pubkey::new_from_array([
    6, 155, 136, 87, 254, 171, 129, 132, 251, 104, 127, 99, 70, 24, 192, 53, 218, 196, 57, 220, 26,
    235, 59, 85, 152, 160, 240, 0, 0, 0, 0, 1,
]);

#[derive(Accounts)]
pub struct SquadsHookSpendingLimitUse<'info> {
    #[account(
        address = spending_limit_config.multisig,
    )]
    pub multisig: InterfaceAccount<'info, MultisigAccount>,
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.index.to_le_bytes(),
            SEED_PROPOSAL],
            bump,
            seeds::program = MULTISIG_TEST_ID
        )]
    pub proposal: InterfaceAccount<'info, ProposalAccount>,
    #[account(
        constraint = transaction.multisig == multisig.key(),
    )]
    pub transaction: InterfaceAccount<'info, VaultTransactionAccount>,
    #[account(
        seeds = [
            SEED_HOOK,
            multisig.key().as_ref(),
            SEED_SPENDING_LIMIT,
        ],
        bump,
    )]
    pub spending_limit_config: Account<'info, SpendingLimitConfig>,
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_HOOK_AUTHORITY
        ],
        bump,
        seeds::program = MULTISIG_TEST_ID
    )]
    pub hook_authority: Signer<'info>,
}

impl SquadsHookSpendingLimitUse<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            spending_limit_config,
            proposal,
            transaction,
            ..
        } = self;

        require!(proposal.rejected.len() == 0, HookError::ProposalNotApproved);

        let approvals: Vec<&Pubkey> = proposal.approved.iter().collect();
        let spending_limit_config_members = &spending_limit_config.members;

        let is_valid_member = approvals
            .iter()
            .any(|approval| spending_limit_config_members.contains(approval));

        require!(is_valid_member, HookError::InvalidMember);
        require!(
            proposal.cancelled.len() == 0,
            HookError::ProposalNotApproved
        );

        let instructions = transaction.message.instructions.iter();
        let account_keys = &transaction.message.account_keys;

        let mut remaining_spending_limit = spending_limit_config.remaining_amount;
        let current_timestamp = Clock::get()?.unix_timestamp;
        let last_limit_reset = spending_limit_config.last_reset;
        let period = spending_limit_config.period;

        if let Some(reset_period) = period.to_seconds() {
            if last_limit_reset.checked_add(reset_period).unwrap() < current_timestamp {
                remaining_spending_limit = spending_limit_config.amount;
            }
        }
        require!(
            remaining_spending_limit > 0,
            HookError::SpendingLimitExhausted
        );

        let mut total_transfer_amount: u64 = 0;

        for instruction in instructions {
            let program_id = account_keys[instruction.program_id_index as usize];

            if spending_limit_config.mint == SOL_MINT {
                // Allow only SystemProgram instructions for SOL transfers
                if program_id == System::id() {
                    let system_instruction = instruction.data[0];

                    if system_instruction == 2 {
                        let lamports_as_bytes: [u8; 8] =
                            instruction.data[4..12].try_into().unwrap();
                        let lamports = u64::from_le_bytes(lamports_as_bytes);
                        total_transfer_amount =
                            total_transfer_amount.checked_add(lamports).unwrap();

                        let transfer_destination_index = instruction.account_indexes[1] as usize;
                        let transfer_destination_address = account_keys[transfer_destination_index];

                        require!(
                            spending_limit_config
                                .destinations
                                .contains(&transfer_destination_address),
                            HookError::InvalidDestination
                        );
                    } else {
                        return err!(HookError::InvalidTransaction);
                    }
                } else {
                    return err!(HookError::InvalidTransaction);
                }
            } else {
                msg!("Not SOL");
                // For all other mints, allow only TokenProgram instructions
                if program_id == TOKEN_PROGRAM_ID {
                    let instruction_data = &instruction.data;
                    let transfer_instruction =
                        TokenInstruction::unpack(instruction_data.as_slice()).unwrap();
                    match transfer_instruction {
                        TokenInstruction::Transfer { amount } => {
                            total_transfer_amount =
                                total_transfer_amount.checked_add(amount).unwrap();

                            let transfer_destination_index =
                                instruction.account_indexes[1] as usize;
                            let transfer_destination_address =
                                account_keys[transfer_destination_index];

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
                } else {
                    msg!("Not Token Program or SOL");
                    return err!(HookError::InvalidTransaction);
                }
            }
        }
        require!(
            total_transfer_amount <= remaining_spending_limit,
            HookError::AmountExceedsSpendingLimit
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn handler(ctx: Context<Self>) -> Result<()> {
        let spending_limit_config = &mut ctx.accounts.spending_limit_config;
        let transaction = &ctx.accounts.transaction;

        let current_timestamp = Clock::get()?.unix_timestamp;
        let mut new_reset_timestamp = spending_limit_config.last_reset;

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

        if reset_needed {
            spending_limit_config.remaining_amount = spending_limit_config.amount;
            spending_limit_config.last_reset = new_reset_timestamp;
        }

        let mut total_transfer_amount: u64 = 0;
        for instruction in transaction.message.instructions.iter() {
            let program_id =
                transaction.message.account_keys[instruction.program_id_index as usize];

            if spending_limit_config.mint == SOL_MINT {
                if program_id == System::id() {
                    let system_instruction = instruction.data[0];
                    if system_instruction == 2 {
                        let lamports_as_bytes: [u8; 8] =
                            instruction.data[4..12].try_into().unwrap();
                        let lamports = u64::from_le_bytes(lamports_as_bytes);
                        total_transfer_amount =
                            total_transfer_amount.checked_add(lamports).unwrap();
                    } else {
                        return err!(HookError::InvalidTransaction);
                    }
                } else {
                    return err!(HookError::InvalidTransaction);
                }
            } else {
                if program_id == TOKEN_PROGRAM_ID {
                    let instruction_data = &instruction.data;
                    let transfer_instruction =
                        TokenInstruction::unpack(instruction_data.as_slice()).unwrap();
                    match transfer_instruction {
                        TokenInstruction::Transfer { amount } => {
                            total_transfer_amount =
                                total_transfer_amount.checked_add(amount).unwrap();
                        }
                        _ => {
                            return err!(HookError::InvalidTransaction);
                        }
                    }
                } else {
                    return err!(HookError::InvalidTransaction);
                }
            }
        }

        spending_limit_config.remaining_amount = spending_limit_config
            .amount
            .checked_sub(total_transfer_amount)
            .unwrap();

        msg!("Hook Passed");
        msg!("Total transfer amount: {}", total_transfer_amount);
        msg!(
            "Remaining spending limit: {}",
            spending_limit_config.remaining_amount
        );

        Ok(())
    }
}
