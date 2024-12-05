use anchor_lang::prelude::*;
use crate::errors::*;

#[account]
pub struct VersionedMultisig {
    /// Key used to seed the multisig PDA
    pub create_key: Pubkey,
    /// Current proposal index
    pub current_proposal_index: u64,
    /// Fixed threshold for proposals
    pub threshold: u16,
    /// Time lock for proposal execution
    pub time_lock: u32,
    /// Rent collector address
    pub rent_collector: Option<Pubkey>,
    /// PDA bump
    pub bump: u8,
    /// Members of the multisig
    pub members: Vec<VersionedMember>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
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
        8 +  // current_proposal_index
        2 +  // threshold
        4 +  // time_lock
        33 + // rent_collector (1 + 32)
        1 +  // bump
        4 +  // vec len
        members_length * size_of::<VersionedMember>()
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
            join_proposal_index: self.current_proposal_index,
            ..new_member
        };
        
        // Check for duplicates
        require!(
            !self.members.iter().any(|m| m.key == member.key),
            MultisigError::DuplicateMember
        );

        self.members.push(member);
        self.members.sort_by_key(|m| m.key);
        Ok(())
    }

    pub fn remove_member(&mut self, member_key: Pubkey) -> Result<()> {
        let pos = self.members
            .iter()
            .position(|m| m.key == member_key)
            .ok_or(MultisigError::NotAMember)?;

        self.members.remove(pos);
        Ok(())
    }

    pub fn invariant(&self) -> Result<()> {
        // Basic checks
        require!(!self.members.is_empty(), MultisigError::EmptyMembers);
        require!(
            self.members.len() <= usize::from(u16::MAX),
            MultisigError::TooManyMembers
        );

        // Check for duplicates
        let has_duplicates = self.members.windows(2).any(|w| w[0].key == w[1].key);
        require!(!has_duplicates, MultisigError::DuplicateMember);

        // Verify at least one member can vote on next proposal
        let next_proposal_voters = self.get_eligible_voters(self.current_proposal_index);
        require!(!next_proposal_voters.is_empty(), MultisigError::NoVoters);

        // Verify threshold
        require!(
            self.threshold <= next_proposal_voters.len() as u16,
            MultisigError::InvalidThreshold
        );

        Ok(())
    }
} 