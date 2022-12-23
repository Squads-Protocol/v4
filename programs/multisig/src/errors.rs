use anchor_lang::prelude::*;

#[error_code]
pub enum MultisigError {
    #[msg("Found multiple members with the same pubkey")]
    DuplicateMember,
    #[msg("Members array is empty")]
    EmptyMembers,
    #[msg("Too many members, can be up to 65535")]
    TooManyMembers,
    #[msg("Invalid threshold, must be between 1 and number of members")]
    InvalidThreshold,
}
