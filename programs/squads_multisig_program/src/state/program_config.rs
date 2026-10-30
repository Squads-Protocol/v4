#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(not(feature = "program"))]
use crate::prelude::*;

/// Global program configuration account.
#[cfg_attr(feature = "program", account)]
#[cfg_attr(
    not(feature = "program"),
    derive(BorshSerialize, BorshDeserialize, Clone)
)]
#[cfg_attr(feature = "program", derive(InitSpace))]
#[derive(Debug, PartialEq, Eq)]
pub struct ProgramConfig {
    /// The authority which can update the config.
    pub authority: Pubkey,
    /// The lamports amount charged for creating a new multisig account.
    /// This fee is sent to the `treasury` account.
    pub multisig_creation_fee: u64,
    /// The treasury account to send charged fees to.
    pub treasury: Pubkey,
    /// Reserved for future use.
    pub _reserved: [u8; 64],
}

impl ProgramConfig {
    /// Serialized size without the 8-byte discriminator.
    pub const LEN: usize = 32 + 8 + 32 + 64;

    #[cfg(feature = "program")]
    pub fn invariant(&self) -> Result<()> {
        // authority must be non-default.
        require_keys_neq!(
            self.authority,
            Pubkey::default(),
            MultisigError::InvalidAccount
        );

        // treasury must be non-default.
        require_keys_neq!(
            self.treasury,
            Pubkey::default(),
            MultisigError::InvalidAccount
        );

        Ok(())
    }
}
