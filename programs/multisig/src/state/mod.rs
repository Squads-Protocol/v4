use anchor_lang::prelude::*;

pub use config_transaction::*;
pub use multisig::*;
pub use seeds::*;
pub use vault_transaction::*;
pub use votes::*;

mod config_transaction;
mod multisig;
mod seeds;
mod vault_transaction;
mod votes;

#[derive(AnchorDeserialize, AnchorSerialize, Eq, PartialEq, Clone)]
pub struct Member {
    pub key: Pubkey,
    pub permissions: Permissions,
}

impl Member {
    pub fn size() -> usize {
        32 + // key 
            1 // role
    }
}

#[derive(Clone, Copy)]
pub enum Permission {
    Initiate = 1 << 0,
    Vote = 1 << 1,
    Execute = 1 << 2,
}

/// Bitmask for permissions.
#[derive(AnchorSerialize, AnchorDeserialize, Eq, PartialEq, Clone, Copy, Default, Debug)]
pub struct Permissions {
    pub mask: u8,
}

impl Permissions {
    pub fn from_vec(permissions: &[Permission]) -> Self {
        let mut mask = 0;
        for permission in permissions {
            mask |= *permission as u8;
        }
        Self { mask }
    }

    pub fn has(&self, permission: Permission) -> bool {
        self.mask & (permission as u8) != 0
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
#[non_exhaustive]
pub enum ConfigAction {
    /// Add a new member to the multisig.
    AddMember { new_member: Member },
    /// Remove a member from the multisig.
    RemoveMember { old_member: Pubkey },
    /// Change the threshold of the multisig.
    ChangeThreshold { new_threshold: u16 },
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
#[non_exhaustive]
pub enum TransactionStatus {
    /// Transaction is live and ready for voting.
    Active,
    /// Transaction has been rejected.
    Rejected,
    /// Transaction has been approved and is pending execution.
    ExecuteReady,
    /// Transaction has been executed.
    Executed,
    /// Transaction has been cancelled.
    Cancelled,
}
