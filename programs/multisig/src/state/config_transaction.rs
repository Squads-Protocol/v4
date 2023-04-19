use anchor_lang::prelude::*;

use super::Member;

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
    pub fn size(actions_len: usize) -> usize {
        8 +   // anchor account discriminator
        32 +  // multisig
        32 +  // creator
        8 +   // index
        1 +   // bump 
        (4 + actions_len * (1 + Member::size())) // actions vec
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
    /// Increment the `vault_index` of the multisig.
    AddVault { new_vault_index: u8 },
}
