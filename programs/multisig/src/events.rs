use anchor_lang::prelude::*;

/// New multisig account is created.
#[event]
pub struct MultisigCreatedEvent {
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
    ChangeConfigAuthority,
    ChangeAllowExternalExecute,
}

/// Multisig config is updated.
#[event]
pub struct MultisigConfigUpdatedEvent {
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
pub struct TransactionCreatedEvent {
    /// The multisig account.
    pub multisig: Pubkey,
    /// The transaction account.
    pub transaction: Pubkey,
    #[index]
    /// Memo that was added by the creator.
    pub memo: Option<String>,
}
