use anchor_lang::prelude::*;
use anchor_lang::system_program;
use crate::errors::*;
use crate::id;
use std::cmp::max;

//TODO: Threshold ?? Should change on add ? 
#[account]
pub struct VersionedMultisig {
    /// Key used to seed the multisig PDA
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
    /// Current proposal index
    pub current_proposal_index: u64,
    /// Fixed threshold for proposals
    pub threshold: u16,
    /// Time lock for proposal execution
    pub time_lock: u32,
    /// Last transaction index. 0 means no transactions have been created.
    pub transaction_index: u64,
    /// Last stale transaction index. All transactions up until this index are stale.
    /// This index is updated when multisig config (members/threshold/time_lock) changes.
    pub stale_transaction_index: u64,
    /// Rent collector address
    pub rent_collector: Option<Pubkey>,
    /// PDA bump
    pub bump: u8,
    /// Members of the multisig
    pub members: Vec<VersionedMember>,
}

#[derive(AnchorDeserialize, AnchorSerialize, InitSpace, Eq, PartialEq, Clone)]
pub struct VersionedMember {
    /// Member's public key
    pub key: Pubkey,
    /// Proposal index when member joined
    pub join_proposal_index: u64,
    /// Member permissions
    pub permissions: Permissions,
}

impl VersionedMultisig {
    pub fn size(members_length: usize) -> usize {
        8 +  // discriminator
        32 + // create_key
        32 + // config_authority
        8 +  // current_proposal_index
        2 +  // threshold
        4 +  // time_lock
        8 +  // transaction_index
        8 +  // stale_transaction_index
        1 +  // rent_collector Option discriminator
        32 + // rent_collector (always 32 bytes, even if None, just to keep the realloc logic simpler)
        1 +  // bump
        4 +  // vec len
        members_length * VersionedMember::INIT_SPACE // members
    }

    pub fn can_vote(&self, member: &VersionedMember, proposal_index: u64) -> bool {
        member.join_proposal_index <= proposal_index && 
        member.permissions.has(Permission::Vote)
    }

    pub fn get_eligible_voters(&self, proposal_index: u64) -> Vec<Pubkey> {
        self.members
            .iter()
            .filter(|m| self.can_vote(m, proposal_index))
            .map(|m| m.key)
            .collect()
    }

    pub fn calculate_threshold_for_proposal(&self, proposal_index: u64) -> u16 {
        let eligible_voters = self.get_eligible_voters(proposal_index);
        let voter_count = eligible_voters.len() as u16;
        std::cmp::min(self.threshold, voter_count)
    }

    pub fn add_member(&mut self, new_member: VersionedMember) -> Result<()> {
        // Set join index to next proposal
        let member = VersionedMember {
            key: new_member.key,
            join_proposal_index: self.current_proposal_index,
            permissions: new_member.permissions,
        };
        
        // Check for duplicates
        require!(
            !self.members.iter().any(|m| m.key == member.key),
            VersionedMultisigError::DuplicateMember
        );

        self.members.push(member.clone());
        self.members.sort_by_key(|m| m.key);
        msg!("Member added: {}, Join Index: {}", member.key.to_string(), member.join_proposal_index.to_string());
        Ok(())
    }

    pub fn remove_member(&mut self, member_key: Pubkey) -> Result<()> {
        let pos: usize = self.members
            .iter()
            .position(|m| m.key == member_key)
            .ok_or(VersionedMultisigError::NotAMember)?;

        self.members.remove(pos);
        Ok(())
    }

    pub fn is_member(&self, member_key: Pubkey) -> Option<usize> {
        self.members.iter().position(|m| m.key == member_key)
    }

    pub fn invariant(&self) -> Result<()> {
        // Basic checks
        require!(!self.members.is_empty(), VersionedMultisigError::EmptyMembers);
        require!(
            self.members.len() <= usize::from(u16::MAX),
            VersionedMultisigError::TooManyMembers
        );

        msg!("Checking for duplicates");
        msg!("Members: {:?}", self.members.iter().map(|m| m.key).collect::<Vec<Pubkey>>());
        // Check for duplicates
        let has_duplicates = self.members.windows(2).any(|w| w[0].key == w[1].key);
        require!(!has_duplicates, VersionedMultisigError::DuplicateMember);

        // Verify at least one member can vote on next proposal
        let next_proposal_voters = self.get_eligible_voters(self.current_proposal_index);
        require!(!next_proposal_voters.is_empty(), VersionedMultisigError::NoVoters);

        // // Verify threshold
        //TODO: This is not working as expected.
        // require!(
        //     self.calculate_threshold_for_proposal(self.current_proposal_index) <= next_proposal_voters.len() as u16,
        //     VersionedMultisigError::InvalidThreshold
        // );

        Ok(())
    }

    pub fn num_voters(members: &[VersionedMember]) -> usize {
        members
            .iter()
            .filter(|m| m.permissions.has(Permission::Vote))
            .count()
    }


    pub fn num_proposers(members: &[VersionedMember]) -> usize {
        members
            .iter()
            .filter(|m| m.permissions.has(Permission::Initiate))
            .count()
    }

    pub fn num_executors(members: &[VersionedMember]) -> usize {
        members
            .iter()
            .filter(|m| m.permissions.has(Permission::Execute))
            .count()
    }

    pub fn realloc_if_needed<'a>(
        multisig: AccountInfo<'a>,
        members_length: usize,
        rent_payer: Option<AccountInfo<'a>>,
        system_program: Option<AccountInfo<'a>>,
    ) -> Result<bool> {
        // Sanity checks
        require_keys_eq!(*multisig.owner, id(), VersionedMultisigError::IllegalAccountOwner);

        let current_account_size = multisig.data.borrow().len();
        let account_size_to_fit_members = VersionedMultisig::size(members_length);

        // Check if we need to reallocate space.
        if current_account_size >= account_size_to_fit_members {
            return Ok(false);
        }

        let new_size = max(
            current_account_size + (10 * VersionedMember::INIT_SPACE), // We need to allocate more space. To avoid doing this operation too often, we increment it by 10 members.
            account_size_to_fit_members,
        );
        // Reallocate more space.
        AccountInfo::realloc(&multisig, new_size, false)?;

        // If more lamports are needed, transfer them to the account.
        let rent_exempt_lamports = Rent::get().unwrap().minimum_balance(new_size).max(1);
        let top_up_lamports =
            rent_exempt_lamports.saturating_sub(multisig.to_account_info().lamports());

        if top_up_lamports > 0 {
            let system_program = system_program.ok_or(VersionedMultisigError::MissingAccount)?;
            require_keys_eq!(
                *system_program.key,
                system_program::ID,
                VersionedMultisigError::InvalidAccount
            );

            let rent_payer = rent_payer.ok_or(VersionedMultisigError::MissingAccount)?;

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
    pub fn member_has_permission(&self, member_pubkey: Pubkey, permission: Permission) -> bool {
        match self.is_member(member_pubkey) {
            Some(index) => self.members[index].permissions.has(permission),
            _ => false,
        }
    }
} 
#[derive(Clone, Copy)]
pub enum Permission {
    Initiate = 1 << 0,
    Vote = 1 << 1,
    Execute = 1 << 2,
}

/// Bitmask for permissions.
#[derive(
    AnchorSerialize, AnchorDeserialize, InitSpace, Eq, PartialEq, Clone, Copy, Default, Debug,
)]
pub struct Permissions {
    pub mask: u8,
}

impl Permissions {
    /// Currently unused.
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
