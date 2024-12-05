use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::state::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct CreateDynamicMultisig<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = DynamicMultisig::size(1),
        seeds = [b"squad", create_key.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, DynamicMultisig>,

    /// Random key used to seed the PDA
    pub create_key: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<CreateDynamicMultisig>,
    threshold_ratio: u8,
    time_lock: u32,
    members: Vec<Member>,
) -> Result<()> {
    require!(
        threshold_ratio > 0 && threshold_ratio <= 100,
        MultisigError::InvalidThresholdRatio
    );

    let multisig = &mut ctx.accounts.multisig;
    
    multisig.create_key = ctx.accounts.create_key.key();
    multisig.config_authority = Pubkey::default(); // Always locked for dynamic multisigs
    multisig.threshold_ratio = threshold_ratio;
    multisig.time_lock = time_lock;
    multisig.transaction_index = 0;
    multisig.stale_transaction_index = 0;
    multisig.rent_collector = None;
    multisig.bump = *ctx.bumps.get("multisig").unwrap();
    multisig.members = members;

    // Sort members by key
    multisig.members.sort_by_key(|m| m.key);

    // Validate the initial state
    multisig.invariant()?;

    Ok(())
} 