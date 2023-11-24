use anchor_lang::prelude::*;
use anchor_lang::solana_program::borsh0_10::get_instance_packed_len;

use super::*;

/// Stores data required for execution of a multisig configuration transaction.
/// Config transaction can perform a predefined set of actions on the Multisig PDA, such as adding/removing members,
/// changing the threshold, etc.
#[account]
pub struct ConfigTransaction {
    /// The multisig this belongs to.
    pub multisig: Pubkey,
    /// Member of the Multisig who submitted the transaction.
    pub creator: Pubkey,
    /// Index of this transaction within the multisig.
    pub index: u64,
    /// bump for the transaction seeds.
    pub bump: u8,
    /// Action to be performed on the multisig.
    pub actions: Vec<ConfigAction>,
}

impl ConfigTransaction {
    pub fn size(actions: &[ConfigAction]) -> usize {
        let actions_size: usize = actions
            .iter()
            .map(|action| get_instance_packed_len(action).unwrap())
            .sum();

        8 +   // anchor account discriminator
        32 +  // multisig
        32 +  // creator
        8 +   // index
        1 +   // bump 
        4 +  // actions vector length
        actions_size
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
#[non_exhaustive]
pub enum ConfigAction {
    /// Add a new member to the multisig.
    AddMember { new_member: Member },
    /// Remove a member from the multisig.
    RemoveMember { old_member: Pubkey },
    /// Change the `threshold` of the multisig.
    ChangeThreshold { new_threshold: u16 },
    /// Change the `time_lock` of the multisig.
    SetTimeLock { new_time_lock: u32 },
    /// Change the `time_lock` of the multisig.
    AddSpendingLimit {
        /// Key that is used to seed the SpendingLimit PDA.
        create_key: Pubkey,
        /// The index of the vault that the spending limit is for.
        vault_index: u8,
        /// The token mint the spending limit is for.
        mint: Pubkey,
        /// The amount of tokens that can be spent in a period.
        /// This amount is in decimals of the mint,
        /// so 1 SOL would be `1_000_000_000` and 1 USDC would be `1_000_000`.
        amount: u64,
        /// The reset period of the spending limit.
        /// When it passes, the remaining amount is reset, unless it's `Period::OneTime`.
        period: Period,
        /// Members of the multisig that can use the spending limit.
        /// In case a member is removed from the multisig, the spending limit will remain existent
        /// (until explicitly deleted), but the removed member will not be able to use it anymore.
        members: Vec<Pubkey>,
        /// The destination addresses the spending limit is allowed to sent funds to.
        /// If empty, funds can be sent to any address.
        destinations: Vec<Pubkey>,
    },
    /// Remove a spending limit from the multisig.
    RemoveSpendingLimit { spending_limit: Pubkey },
    /// Set the `rent_collector` config parameter of the multisig.
    SetRentCollector { new_rent_collector: Option<Pubkey> },
}
