use anchor_lang::prelude::*;

use crate::errors::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct MultisigRemoveSpendingLimitArgs {
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[derive(Accounts)]
pub struct MultisigRemoveSpendingLimit<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    multisig: Account<'info, Multisig>,

    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Signer<'info>,

    #[account(mut, close = rent_collector)]
    pub spending_limit: Account<'info, SpendingLimit>,

    /// This is usually the same as `config_authority`, but can be a different account if needed.
    /// CHECK: can be any account.
    #[account(mut)]
    pub rent_collector: AccountInfo<'info>,
}

impl MultisigRemoveSpendingLimit<'_> {
    fn validate(&self) -> Result<()> {
        // config_authority
        require_keys_eq!(
            self.config_authority.key(),
            self.multisig.config_authority,
            MultisigError::Unauthorized
        );

        // `spending_limit`
        require_keys_eq!(
            self.spending_limit.multisig,
            self.multisig.key(),
            MultisigError::InvalidAccount
        );

        Ok(())
    }

    /// Remove the spending limit from the controlled multisig.
    /// NOTE: This instruction must be called only by the `config_authority` if one is set (Controlled Multisig).
    ///       Uncontrolled Mustisigs should use `config_transaction_create` instead.
    #[access_control(ctx.accounts.validate())]
    pub fn multisig_remove_spending_limit(
        ctx: Context<Self>,
        _args: MultisigRemoveSpendingLimitArgs,
    ) -> Result<()> {
        Ok(())
    }
}
