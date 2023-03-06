use crate::errors::*;
use crate::TransactionStatus;
use anchor_lang::prelude::*;

pub trait Votes {
    /// Return a mutable ref to the vote status.
    fn status(&mut self) -> &mut TransactionStatus;

    /// Return a mutable ref to the field that stores the timestamp of when vote was settled.
    fn settled_at(&mut self) -> &mut i64;

    /// Return a ref to a sorted `Vec` of member keys that have voted "approve".
    fn approved(&self) -> &Vec<Pubkey>;

    /// Return a mut ref to a sorted `Vec` of member keys that have voted "approve".
    fn approved_mut(&mut self) -> &mut Vec<Pubkey>;

    /// Return a ref to a sorted `Vec` of member keys that have voted "reject".
    fn rejected(&self) -> &Vec<Pubkey>;

    /// Return a mut ref to a sorted `Vec` of member keys that have voted "reject".
    fn rejected_mut(&mut self) -> &mut Vec<Pubkey>;

    /// Return a ref to a sorted `Vec` of member keys that have voted "cancel".
    fn cancelled(&self) -> &Vec<Pubkey>;

    /// Return a mut ref to a sorted `Vec` of member keys that have voted "cancel".
    fn cancelled_mut(&mut self) -> &mut Vec<Pubkey>;

    /// Register an approval vote.
    fn approve(&mut self, member: Pubkey, threshold: usize) -> Result<()> {
        require!(
            self.has_voted_approve(member.key()).is_none(),
            MultisigError::AlreadyApproved
        );

        // If `member` has previously voted to reject, remove that vote.
        if let Some(vote_index) = self.has_voted_reject(member.key()) {
            self.remove_rejection_vote(vote_index);
        }

        let approved = self.approved_mut();
        approved.push(member);
        approved.sort();

        // If current number of approvals reaches threshold, mark the transaction as `ExecuteReady`.
        if self.approved().len() >= threshold {
            *self.status() = TransactionStatus::ExecuteReady;
            *self.settled_at() = Clock::get()?.unix_timestamp;
        }

        Ok(())
    }

    /// Register a rejection vote.
    fn reject(&mut self, member: Pubkey, cutoff: usize) -> Result<()> {
        require!(
            self.has_voted_reject(member.key()).is_none(),
            MultisigError::AlreadyRejected
        );

        // If `member` has previously voted to approve, remove that vote.
        if let Some(vote_index) = self.has_voted_approve(member.key()) {
            self.remove_approval_vote(vote_index);
        }

        let rejected = self.rejected_mut();
        rejected.push(member);
        rejected.sort();

        // If current number of rejections reaches cutoff, mark the transaction as `Rejected`.
        if self.rejected().len() >= cutoff {
            *self.status() = TransactionStatus::Rejected;
            *self.settled_at() = Clock::get()?.unix_timestamp;
        }

        Ok(())
    }

    /// Registers a cancellation vote.
    fn cancel(&mut self, member: Pubkey) {
        let cancelled = self.cancelled_mut();
        cancelled.push(member);
        cancelled.sort();
    }

    /// Check if the member has already voted.
    fn has_voted(&self, member: Pubkey) -> bool {
        let approved = self.approved().binary_search(&member).is_ok();
        let rejected = self.rejected().binary_search(&member).is_ok();
        approved || rejected
    }

    /// Check if the member approved the transaction.
    /// Returns `Some(index)` if `member` has approved the transaction, with `index` into the `approved` vec.
    fn has_voted_approve(&self, member: Pubkey) -> Option<usize> {
        self.approved().binary_search(&member).ok()
    }

    /// Check if the member rejected the transaction.
    /// Returns `Some(index)` if `member` has rejected the transaction, with `index` into the `rejected` vec.
    fn has_voted_reject(&self, member: Pubkey) -> Option<usize> {
        self.rejected().binary_search(&member).ok()
    }

    /// Check if a user has signed to cancel
    /// Returns `Some(index)` if `member` has cancelled the transaction, with `index` into the `cancelled` vec.
    fn has_cancelled(&self, member: Pubkey) -> Option<usize> {
        self.cancelled().binary_search(&member).ok()
    }

    /// Delete the vote of rejection at the `index`.
    fn remove_rejection_vote(&mut self, index: usize) {
        self.rejected_mut().remove(index);
    }

    /// Delete the vote of approval at the `index`.
    fn remove_approval_vote(&mut self, index: usize) {
        self.approved_mut().remove(index);
    }
}
