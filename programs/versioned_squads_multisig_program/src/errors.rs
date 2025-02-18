use anchor_lang::prelude::*;

#[error_code]
pub enum VersionedMultisigError {
    #[msg("Invalid threshold")]
    InvalidThreshold,
    #[msg("Member not found")]
    MemberNotFound,
    #[msg("Member not eligible to vote")]
    MemberNotEligible,
    #[msg("Duplicate member")]
    DuplicateMember,
    #[msg("Invalid permissions")]
    InvalidPermissions,
    #[msg("Proposal already exists")]
    ProposalExists,
    #[msg("Invalid proposal status")]
    InvalidProposalStatus,
    #[msg("Already voted")]
    AlreadyVoted,
    #[msg("Not enough approvals")]
    NotEnoughApprovals,
    #[msg("Time lock not expired")]
    TimeLockNotExpired,
    #[msg("Invalid join proposal index")]
    InvalidJoinProposalIndex,
    #[msg("Account is not owned by Multisig program")]
    IllegalAccountOwner,
    #[msg("Missing account")]
    MissingAccount,
    #[msg("Provided pubkey is not a member of multisig")]
    NotAMember,
    #[msg("Members array is empty")]
    EmptyMembers,
    #[msg("Too many members, can be up to 65535")]
    TooManyMembers,
    #[msg("Members don't include any voters")]
    NoVoters,
    #[msg("Proposal is stale")]
    StaleProposal,
    #[msg("Attempted to perform an unauthorized action")]
    Unauthorized,
    #[msg("Invalid transaction index")]
    InvalidTransactionIndex,
    #[msg("Invalid account provided")]
    InvalidAccount,
    #[msg("Wrong number of accounts provided")]
    InvalidNumberOfAccounts,
    #[msg("Attempted to remove last member")]
    RemoveLastMember,
    #[msg("Member already approved the transaction")]
    AlreadyApproved,
    #[msg("Member already rejected the transaction")]
    AlreadyRejected,
    #[msg("Member already cancelled the transaction")]
    AlreadyCancelled,
    #[msg("Member already executed the transaction")]
    AlreadyExecuted,
    #[msg("Proposal time lock has not been released")]
    TimeLockNotReleased,
    #[msg("Final message buffer hash doesnt match the expected hash")]
    FinalBufferHashMismatch,
    #[msg("Final buffer size cannot exceed 4000 bytes")]
    FinalBufferSizeExceeded,
    #[msg("Final buffer size mismatch")]
    FinalBufferSizeMismatch,
    #[msg("Invalid Instruction Arguments")]
    InvalidInstructionArgs,
    #[msg("TransactionMessage is malformed.")]
    InvalidTransactionMessage,

    #[msg("Account is protected, it cannot be passed into a CPI as writable")]
    ProtectedAccount,
} 

#[error_code]
pub enum MultisigError {
    #[msg("Found multiple members with the same pubkey")]
    DuplicateMember,
    #[msg("Members array is empty")]
    EmptyMembers,
    #[msg("Too many members, can be up to 65535")]
    TooManyMembers,
    
    #[msg("Provided pubkey is not a member of multisig")]
    NotAMember,
    #[msg("TransactionMessage is malformed.")]
    InvalidTransactionMessage,
    #[msg("Invalid proposal status")]
    InvalidProposalStatus,
    
   
    
    #[msg("Members don't include any voters")]
    NoVoters,
    #[msg("Members don't include any proposers")]
    NoProposers,
    #[msg("Members don't include any executors")]
    NoExecutors,
    #[msg("`stale_transaction_index` must be <= `transaction_index`")]
    InvalidStaleTransactionIndex,
    #[msg("Instruction not supported for controlled multisig")]
    NotSupportedForControlled,
    
    #[msg("Config transaction must have at least one action")]
    NoActions,
    #[msg("Missing account")]
    MissingAccount,
    #[msg("Invalid mint")]
    InvalidMint,
    #[msg("Invalid destination")]
    InvalidDestination,
    #[msg("Spending limit exceeded")]
    SpendingLimitExceeded,
    #[msg("Decimals don't match the mint")]
    DecimalsMismatch,
    #[msg("Member has unknown permission")]
    UnknownPermission,
    #[msg("Account is protected, it cannot be passed into a CPI as writable")]
    ProtectedAccount,
    #[msg("Time lock exceeds the maximum allowed (90 days)")]
    TimeLockExceedsMaxAllowed,
    #[msg("Account is not owned by Multisig program")]
    IllegalAccountOwner,
    #[msg("Rent reclamation is disabled for this multisig")]
    RentReclamationDisabled,
    #[msg("Invalid rent collector address")]
    InvalidRentCollector,
    #[msg("Proposal is for another multisig")]
    ProposalForAnotherMultisig,
    #[msg("Transaction is for another multisig")]
    TransactionForAnotherMultisig,
    #[msg("Transaction doesn't match proposal")]
    TransactionNotMatchingProposal,
    #[msg("Transaction is not last in batch")]
    TransactionNotLastInBatch,
    #[msg("Batch is not empty")]
    BatchNotEmpty,
    #[msg("Invalid SpendingLimit amount")]
    SpendingLimitInvalidAmount,
    #[msg("Invalid Instruction Arguments")]
    InvalidInstructionArgs,
    #[msg("Final message buffer hash doesnt match the expected hash")]
    FinalBufferHashMismatch,
    #[msg("Final buffer size cannot exceed 4000 bytes")]
    FinalBufferSizeExceeded,
    #[msg("Final buffer size mismatch")]
    FinalBufferSizeMismatch,
    #[msg("multisig_create has been deprecated. Use multisig_create_v2 instead.")]
    MultisigCreateDeprecated,
}
