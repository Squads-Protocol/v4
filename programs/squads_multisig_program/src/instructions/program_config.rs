#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(feature = "program")]
use crate::events::{
    self, LogAuthority, MultisigEvent, ProgramConfigEvent, ProgramConfigEventKind,
};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
#[cfg(feature = "program")]
use crate::state::*;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct ProgramConfigSetAuthorityArgs {
    pub new_authority: Pubkey,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct ProgramConfigSetMultisigCreationFeeArgs {
    pub new_multisig_creation_fee: u64,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct ProgramConfigSetTreasuryArgs {
    pub new_treasury: Pubkey,
}

#[cfg(feature = "program")]
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

#[cfg(feature = "program")]
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

    fn emit_event(ctx: &Context<Self>, kind: ProgramConfigEventKind) -> Result<()> {
        let program_config = &ctx.accounts.program_config;
        events::emit(
            events::enabled(ctx.remaining_accounts),
            || LogAuthority::program_config(program_config, ctx.bumps.program_config),
            || {
                vec![MultisigEvent::ProgramConfig(ProgramConfigEvent {
                    kind,
                    program_config: program_config.key(),
                    authority: ctx.accounts.authority.key(),
                    snapshot: Cow::Borrowed(program_config),
                })]
            },
        )
    }

    #[access_control(ctx.accounts.validate())]
    pub fn program_config_set_authority(
        ctx: Context<Self>,
        args: ProgramConfigSetAuthorityArgs,
    ) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.authority = args.new_authority;

        program_config.invariant()?;

        Self::emit_event(&ctx, ProgramConfigEventKind::SetAuthority)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn program_config_set_multisig_creation_fee(
        ctx: Context<Self>,
        args: ProgramConfigSetMultisigCreationFeeArgs,
    ) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.multisig_creation_fee = args.new_multisig_creation_fee;

        program_config.invariant()?;

        Self::emit_event(&ctx, ProgramConfigEventKind::SetMultisigCreationFee)
    }

    #[access_control(ctx.accounts.validate())]
    pub fn program_config_set_treasury(
        ctx: Context<Self>,
        args: ProgramConfigSetTreasuryArgs,
    ) -> Result<()> {
        let program_config = &mut ctx.accounts.program_config;

        program_config.treasury = args.new_treasury;

        program_config.invariant()?;

        Self::emit_event(&ctx, ProgramConfigEventKind::SetTreasury)
    }
}
