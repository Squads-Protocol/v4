#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_lang::system_program;

#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(feature = "program")]
use crate::events::{self, LogAuthority, MultisigCreateEvent, MultisigEvent};
#[cfg(feature = "program")]
use crate::migration::v3::{self, LEGACY_V3_PROGRAM_ID, MAX_AUTHORITY_INDEX};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
#[cfg(feature = "program")]
use crate::state::*;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MultisigCreateFromV3Args {
    /// The index (1 to 256) of the v3 authority that signs. Any authority proves v3 consensus.
    pub authority_index: u32,
    /// The largest 4r creation fee that the v3 members approve. The fee is read at execution.
    pub max_creation_fee: u64,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
#[instruction(args: MultisigCreateFromV3Args)]
pub struct MultisigCreateFromV3<'info> {
    /// Global program config account.
    #[account(seeds = [SEED_PREFIX, SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,

    /// The treasury where the creation fee is transferred to.
    /// CHECK: validation is performed in the `MultisigCreateFromV3::validate()` method.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        owner = LEGACY_V3_PROGRAM_ID @ MultisigError::IllegalAccountOwner,
        constraint = (1..=MAX_AUTHORITY_INDEX).contains(&args.authority_index)
            @ MultisigError::MigrationInvalidAuthorityIndex,
    )]
    /// The v3 multisig. Its config is copied to the successor.
    /// CHECK: the owner here; the discriminator and layout when it is decoded.
    pub source_multisig: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            v3::SEED_SQUAD,
            source_multisig.key().as_ref(),
            &args.authority_index.to_le_bytes(),
            v3::SEED_AUTHORITY,
        ],
        bump,
        seeds::program = LEGACY_V3_PROGRAM_ID,
    )]
    /// An authority of the v3 multisig. Only v3 signs for it, in a v3 transaction that the v3
    /// members approved. It pays the rent and the creation fee.
    pub source_vault: Signer<'info>,

    #[account(
        init,
        payer = source_vault,
        space = v3::successor_size_v3(&source_multisig)?,
        seeds = [SEED_PREFIX, SEED_MULTISIG, source_multisig.key().as_ref()],
        bump
    )]
    /// The successor: the multisig PDA with `create_key = source_multisig`.
    pub multisig: Account<'info, Multisig>,

    pub system_program: Program<'info, System>,
}

#[cfg(feature = "program")]
impl MultisigCreateFromV3<'_> {
    fn validate(&self) -> Result<()> {
        require_keys_eq!(
            self.treasury.key(),
            self.program_config.treasury,
            MultisigError::InvalidAccount
        );
        Ok(())
    }

    /// Creates the successor of a v3 multisig: the v3 members with every permission, the v3
    /// threshold, no time lock, no config authority and no rent collector.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_create_from_v3(
        ctx: Context<Self>,
        args: MultisigCreateFromV3Args,
    ) -> Result<()> {
        let source_key = ctx.accounts.source_multisig.key();
        let source = v3::load_v3_multisig(&ctx.accounts.source_multisig)?;
        let config = v3::mirror_v3(&source);

        let multisig = &mut ctx.accounts.multisig;
        multisig.create_key = source_key;
        multisig.config_authority = config.config_authority;
        multisig.threshold = config.threshold;
        multisig.time_lock = config.time_lock;
        multisig.transaction_index = 0;
        multisig.stale_transaction_index = 0;
        multisig.rent_collector = config.rent_collector;
        multisig.bump = ctx.bumps.multisig;
        multisig.members = config.members;

        multisig.invariant()?;

        let creation_fee = ctx.accounts.program_config.multisig_creation_fee;
        require!(
            creation_fee <= args.max_creation_fee,
            MultisigError::MigrationCreationFeeTooHigh
        );
        if creation_fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.key(),
                    system_program::Transfer {
                        from: ctx.accounts.source_vault.to_account_info(),
                        to: ctx.accounts.treasury.to_account_info(),
                    },
                ),
                creation_fee,
            )?;
        }

        let enabled = events::enabled(ctx.remaining_accounts);
        if enabled {
            // `log_event` checks the discriminator, so the new account must be written first.
            ctx.accounts.multisig.exit(&crate::ID)?;
        }
        let multisig = &ctx.accounts.multisig;
        events::emit(
            enabled,
            || LogAuthority::multisig(multisig),
            || {
                vec![MultisigEvent::MultisigCreate(MultisigCreateEvent {
                    multisig: multisig.key(),
                    create_key: source_key,
                    creator: ctx.accounts.source_vault.key(),
                    memo: args.memo,
                    snapshot: Some(Cow::Borrowed(multisig)),
                })]
            },
        )
    }
}
