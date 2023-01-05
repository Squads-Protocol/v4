use anchor_lang::prelude::*;

/// New multisig account is created.
#[event]
pub struct CreatedEvent {
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
pub struct ConfigUpdatedEvent {
    /// The multisig account.
    pub multisig: Pubkey,
    #[index]
    /// Type of the config update.
    pub update: ConfigUpdateType,
    #[index]
    /// Memo that was added by the config authority.
    pub memo: Option<String>,
}
