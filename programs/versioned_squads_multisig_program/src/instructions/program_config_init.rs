use crate::errors::MultisigError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::pubkey;

use crate::state::*;

/// This is a key controlled by the Squads team and is intended to use for the single
/// transaction that initializes the global program config. It is not used for anything else.
#[cfg(not(feature = "testing"))]
const INITIALIZER: Pubkey = pubkey!("HM5y4mz3Bt9JY9mr1hkyhnvqxSH4H2u2451j7Hc2dtvK");

#[cfg(feature = "testing")]
const INITIALIZER: Pubkey = pubkey!("BrQAbGdWQ9YUHmWWgKFdFe4miTURH71jkYFPXfaosqDv");

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProgramConfigInitArgs {
    /// The authority that can configure the program config: change the treasury, etc.
    pub authority: Pubkey,
    /// The fee that is charged for creating a new multisig.
    pub multisig_creation_fee: u64,
    /// The treasury where the creation fee is transferred to.
    pub treasury: Pubkey,
}

#[derive(Accounts)]
pub struct ProgramConfigInit<'info> {
    #[account(
        init,
        payer = initializer,
        space = 8 + ProgramConfig::INIT_SPACE,
        seeds = [SEED_PREFIX, SEED_PROGRAM_CONFIG],
        bump
    )]
    pub program_config: Account<'info, ProgramConfig>,

    /// The hard-coded account that is used to initialize the program config once.
    #[account(
        mut,
        address = INITIALIZER @ MultisigError::Unauthorized
    )]
    pub initializer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl ProgramConfigInit<'_> {
    /// A one-time instruction that initializes the global program config.
    pub fn program_config_init(ctx: Context<Self>, args: ProgramConfigInitArgs) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.authority = args.authority;
        program_config.multisig_creation_fee = args.multisig_creation_fee;
        program_config.treasury = args.treasury;

        program_config.invariant()?;

        Ok(())
    }
}
