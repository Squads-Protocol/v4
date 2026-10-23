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
use crate::migration::{self, VaultHints};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
#[cfg(feature = "program")]
use crate::state::*;
#[cfg(feature = "program")]
use crate::LEGACY_V4_PROGRAM_ID;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MultisigCreateFromArgs {
    /// The index of the v4 vault that signs. Any vault of the v4 multisig proves its consensus.
    pub vault_index: u8,
    /// Set if the v4 `config_authority` is the v4 vault with this index: the successor then gets
    /// its own vault with the same index.
    pub config_authority_vault_index: Option<u8>,
    /// The same as `config_authority_vault_index`, for the v4 `rent_collector`.
    pub rent_collector_vault_index: Option<u8>,
    /// The largest 4r creation fee that the v4 members approve. The fee is read at execution.
    pub max_creation_fee: u64,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
#[instruction(args: MultisigCreateFromArgs)]
pub struct MultisigCreateFrom<'info> {
    /// Global program config account.
    #[account(seeds = [SEED_PREFIX, SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,

    /// The treasury where the creation fee is transferred to.
    /// CHECK: validation is performed in the `MultisigCreateFrom::validate()` method.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    /// The v4 multisig. Its config is copied to the successor.
    /// CHECK: the owner here; the discriminator and layout when it is decoded.
    #[account(owner = LEGACY_V4_PROGRAM_ID @ MultisigError::IllegalAccountOwner)]
    pub source_multisig: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            source_multisig.key().as_ref(),
            SEED_VAULT,
            &args.vault_index.to_le_bytes(),
        ],
        bump,
        seeds::program = LEGACY_V4_PROGRAM_ID,
    )]
    /// A vault of the v4 multisig. Only v4 signs for it, in a vault transaction that the v4
    /// members approved. It pays the rent and the creation fee.
    pub source_vault: Signer<'info>,

    #[account(
        init,
        payer = source_vault,
        space = migration::successor_size(&source_multisig)?,
        seeds = [SEED_PREFIX, SEED_MULTISIG, source_multisig.key().as_ref()],
        bump
    )]
    /// The successor: the multisig PDA with `create_key = source_multisig`.
    pub multisig: Account<'info, Multisig>,

    pub system_program: Program<'info, System>,
}

#[cfg(feature = "program")]
impl MultisigCreateFrom<'_> {
    fn validate(&self) -> Result<()> {
        require_keys_eq!(
            self.treasury.key(),
            self.program_config.treasury,
            MultisigError::InvalidAccount
        );
        Ok(())
    }

    /// Creates the successor of a v4 multisig, with the same config.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_create_from(ctx: Context<Self>, args: MultisigCreateFromArgs) -> Result<()> {
        let source_key = ctx.accounts.source_multisig.key();
        let source = migration::load_v4_multisig(&ctx.accounts.source_multisig)?;
        let config = migration::mirror(
            &source,
            &source_key,
            &ctx.accounts.multisig.key(),
            VaultHints {
                config_authority: args.config_authority_vault_index,
                rent_collector: args.rent_collector_vault_index,
            },
            None,
        )?;

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
