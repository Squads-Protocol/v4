use anchor_lang::prelude::*;

#[error_code]
pub enum HookError {
    #[msg("Proposal is not active")]
    ProposalNotActive,
    #[msg("Proposal has a cancellation vote")]
    ProposalNotApproved,
    #[msg("Invalid Transaction")]
    InvalidTransaction,
    #[msg("Amount exceeds spending limit")]
    AmountExceedsSpendingLimit,
    #[msg("Invalid Destination")]
    InvalidDestination,
    #[msg("Spending limit exhausted")]
    SpendingLimitExhausted,
    #[msg("Invalid Member")]
    InvalidMember,
}
