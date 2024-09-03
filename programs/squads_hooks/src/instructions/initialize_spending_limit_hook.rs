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

// Define both program IDs
pub const MULTISIG_PROD_ID: Pubkey = Pubkey::new_from_array([
    6, 129, 196, 206, 71, 226, 35, 104, 184, 177, 85, 94, 200, 135, 175, 9, 46, 252, 126, 251, 182,
    108, 163, 245, 47, 191, 104, 212, 172, 156, 183, 168,
]);

pub const MULTISIG_TEST_ID: Pubkey = Pubkey::new_from_array([
    237, 101, 90, 99, 90, 225, 153, 19, 150, 14, 112, 117, 39, 184, 124, 3, 6, 215, 40, 129, 144,
    226, 241, 237, 44, 118, 135, 253, 189, 190, 158, 104,
]);

// Include both IDs in the static array
static IDS: [Pubkey; 2] = [MULTISIG_PROD_ID, MULTISIG_TEST_ID];

#[derive(Clone)]
pub struct MultisigAccount(Multisig);

impl anchor_lang::AccountDeserialize for MultisigAccount {
    fn try_deserialize_unchecked(buf: &mut &[u8]) -> Result<Self> {
        Multisig::try_deserialize(buf).map(MultisigAccount)
    }
}

impl anchor_lang::AccountSerialize for MultisigAccount {
    fn try_serialize<W: std::io::Write>(&self, writer: &mut W) -> Result<()> {
        self.0.try_serialize(writer)
    }
}

impl anchor_lang::Owners for MultisigAccount {
    fn owners() -> &'static [Pubkey] {
        &IDS
    }
}

impl Deref for MultisigAccount {
    type Target = Multisig;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl MultisigAccount {
    pub fn new(multisig: Multisig) -> Self {
        MultisigAccount(multisig)
    }
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
