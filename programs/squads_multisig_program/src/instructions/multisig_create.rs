#![allow(deprecated)]
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
#[cfg(not(feature = "program"))]
use crate::prelude::*;
use crate::state::*;

// Dummy Account context for multisigCreate, since Anchor doesn't allow empty instructions.
#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct Deprecated<'info> {
    ///CHECK: Dummy Account
    pub null: UncheckedAccount<'info>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct MultisigCreateArgsV2 {
    /// The authority that can configure the multisig: add/remove members, change the threshold, etc.
    /// Should be set to `None` for autonomous multisigs.
    pub config_authority: Option<Pubkey>,
    /// The number of signatures required to execute a transaction.
    pub threshold: u16,
    /// The members of the multisig.
    pub members: Vec<Member>,
    /// How many seconds must pass between transaction voting, settlement, and execution.
    pub time_lock: u32,
    /// The address where the rent for the accounts related to executed, rejected, or cancelled
    /// transactions can be reclaimed. If set to `None`, the rent reclamation feature is turned off.
    pub rent_collector: Option<Pubkey>,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
#[instruction(args: MultisigCreateArgsV2)]
pub struct MultisigCreateV2<'info> {
    /// Global program config account.
    #[account(seeds = [SEED_PREFIX, SEED_PROGRAM_CONFIG], bump)]
    pub program_config: Account<'info, ProgramConfig>,

    /// The treasury where the creation fee is transferred to.
    /// CHECK: validation is performed in the `MultisigCreate::validate()` method.
    #[account(mut)]
    pub treasury: UncheckedAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = Multisig::size(args.members.len()),
        seeds = [SEED_PREFIX, SEED_MULTISIG, create_key.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// An ephemeral signer that is used as a seed for the Multisig PDA.
    /// Must be a signer to prevent front-running attack by someone else but the original creator.
    pub create_key: Signer<'info>,

    /// The creator of the multisig.
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[cfg(feature = "program")]
impl MultisigCreateV2<'_> {
    fn validate(&self) -> Result<()> {
        //region treasury
        require_keys_eq!(
            self.treasury.key(),
            self.program_config.treasury,
            MultisigError::InvalidAccount
        );
        //endregion

        Ok(())
    }

    /// Creates a multisig.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_create(ctx: Context<Self>, args: MultisigCreateArgsV2) -> Result<()> {
        // Sort the members by pubkey.
        let mut members = args.members;
        members.sort_by_key(|m| m.key);

        // Initialize the multisig.
        let multisig = &mut ctx.accounts.multisig;
        multisig.config_authority = args.config_authority.unwrap_or_default();
        multisig.threshold = args.threshold;
        multisig.time_lock = args.time_lock;
        multisig.transaction_index = 0;
        multisig.stale_transaction_index = 0;
        multisig.create_key = ctx.accounts.create_key.key();
        multisig.bump = ctx.bumps.multisig;
        multisig.members = members;
        multisig.rent_collector = args.rent_collector;

        multisig.invariant()?;

        let creation_fee = ctx.accounts.program_config.multisig_creation_fee;

        if creation_fee > 0 {
            system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.key(),
                    system_program::Transfer {
                        from: ctx.accounts.creator.to_account_info(),
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
                    create_key: ctx.accounts.create_key.key(),
                    creator: ctx.accounts.creator.key(),
                    memo: args.memo,
                    snapshot: Some(Cow::Borrowed(multisig)),
                })]
            },
        )
    }
}
