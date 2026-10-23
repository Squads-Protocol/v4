#[cfg(feature = "program")]
use anchor_lang::prelude::*;

// The 50 program errors, in code order (6000 + index). With `program` they render as an Anchor
// `#[error_code]` enum, which also feeds the IDL; without it, as a plain enum with the same codes
// and messages. `#[error_code]` does not accept `cfg_attr` on variants, so the list is shared here.
macro_rules! multisig_errors {
    ($($(#[doc = $doc:literal])* #[msg($msg:literal)] $name:ident,)*) => {
        #[cfg(feature = "program")]
        #[anchor_lang::prelude::error_code]
        #[derive(PartialEq, Eq)]
        pub enum MultisigError {
            $($(#[doc = $doc])* #[msg($msg)] $name,)*
        }

        #[cfg(not(feature = "program"))]
        #[derive(Debug, Clone, Copy, PartialEq, Eq)]
        #[repr(u32)]
        pub enum MultisigError {
            $($(#[doc = $doc])* $name,)*
        }

        impl MultisigError {
            /// Every error, in code order.
            pub const ALL: &'static [MultisigError] = &[$(MultisigError::$name,)*];

            pub fn from_code(code: u32) -> Option<Self> {
                Self::ALL.iter().copied().find(|error| error.code() == code)
            }
        }

        #[cfg(not(feature = "program"))]
        impl MultisigError {
            pub fn name(&self) -> String {
                match self {
                    $(Self::$name => stringify!($name).to_string(),)*
                }
            }

            pub const fn message(&self) -> &'static str {
                match self {
                    $(Self::$name => $msg,)*
                }
            }
        }

        #[cfg(not(feature = "program"))]
        impl core::fmt::Display for MultisigError {
            fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
                f.write_str(self.message())
            }
        }

        #[cfg(not(feature = "program"))]
        impl std::error::Error for MultisigError {}
    };
}

/// Anchor's offset for custom program errors.
pub const ERROR_CODE_OFFSET: u32 = 6000;

impl MultisigError {
    /// The custom program error code (`6000 + variant index`).
    pub const fn code(self) -> u32 {
        ERROR_CODE_OFFSET + self as u32
    }
}

multisig_errors! {
    #[msg("Found multiple members with the same pubkey")]
    DuplicateMember,
    #[msg("Members array is empty")]
    EmptyMembers,
    #[msg("Too many members, can be up to 65535")]
    TooManyMembers,
    #[msg("Invalid threshold, must be between 1 and number of members with Vote permission")]
    InvalidThreshold,
    #[msg("Attempted to perform an unauthorized action")]
    Unauthorized,
    #[msg("Provided pubkey is not a member of multisig")]
    NotAMember,
    #[msg("TransactionMessage is malformed.")]
    InvalidTransactionMessage,
    #[msg("Proposal is stale")]
    StaleProposal,
    #[msg("Invalid proposal status")]
    InvalidProposalStatus,
    #[msg("Invalid transaction index")]
    InvalidTransactionIndex,
    #[msg("Member already approved the transaction")]
    AlreadyApproved,
    #[msg("Member already rejected the transaction")]
    AlreadyRejected,
    #[msg("Member already cancelled the transaction")]
    AlreadyCancelled,
    #[msg("Wrong number of accounts provided")]
    InvalidNumberOfAccounts,
    #[msg("Invalid account provided")]
    InvalidAccount,
    #[msg("Cannot remove last member")]
    RemoveLastMember,
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
    #[msg("Proposal time lock has not been released")]
    TimeLockNotReleased,
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
    #[msg("Instruction is protected: log_event runs only as a self-CPI by the program")]
    ProtectedInstruction,
    #[msg("The successor multisig does not have the governance of the v4 multisig")]
    MigrationGovernanceMismatch,
    #[msg("The vault index hint does not name a vault of the v4 multisig")]
    MigrationInvalidVaultHint,
    #[msg("The asset accounts do not match the migration assets")]
    MigrationInvalidAssetAccounts,
    #[msg("The SOL to keep in the v4 vault is less than the rent minimum")]
    MigrationInvalidAmount,
    #[msg("The 4r multisig creation fee is larger than max_creation_fee")]
    MigrationCreationFeeTooHigh,
}
