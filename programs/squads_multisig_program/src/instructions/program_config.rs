use anchor_lang::prelude::*;

use crate::errors::MultisigError;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProgramConfigSetAuthorityArgs {
    pub new_authority: Pubkey,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProgramConfigSetMultisigCreationFeeArgs {
    pub new_multisig_creation_fee: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ProgramConfigSetTreasuryArgs {
    pub new_treasury: Pubkey,
}

#[derive(Accounts)]
pub struct ProgramConfig<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_PROGRAM_CONFIG],
        bump,
    )]
    pub program_config: Account<'info, crate::state::ProgramConfig>,

    pub authority: Signer<'info>,
}

impl ProgramConfig<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            program_config,
            authority,
        } = self;

        // authority
        require_keys_eq!(
            program_config.authority,
            authority.key(),
            MultisigError::Unauthorized
        );

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn program_config_set_authority(
        ctx: Context<Self>,
        args: ProgramConfigSetAuthorityArgs,
    ) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.authority = args.new_authority;

        program_config.invariant()?;

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn program_config_set_multisig_creation_fee(
        ctx: Context<Self>,
        args: ProgramConfigSetMultisigCreationFeeArgs,
    ) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.multisig_creation_fee = args.new_multisig_creation_fee;

        program_config.invariant()?;

        Ok(())
    }

    #[access_control(ctx.accounts.validate())]
    pub fn program_config_set_treasury(
        ctx: Context<Self>,
        args: ProgramConfigSetTreasuryArgs,
    ) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.treasury = args.new_treasury;

        program_config.invariant()?;

        Ok(())
    }
}
