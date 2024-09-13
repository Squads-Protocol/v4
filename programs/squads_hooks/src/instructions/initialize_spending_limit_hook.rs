use std::{
    ops::{Deref, Mul},
    str::FromStr,
};

use anchor_lang::prelude::*;
use squads_multisig_program::{
    program::SquadsMultisigProgram, Multisig, Period, SEED_MULTISIG as MULTISIG_SEED_MULTISIG,
    SEED_PREFIX as MULTISIG_SEED_PREFIX,
};

use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct InitializeSpendingLimitHookArgs {
    pub amount: u64,
    pub period: Period,
    pub mint: Pubkey,
    pub members: Vec<Pubkey>,
    pub destinations: Vec<Pubkey>,
}






#[derive(Accounts)]
#[instruction(args: InitializeSpendingLimitHookArgs)]
pub struct InitializeSpendingLimitHook<'info> {
    #[account(
        signer,
        seeds = [
            MULTISIG_SEED_PREFIX,
            MULTISIG_SEED_MULTISIG,
            multisig.create_key.as_ref(),
        ],
        bump = multisig.bump,
        seeds::program = MULTISIG_TEST_ID
    )]
    pub multisig: InterfaceAccount<'info, MultisigAccount>,

    // Make sure the vault belongs to the multisig
    #[account(
        init,
        seeds = [
            SEED_HOOK,
            multisig.key().as_ref(),
            SEED_SPENDING_LIMIT,
        ],
        bump,
        space = SpendingLimitConfig::size(args.members.len(), args.destinations.len()),
        payer = fee_payer
    )]
    pub spending_limit_config: Account<'info, SpendingLimitConfig>,
    #[account(mut)]
    pub fee_payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl InitializeSpendingLimitHook<'_> {
    pub fn handler(ctx: Context<Self>, args: InitializeSpendingLimitHookArgs) -> Result<()> {
        // Mutable Accounts
        let spending_limit_config = &mut ctx.accounts.spending_limit_config;

        // Readonly Accounts
        let multisig = &ctx.accounts.multisig;

        // Data
        let amount = args.amount;
        let period = args.period;
        let mint = args.mint;
        let members = args.members;
        let destinations = args.destinations;

        // Write to SpendingLimitConfig
        spending_limit_config.multisig = multisig.key();
        spending_limit_config.mint = mint;
        spending_limit_config.members = members;
        spending_limit_config.amount = amount;
        spending_limit_config.period = period;
        spending_limit_config.destinations = destinations;
        spending_limit_config.last_reset = Clock::get()?.unix_timestamp;
        spending_limit_config.remaining_amount = amount;
        Ok(())
    }
}
