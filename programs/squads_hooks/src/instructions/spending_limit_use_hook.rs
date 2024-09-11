use anchor_lang::prelude::*;
use anchor_spl::token::ID as TOKEN_PROGRAM_ID;
use anchor_spl::token_2022::TransferChecked;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use spl_token::instruction::TokenInstruction;

use spl_token::solana_program::system_instruction::SystemInstruction;
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
    #[account(
        address = spending_limit_config.multisig,
    )]
    pub multisig: Account<'info, Multisig>,
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
    #[account(
        constraint = transaction.multisig == multisig.key(),
    )]
    pub transaction: Account<'info, VaultTransaction>,
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

        require!(
            matches!(proposal.status, ProposalStatus::Active { .. }),
            HookError::ProposalNotActive
        );
        require!(proposal.approved.len() > 0, HookError::ProposalNotApproved);

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

        if last_limit_reset
            .checked_add(period.to_seconds().unwrap())
            .unwrap()
            < current_timestamp
        {
            remaining_spending_limit = spending_limit_config.amount;
        }

        require!(
            remaining_spending_limit > 0,
            HookError::SpendingLimitExhausted
        );

        let mut total_transfer_amount: u64 = 0;

        for instruction in instructions {
            let program_id = account_keys[instruction.program_id_index as usize];

            if program_id == TOKEN_PROGRAM_ID {
                let instruction_data = &instruction.data;
                let transfer_instruction =
                    TokenInstruction::unpack(instruction_data.as_slice()).unwrap();
                match transfer_instruction {
                    TokenInstruction::Transfer { amount } => {
                        total_transfer_amount = total_transfer_amount.checked_add(amount).unwrap();

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
            } else if program_id == System::id() {
                // Handle native SOL transfer
                let system_instruction = instruction.data[0];

                if system_instruction == 2 {
                    let lamports_as_bytes : [u8; 8] = instruction.data[1..9].try_into().unwrap();
                    let lamports = u64::from_le_bytes(lamports_as_bytes);

                    total_transfer_amount = total_transfer_amount.checked_add(lamports).unwrap();

                    let transfer_destination_index = instruction.account_indexes[1] as usize;
                    let transfer_destination_address = account_keys[transfer_destination_index];

                    require!(
                        spending_limit_config
                            .destinations
                            .contains(&transfer_destination_address),
                        HookError::InvalidDestination
                    );
                }
            } else {
                return err!(HookError::InvalidTransaction);
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
        let program_id = transaction.message.account_keys[instruction.program_id_index as usize];

        if program_id == TOKEN_PROGRAM_ID {
            let instruction_data = &instruction.data;
            let transfer_instruction =
                TokenInstruction::unpack(instruction_data.as_slice()).unwrap();
            match transfer_instruction {
                TokenInstruction::Transfer { amount } => {
                    total_transfer_amount = total_transfer_amount.checked_add(amount).unwrap();
                }
                _ => {
                    return err!(HookError::InvalidTransaction);
                }
            }
        } else if program_id == System::id() {
            // Handle native SOL transfer
            let system_instruction = instruction.data[0];

            if system_instruction == 2 {
                let lamports_as_bytes : [u8; 8] = instruction.data[1..9].try_into().unwrap();
                let lamports = u64::from_le_bytes(lamports_as_bytes);

                total_transfer_amount = total_transfer_amount.checked_add(lamports).unwrap();
            }
        } else {
            return err!(HookError::InvalidTransaction);
        }
    }

    spending_limit_config.remaining_amount = spending_limit_config
        .amount
        .checked_sub(total_transfer_amount)
        .unwrap();
    Ok(())
}
}