#![allow(deprecated)]
use anchor_lang::prelude::*;

use crate::errors::*;
use crate::id;

use anchor_lang::system_program;

/// Stores the data required for tracking the status of a multisig proposal.
/// Each `Proposal` has a 1:1 association with a transaction account, e.g. a `VaultTransaction` or a `ConfigTransaction`;
/// the latter can be executed only after the `Proposal` has been approved and its time lock is released.
#[account]
pub struct Proposal {
    /// The multisig this belongs to.
    pub multisig: Pubkey,
    /// Index of the multisig transaction this proposal is associated with.
    pub transaction_index: u64,
    /// The status of the transaction.
    pub status: ProposalStatus,
    /// PDA bump.
    pub bump: u8,
    /// Keys that have approved/signed.
    pub approved: Vec<Pubkey>,
    /// Keys that have rejected.
    pub rejected: Vec<Pubkey>,
    /// Keys that have cancelled (Approved only).
    pub cancelled: Vec<Pubkey>,
}

impl Proposal {
    pub fn size(members_len: usize) -> usize {
        8 +   // anchor account discriminator
        32 +  // multisig
        8 +   // index
        1 +   // status enum variant
        8 +   // status enum wrapped timestamp (i64)
        1 +   // bump
        (4 + (members_len * 32)) + // approved vec
        (4 + (members_len * 32)) + // rejected vec
        (4 + (members_len * 32)) // cancelled vec
    }

    /// Register an approval vote.
    pub fn approve(&mut self, member: Pubkey, threshold: usize) -> Result<()> {
        // If `member` has previously voted to reject, remove that vote.
        if let Some(vote_index) = self.has_voted_reject(member.key()) {
            self.remove_rejection_vote(vote_index);
        }

        // Insert the vote of approval.
        match self.approved.binary_search(&member) {
            Ok(_) => return err!(MultisigError::AlreadyApproved),
            Err(pos) => self.approved.insert(pos, member),
        };

        // If current number of approvals reaches threshold, mark the transaction as `Approved`.
        if self.approved.len() >= threshold {
            self.status = ProposalStatus::Approved {
                timestamp: Clock::get()?.unix_timestamp,
            };
        }

        Ok(())
    }

    /// Register a rejection vote.
    pub fn reject(&mut self, member: Pubkey, cutoff: usize) -> Result<()> {
        // If `member` has previously voted to approve, remove that vote.
        if let Some(vote_index) = self.has_voted_approve(member.key()) {
            self.remove_approval_vote(vote_index);
        }

        // Insert the vote of rejection.
        match self.rejected.binary_search(&member) {
            Ok(_) => return err!(MultisigError::AlreadyRejected),
            Err(pos) => self.rejected.insert(pos, member),
        };

        // If current number of rejections reaches cutoff, mark the transaction as `Rejected`.
        if self.rejected.len() >= cutoff {
            self.status = ProposalStatus::Rejected {
                timestamp: Clock::get()?.unix_timestamp,
            };
        }

        Ok(())
    }

    /// Registers a cancellation vote.
    pub fn cancel(&mut self, member: Pubkey, threshold: usize) -> Result<()> {
        // Insert the vote of cancellation.
        match self.cancelled.binary_search(&member) {
            Ok(_) => return err!(MultisigError::AlreadyCancelled),
            Err(pos) => self.cancelled.insert(pos, member),
        };

        // If current number of cancellations reaches threshold, mark the transaction as `Cancelled`.
        if self.cancelled.len() >= threshold {
            self.status = ProposalStatus::Cancelled {
                timestamp: Clock::get()?.unix_timestamp,
            };
        }

        Ok(())
    }

    /// Check if the member approved the transaction.
    /// Returns `Some(index)` if `member` has approved the transaction, with `index` into the `approved` vec.
    fn has_voted_approve(&self, member: Pubkey) -> Option<usize> {
        self.approved.binary_search(&member).ok()
    }

    /// Check if the member rejected the transaction.
    /// Returns `Some(index)` if `member` has rejected the transaction, with `index` into the `rejected` vec.
    fn has_voted_reject(&self, member: Pubkey) -> Option<usize> {
        self.rejected.binary_search(&member).ok()
    }

    /// Delete the vote of rejection at the `index`.
    fn remove_rejection_vote(&mut self, index: usize) {
        self.rejected.remove(index);
    }

    /// Delete the vote of approval at the `index`.
    fn remove_approval_vote(&mut self, index: usize) {
        self.approved.remove(index);
    }

    /// Check if the proposal account space needs to be reallocated to accommodate `cancelled` vec.
    /// Proposal size is crated at creation, and thus may not accomodate enough space for all members to cancel if more are added or changed
    /// Returns `true` if the account was reallocated.
    pub fn realloc_if_needed<'a>(
        proposal: AccountInfo<'a>,
        members_length: usize,
        rent_payer: Option<AccountInfo<'a>>,
        system_program: Option<AccountInfo<'a>>,
    ) -> Result<bool> {
        // Sanity checks
        require_keys_eq!(*proposal.owner, id(), MultisigError::IllegalAccountOwner);

        let current_account_size = proposal.data.borrow().len();
        let account_size_to_fit_members = Proposal::size(members_length);

        // Check if we need to reallocate space.
        if current_account_size >= account_size_to_fit_members {
            return Ok(false);
        }

        // Reallocate more space.
        AccountInfo::realloc(&proposal, account_size_to_fit_members, false)?;

        // If more lamports are needed, transfer them to the account.
        let rent_exempt_lamports = Rent::get()
            .unwrap()
            .minimum_balance(account_size_to_fit_members)
            .max(1);
        let top_up_lamports =
            rent_exempt_lamports.saturating_sub(proposal.to_account_info().lamports());

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
                        to: proposal,
                    },
                ),
                top_up_lamports,
            )?;
        }

        Ok(true)
    }
}

/// The status of a proposal.
/// Each variant wraps a timestamp of when the status was set.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
#[non_exhaustive]
pub enum ProposalStatus {
    /// Proposal is in the draft mode and can be voted on.
    Draft { timestamp: i64 },
    /// Proposal is live and ready for voting.
    Active { timestamp: i64 },
    /// Proposal has been rejected.
    Rejected { timestamp: i64 },
    /// Proposal has been approved and is pending execution.
    Approved { timestamp: i64 },
    /// Proposal is being executed. This is a transient state that always transitions to `Executed` in the span of a single transaction.
    #[deprecated(
        note = "This status used to be used to prevent reentrancy attacks. It is no longer needed."
    )]
    Executing,
    /// Proposal has been executed.
    Executed { timestamp: i64 },
    /// Proposal has been cancelled.
    Cancelled { timestamp: i64 },
}
