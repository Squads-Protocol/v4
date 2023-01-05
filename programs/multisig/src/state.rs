use anchor_lang::prelude::*;

use crate::events::*;

#[account]
pub struct Multisig {
    /// The authority that can change the multisig config.
    /// This is a very important parameter as this authority can change the members and threshold.
    ///
    /// The convention is to set this to a PDA derived from the multisig address and an authority index (typically 0)
    /// using the following seeds: ["multisig", multisig_address, authority_index, "authority"].
    /// In this case, the multisig becomes autonomous, so every config change goes through
    /// the normal process of voting by the members.
    ///
    /// However, this parameter can be set to any key. This allows for the multisig to be controlled
    /// by a higher central authority or even another multisig.
    pub config_authority: Pubkey,
    /// Threshold for signatures.
    pub threshold: u16,
    /// Members of the multisig.
    pub members: Vec<Member>,
    /// Index to seed other authorities under this multisig.
    pub authority_index: u16,
    /// Last transaction index. 0 means no transactions have been created.
    pub transaction_index: u64,
    /// Last stale transaction index. All transactions up until this index are stale.
    /// This index is updated when multisig config (members/threshold) changes.
    pub stale_transaction_index: u64,
    /// Whether to allow non-member keys to execute txs.
    pub allow_external_execute: bool,
    /// Key that is used to seed the multisig PDA.
    /// Used solely as bytes for the seed, doesn't have any other meaning or function.
    pub create_key: Pubkey,
    /// Bump for the multisig PDA seed.
    pub bump: u8,
}

impl Multisig {
    pub fn size(members_length: usize) -> usize {
        8  + // anchor account discriminator
        32 + // config_authority
        2  + // threshold
        4  + // members vector length
        members_length * Member::size()  + // members
        2  + // authority_index
        8  + // transaction_index
        8  + // stale_transaction_index 
        1  + // allow_external_execute
        32 + // create_key
        1 // bump
    }

    /// Captures the fact that the multisig config has changed in the multisig state
    /// and emits a `ConfigUpdatedEvent`.
    pub fn config_updated(
        &mut self,
        multisig_address: Pubkey,
        update: ConfigUpdateType,
        memo: Option<String>,
    ) {
        self.stale_transaction_index = self.transaction_index;

        emit!(ConfigUpdatedEvent {
            multisig: multisig_address,
            update,
            memo
        })
    }

    pub fn is_member(&self, member_pubkey: Pubkey) -> Option<usize> {
        match self.members.binary_search_by_key(&member_pubkey, |m| m.key) {
            Ok(index) => Some(index),
            _ => None,
        }
    }

    pub fn add_member_if_not_exists(&mut self, new_member: Member) {
        if self.is_member(new_member.key).is_none() {
            self.members.push(new_member);
            self.members.sort_by_key(|m| m.key);
        }
    }
}

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
    mask: u8,
}

impl Permissions {
    pub fn from_vec(permissions: &[Permission]) -> Self {
        let mut mask = 0;
        for permission in permissions {
            mask |= *permission as u8;
        }
        Self { mask }
    }
}

#[cfg(test)]
mod test {
    use super::*;

    #[test]
    fn test() {
        assert_eq!(
            Permissions::from_vec(&[Permission::Initiate]),
            Permissions {
                mask: Permission::Initiate as u8
            }
        );
        assert_eq!(
            Permissions::from_vec(&[Permission::Initiate, Permission::Vote]),
            Permissions {
                mask: Permission::Initiate as u8 | Permission::Vote as u8
            }
        );
        assert_eq!(
            Permissions::from_vec(&[Permission::Initiate, Permission::Vote, Permission::Execute]),
            Permissions {
                mask: Permission::Initiate as u8
                    | Permission::Vote as u8
                    | Permission::Execute as u8
            }
        );
        // assert!(Permission::All.has_all(&[Permission::Initiate, Permission::Vote]));
        // assert!(Permission::All.has_all(&[
        //     Permission::Initiate,
        //     Permission::Vote,
        //     Permission::Execute
        // ]));
        // assert_eq!(Permission::Initiate.try_to_vec().unwrap(), vec![1]);
        // assert_eq!(Permission::Vote.try_to_vec().unwrap(), vec![2]);
        // assert_eq!(Permission::Execute.try_to_vec().unwrap(), vec![4]);
        // assert_eq!(Permission::All.try_to_vec().unwrap(), vec![255]);
        // assert_eq!(
        //     Permission::try_from_slice(&vec![255]).unwrap(),
        //     Permission::All
        // );
    }
}
