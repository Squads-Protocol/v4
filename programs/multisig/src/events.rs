use anchor_lang::prelude::*;

/// New multisig account is created.
#[event]
pub struct MultisigCreated {
    /// The multisig account.
    pub multisig: Pubkey,
    #[index]
    /// Memo that was added by the creator.
    pub memo: Option<String>,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
#[non_exhaustive]
pub enum ConfigUpdateType {
    AddMember { reallocated: bool },
    RemoveMember,
    ChangeThreshold,
    SetConfigAuthority,
    SetTimeLock,
}

/// Multisig config is updated.
#[event]
pub struct MultisigConfigUpdated {
    /// The multisig account.
    pub multisig: Pubkey,
    #[index]
    /// Type of the config update.
    pub update: ConfigUpdateType,
    #[index]
    /// Memo that was added by the config authority.
    pub memo: Option<String>,
}

/// New multisig transaction account is created.
#[event]
pub struct TransactionCreated {
    /// The multisig account.
    pub multisig: Pubkey,
    /// The transaction account.
    pub transaction: Pubkey,
    #[index]
    /// Memo that was added by the creator.
    pub memo: Option<String>,
}

/// Transaction account is executed.
#[event]
pub struct TransactionExecuted {
    /// The multisig account.
    pub multisig: Pubkey,
    /// The transaction account.
    pub transaction: Pubkey,
}

/// New multisig proposal account is created.
#[event]
pub struct ProposalCreated {
    /// The multisig account.
    pub multisig: Pubkey,
    /// The transaction account.
    pub proposal: Pubkey,
}

/// Proposal is approved.
#[event]
pub struct ProposalApproved {
    /// The multisig account.
    pub multisig: Pubkey,
    /// The proposal account.
    pub proposal: Pubkey,
    #[index]
    /// Memo that was added by the creator.
    pub memo: Option<String>,
}

/// Proposal is rejected.
#[event]
pub struct ProposalRejected {
    /// The multisig account.
    pub multisig: Pubkey,
    /// The proposal account.
    pub proposal: Pubkey,
    #[index]
    /// Memo that was added by the creator.
    pub memo: Option<String>,
}
/// Proposal is cancelled.
#[event]
pub struct ProposalCancelled {
    /// The multisig account.
    pub multisig: Pubkey,
    /// The proposal account.
    pub proposal: Pubkey,
    #[index]
    /// Memo that was added by the creator.
    pub memo: Option<String>,
}
