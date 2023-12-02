use anchor_lang::prelude::*;

use crate::errors::MultisigError;

/// Global program configuration account.
#[account]
#[derive(InitSpace)]
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
