use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigAddSpendingLimitArgs {
    /// Key that is used to seed the SpendingLimit PDA.
    pub create_key: Pubkey,
    /// The index of the vault that the spending limit is for.
    pub vault_index: u8,
    /// The token mint the spending limit is for.
    pub mint: Pubkey,
    /// The amount of tokens that can be spent in a period.
    /// This amount is in decimals of the mint,
    /// so 1 SOL would be `1_000_000_000` and 1 USDC would be `1_000_000`.
    pub amount: u64,
    /// The reset period of the spending limit.
    /// When it passes, the remaining amount is reset, unless it's `Period::OneTime`.
    pub period: Period,
    /// Members of the multisig that can use the spending limit.
    /// In case a member is removed from the multisig, the spending limit will remain existent
    /// (until explicitly deleted), but the removed member will not be able to use it anymore.
    pub members: Vec<Pubkey>,
    /// The destination addresses the spending limit is allowed to sent funds to.
    /// If empty, funds can be sent to any address.
    pub destinations: Vec<Pubkey>,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: MultisigAddSpendingLimitArgs)]
pub struct MultisigAddSpendingLimit<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    multisig: Account<'info, Multisig>,

    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Signer<'info>,

    #[account(
        init,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_SPENDING_LIMIT,
            args.create_key.as_ref(),
        ],
        bump,
        space = SpendingLimit::size(args.members.len(), args.destinations.len()),
        payer = rent_payer
    )]
    pub spending_limit: Account<'info, SpendingLimit>,

    /// This is usually the same as `config_authority`, but can be a different account if needed.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl MultisigAddSpendingLimit<'_> {
    fn validate(&self) -> Result<()> {
        // config_authority
        require_keys_eq!(
            self.config_authority.key(),
            self.multisig.config_authority,
            MultisigError::Unauthorized
        );

        // `spending_limit` is partially checked via its seeds.

        // SpendingLimit members must all be members of the multisig.
        for sl_member in self.spending_limit.members.iter() {
            require!(
                self.multisig.is_member(*sl_member).is_some(),
                MultisigError::NotAMember
            );
        }

        Ok(())
    }

    /// Create a new spending limit for the controlled multisig.
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_add_spending_limit(
        ctx: Context<Self>,
        args: MultisigAddSpendingLimitArgs,
    ) -> Result<()> {
        let spending_limit = &mut ctx.accounts.spending_limit;

        spending_limit.multisig = ctx.accounts.multisig.key();
        spending_limit.create_key = args.create_key;
        spending_limit.vault_index = args.vault_index;
        spending_limit.mint = args.mint;
        spending_limit.amount = args.amount;
        spending_limit.period = args.period;
        spending_limit.remaining_amount = args.amount;
        spending_limit.last_reset = Clock::get()?.unix_timestamp;
        spending_limit.bump = ctx.bumps.spending_limit;
        spending_limit.members = args.members;
        spending_limit.destinations = args.destinations;

        spending_limit.invariant()?;

        Ok(())
    }
}
