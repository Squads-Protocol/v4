use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::*;
use crate::events::*;

#[account]
pub struct Multisig {
    /// Key that is used to seed the multisig PDA.
    pub create_key: Pubkey,
    /// The authority that can change the multisig config.
    /// This is a very important parameter as this authority can change the members and threshold.
    ///
    /// The convention is to set this to `Pubkey::default()`.
    /// In this case, the multisig becomes autonomous, so every config change goes through
    /// the normal process of voting by the members.
    ///
    /// However, if this parameter is set to any other key, all the config changes for this multisig
    /// will need to be signed by the `config_authority`. We call such a multisig a "controlled multisig".
    pub config_authority: Pubkey,
    /// Threshold for signatures.
    pub threshold: u16,
    /// How many seconds must pass between transaction voting settlement and execution.
    pub time_lock: u32,
    /// Last transaction index. 0 means no transactions have been created.
    pub transaction_index: u64,
    /// Last stale transaction index. All transactions up until this index are stale.
    /// This index is updated when multisig config (members/threshold/time_lock) changes.
    pub stale_transaction_index: u64,
    /// Index to track the last created vault for this multisig.
    pub vault_index: u8,
    /// Bump for the multisig PDA seed.
    pub bump: u8,
    /// Members of the multisig.
    pub members: Vec<Member>,
}

impl Multisig {
    pub fn size(members_length: usize) -> usize {
        8  + // anchor account discriminator
        32 + // create_key
        32 + // config_authority
        2  + // threshold
        4  + // time_lock
        8  + // transaction_index
        8  + // stale_transaction_index
        1  + // vault_index
        1  + // bump
        4  + // members vector length
        members_length * Member::size() // members
    }

    pub fn num_voters(members: &[Member]) -> usize {
        members
            .iter()
            .filter(|m| m.permissions.has(Permission::Vote))
            .count()
    }

    /// Check if the multisig account space needs to be reallocated to accommodate `members_length`.
    /// Returns `true` if the account was reallocated.
    pub fn realloc_if_needed<'a>(
        multisig: AccountInfo<'a>,
        members_length: usize,
        rent_payer: AccountInfo<'a>,
        system_program: AccountInfo<'a>,
    ) -> Result<bool> {
        let current_account_size = multisig.data.borrow().len();

        // Check if we need to reallocate space.
        if current_account_size >= Multisig::size(members_length) {
            return Ok(false);
        }

        // We need to allocate more space. To avoid doing this operation too often, we increment it by 10 members.
        let new_size = current_account_size + (10 * Member::size());
        // Reallocate more space.
        AccountInfo::realloc(&multisig, new_size, false)?;

        // If more lamports are needed, transfer them to the account.
        let rent_exempt_lamports = Rent::get().unwrap().minimum_balance(new_size).max(1);
        let top_up_lamports =
            rent_exempt_lamports.saturating_sub(multisig.to_account_info().lamports());
        if top_up_lamports > 0 {
            system_program::transfer(
                CpiContext::new(
                    system_program,
                    system_program::Transfer {
                        from: rent_payer,
                        to: multisig,
                    },
                ),
                top_up_lamports,
            )?;
        }

        Ok(true)
    }

    // Makes sure the multisig state is valid.
    // This must be called at the end of every instruction that modifies a Multisig account.
    pub fn invariant(&self) -> Result<()> {
        let Self {
            threshold,
            members,
            transaction_index,
            stale_transaction_index,
            ..
        } = self;
        // Max number of members is u16::MAX.
        require!(
            members.len() <= usize::from(u16::MAX),
            MultisigError::TooManyMembers
        );

        // There must be no duplicate members.
        let has_duplicates = members.windows(2).any(|win| win[0].key == win[1].key);
        require!(!has_duplicates, MultisigError::DuplicateMember);

        // There must be at least one member with Vote permissions.
        let num_voters: u16 = Self::num_voters(members)
            .try_into()
            .expect("didn't expect more that `u16::MAX` members");
        require!(num_voters > 0, MultisigError::NoVoters);

        // Threshold must be greater than 0.
        require!(*threshold > 0, MultisigError::InvalidThreshold);

        // Threshold must not exceed the number of voters.
        require!(*threshold <= num_voters, MultisigError::InvalidThreshold);

        // `state.stale_transaction_index` must be less than or equal to `state.transaction_index`.
        require!(
            stale_transaction_index <= transaction_index,
            MultisigError::InvalidStaleTransactionIndex
        );

        Ok(())
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

        emit!(MultisigConfigUpdated {
            multisig: multisig_address,
            update,
            memo
        })
    }

    /// Returns `Some(index)` if `member_pubkey` is a member, with `index` into the `members` vec.
    /// `None` otherwise.
    pub fn is_member(&self, member_pubkey: Pubkey) -> Option<usize> {
        match self.members.binary_search_by_key(&member_pubkey, |m| m.key) {
            Ok(index) => Some(index),
            _ => None,
        }
    }

    pub fn member_has_permission(&self, member_pubkey: Pubkey, permission: Permission) -> bool {
        match self.is_member(member_pubkey) {
            Some(index) => self.members[index].permissions.has(permission),
            _ => false,
        }
    }

    /// How many "reject" votes are enough to make the transaction "Rejected".
    /// The cutoff must be such that it is impossible for the remaining voters to reach the approval threshold.
    /// For example: total voters = 7, threshold = 3, cutoff = 5.
    pub fn cutoff(&self) -> usize {
        Self::num_voters(&self.members)
            .checked_sub(usize::from(self.threshold))
            .unwrap()
            .checked_add(1)
            .unwrap()
    }

    /// Add `new_member` to the multisig `members` vec and sort the vec.
    pub fn add_member(&mut self, new_member: Member) {
        self.members.push(new_member);
        self.members.sort_by_key(|m| m.key);
    }

    /// Remove `member_pubkey` from the multisig `members` vec.
    ///
    /// # Errors
    /// - `MultisigError::NotAMember` if `member_pubkey` is not a member.
    pub fn remove_member(&mut self, member_pubkey: Pubkey) -> Result<()> {
        let old_member_index = match self.is_member(member_pubkey) {
            Some(old_member_index) => old_member_index,
            None => return err!(MultisigError::NotAMember),
        };

        self.members.remove(old_member_index);

        Ok(())
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
