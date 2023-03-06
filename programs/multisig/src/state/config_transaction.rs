use anchor_lang::prelude::*;

use super::{ConfigAction, Member, TransactionStatus, Votes};

/// Stores data required for tracking the voting and execution status of a multisig configuration transaction.
/// Config transaction can perform a predefined set of actions on the Multisig PDA, such as adding/removing members,
/// changing the threshold, etc.
#[account]
pub struct ConfigTransaction {
    /// The multisig this belongs to.
    pub multisig: Pubkey,
    /// Member of the Multisig who submitted the transaction.
    pub creator: Pubkey,
    /// Index of this transaction within the multisig.
    pub transaction_index: u64,
    /// Unix Epoch when the transaction vote has settled, so it became either approved or rejected.
    /// `0` if the transaction is not settled yet.
    pub settled_at: i64,
    /// The status of the transaction.
    pub status: TransactionStatus,
    /// bump for the transaction seeds.
    pub bump: u8,
    /// keys that have approved/signed.
    pub approved: Vec<Pubkey>,
    /// keys that have rejected.
    pub rejected: Vec<Pubkey>,
    /// keys that have cancelled (ExecuteReady only).
    pub cancelled: Vec<Pubkey>,
    /// Action to be performed on the multisig.
    pub actions: Vec<ConfigAction>,
}

impl ConfigTransaction {
    pub fn size(members_length: usize, actions_len: usize) -> usize {
        8 +   // anchor account discriminator
        32 +  // multisig
        8 +   // transaction_index
        8 +   // settled_at
        32 +  // creator
        1 +   // status
        1 +   // bump
        (4 + (members_length * 32)) + // approved vec
        (4 + (members_length * 32)) + // rejected vec
        (4 + (members_length * 32)) + // cancelled vec
        (4 + actions_len * (1 + Member::size())) // actions vec
    }
}

impl Votes for ConfigTransaction {
    fn status(&mut self) -> &mut TransactionStatus {
        &mut self.status
    }

    fn settled_at(&mut self) -> &mut i64 {
        &mut self.settled_at
    }

    fn approved(&self) -> &Vec<Pubkey> {
        &self.approved
    }

    fn approved_mut(&mut self) -> &mut Vec<Pubkey> {
        &mut self.approved
    }

    fn rejected(&self) -> &Vec<Pubkey> {
        &self.rejected
    }

    fn rejected_mut(&mut self) -> &mut Vec<Pubkey> {
        &mut self.rejected
    }

    fn cancelled(&self) -> &Vec<Pubkey> {
        &self.cancelled
    }

    fn cancelled_mut(&mut self) -> &mut Vec<Pubkey> {
        &mut self.cancelled
    }
}
