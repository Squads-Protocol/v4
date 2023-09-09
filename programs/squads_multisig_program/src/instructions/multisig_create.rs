use anchor_lang::prelude::*;

use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigCreateArgs {
    /// The authority that can configure the multisig: add/remove members, change the threshold, etc.
    /// Should be set to `None` for autonomous multisigs.
    pub config_authority: Option<Pubkey>,
    /// The number of signatures required to execute a transaction.
    pub threshold: u16,
    /// The members of the multisig.
    pub members: Vec<Member>,
    /// How many seconds must pass between transaction voting settlement and execution.
    pub time_lock: u32,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: MultisigCreateArgs)]
pub struct MultisigCreate<'info> {
    #[account(
        init,
        payer = creator,
        space = Multisig::size(args.members.len()),
        seeds = [SEED_PREFIX, SEED_MULTISIG, create_key.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, Multisig>,

    /// A random public key that is used as a seed for the Multisig PDA.
    /// CHECK: This can be any random public key.
    pub create_key: AccountInfo<'info>,

    /// The creator of the multisig.
    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl MultisigCreate<'_> {
    fn validate(&self) -> Result<()> {
        Ok(())
    }

    /// Creates a multisig.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_create(ctx: Context<Self>, args: MultisigCreateArgs) -> Result<()> {
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
        multisig.create_key = ctx.accounts.create_key.to_account_info().key();
        multisig.bump = *ctx.bumps.get("multisig").unwrap();
        multisig.members = members;

        multisig.invariant()?;

        Ok(())
    }
}
