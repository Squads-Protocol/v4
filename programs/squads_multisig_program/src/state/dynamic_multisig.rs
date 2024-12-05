use std::cmp::max;
use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::*;
use crate::id;
use super::multisig::{Member, Permission, Permissions, MAX_TIME_LOCK};

#[account]
pub struct DynamicMultisig {
    /// Key that is used to seed the multisig PDA
    pub create_key: Pubkey,
    /// The authority that can change the multisig config
    pub config_authority: Pubkey,
    /// Threshold ratio (0-100) representing percentage of voters needed
    pub threshold_ratio: u8,
    /// How many seconds must pass between transaction voting settlement and execution
    pub time_lock: u32,
    /// Last transaction index. 0 means no transactions have been created
    pub transaction_index: u64,
    /// Last stale transaction index
    pub stale_transaction_index: u64,
    /// Rent collector address
    pub rent_collector: Option<Pubkey>,
    /// Bump for the multisig PDA seed
    pub bump: u8,
    /// Members of the multisig
    pub members: Vec<Member>,
}

impl DynamicMultisig {
    pub fn size(members_length: usize) -> usize {
        8  + // anchor discriminator
        32 + // create_key
        32 + // config_authority
        1  + // threshold_ratio
        4  + // time_lock
        8  + // transaction_index
        8  + // stale_transaction_index
        1  + // rent_collector Option discriminator
        32 + // rent_collector
        1  + // bump
        4  + // members vector length
        members_length * Member::INIT_SPACE // members
    }

    /// Calculate the current threshold based on number of voters and threshold ratio
    pub fn calculate_threshold(&self) -> u16 {
        let num_voters = self.num_voters();
        let threshold = (num_voters as f32 * (self.threshold_ratio as f32 / 100.0)).ceil() as u16;
        max(1, threshold) // Ensure minimum threshold of 1
    }

    pub fn num_voters(&self) -> usize {
        self.members
            .iter()
            .filter(|m| m.permissions.has(Permission::Vote))
            .count()
    }

    pub fn num_proposers(&self) -> usize {
        self.members
            .iter()
            .filter(|m| m.permissions.has(Permission::Initiate))
            .count()
    }

    pub fn num_executors(&self) -> usize {
        self.members
            .iter()
            .filter(|m| m.permissions.has(Permission::Execute))
            .count()
    }

    /// Add new member and automatically adjust threshold
    pub fn add_member(&mut self, new_member: Member) -> Result<()> {
        self.members.push(new_member);
        self.members.sort_by_key(|m| m.key);
        self.invalidate_prior_transactions();
        Ok(())
    }

    /// Remove member and automatically adjust threshold
    pub fn remove_member(&mut self, member_pubkey: Pubkey) -> Result<()> {
        let old_member_index = match self.is_member(member_pubkey) {
            Some(old_member_index) => old_member_index,
            None => return err!(MultisigError::NotAMember),
        };

        self.members.remove(old_member_index);
        self.invalidate_prior_transactions();
        Ok(())
    }

    pub fn is_member(&self, member_pubkey: Pubkey) -> Option<usize> {
        self.members
            .binary_search_by_key(&member_pubkey, |m| m.key)
            .ok()
    }

    pub fn member_has_permission(&self, member_pubkey: Pubkey, permission: Permission) -> bool {
        match self.is_member(member_pubkey) {
            Some(index) => self.members[index].permissions.has(permission),
            _ => false,
        }
    }

    pub fn invalidate_prior_transactions(&mut self) {
        self.stale_transaction_index = self.transaction_index;
    }

    /// Calculate reject votes needed based on current threshold
    pub fn cutoff(&self) -> usize {
        let threshold = self.calculate_threshold();
        self.num_voters()
            .checked_sub(usize::from(threshold))
            .unwrap()
            .checked_add(1)
            .unwrap()
    }

    /// Validate the multisig state
    pub fn invariant(&self) -> Result<()> {
        // Threshold ratio must be between 1 and 100
        require!(
            self.threshold_ratio > 0 && self.threshold_ratio <= 100,
            MultisigError::InvalidThreshold
        );

        // Max number of members check
        require!(
            self.members.len() <= usize::from(u16::MAX),
            MultisigError::TooManyMembers
        );

        // Check for duplicate members
        let has_duplicates = self.members.windows(2).any(|win| win[0].key == win[1].key);
        require!(!has_duplicates, MultisigError::DuplicateMember);

        // Validate permissions
        require!(
            self.members.iter().all(|m| m.permissions.mask < 8),
            MultisigError::UnknownPermission
        );

        // Required role checks
        require!(self.num_proposers() > 0, MultisigError::NoProposers);
        require!(self.num_executors() > 0, MultisigError::NoExecutors);
        require!(self.num_voters() > 0, MultisigError::NoVoters);

        // Transaction index validation
        require!(
            self.stale_transaction_index <= self.transaction_index,
            MultisigError::InvalidStaleTransactionIndex
        );

        // Time lock validation
        require!(
            self.time_lock <= MAX_TIME_LOCK,
            MultisigError::TimeLockExceedsMaxAllowed
        );

        Ok(())
    }

    /// Realloc account space if needed
    pub fn realloc_if_needed<'a>(
        multisig: AccountInfo<'a>,
        members_length: usize,
        rent_payer: Option<AccountInfo<'a>>,
        system_program: Option<AccountInfo<'a>>,
    ) -> Result<bool> {
        require_keys_eq!(*multisig.owner, id(), MultisigError::IllegalAccountOwner);

        let current_account_size = multisig.data.borrow().len();
        let account_size_to_fit_members = Self::size(members_length);

        if current_account_size >= account_size_to_fit_members {
            return Ok(false);
        }

        let new_size = max(
            current_account_size + (10 * Member::INIT_SPACE),
            account_size_to_fit_members,
        );

        AccountInfo::realloc(&multisig, new_size, false)?;

        let rent_exempt_lamports = Rent::get().unwrap().minimum_balance(new_size).max(1);
        let top_up_lamports = rent_exempt_lamports.saturating_sub(multisig.lamports());

        if top_up_lamports > 0 {
            let system_program = system_program.ok_or(MultisigError::MissingAccount)?;
            require_keys_eq!(
                *system_program.key,
                system_program::ID,
                MultisigError::InvalidAccount
            );

            let rent_payer = rent_payer.ok_or(MultisigError::MissingAccount)?;

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
} 