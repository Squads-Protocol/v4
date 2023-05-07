use anchor_lang::prelude::*;

#[account]
pub struct SpendingLimit {
    /// The multisig this belongs to.
    pub multisig: Pubkey,

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

    /// The remaining amount of tokens that can be spent in the current period.
    /// When reaches 0, the spending limit cannot be used anymore until the period reset.
    pub remaining_amount: u64,

    /// Unix timestamp marking the last time the spending limit was reset (or created).
    pub last_reset: i64,

    /// PDA bump.
    pub bump: u8,

    /// Members of the multisig that can use the spending limit.
    /// In case a member is removed from the multisig, the spending limit will remain existent
    /// (until explicitly deleted), but the removed member will not be able to use it anymore.
    pub members: Vec<Pubkey>,

    /// The destination addresses the spending limit is allowed to sent funds to.
    /// If empty, funds can be sent to any address.
    pub destinations: Vec<Pubkey>,
}

impl SpendingLimit {
    pub fn size(members_length: usize, destinations_length: usize) -> usize {
        8  + // anchor discriminator
        32  + // create_key
        1  + // vault_index
        32 + // mint
        8  + // amount
        1  + // period
        8  + // remaining_amount
        8  + // last_reset
        1  + // bump
        4  + // members vector length
        members_length * 32 + // members
        4  + // destinations vector length
        destinations_length * 32 // destinations
    }
}

/// The reset period of the spending limit.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Period {
    /// The spending limit can only be used once.
    OneTime,
    /// The spending limit is reset every day.
    Day,
    /// The spending limit is reset every week (7 days).
    Week,
    /// The spending limit is reset every month (30 days).
    Month,
}
