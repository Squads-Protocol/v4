//! Program config.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::{
    ProgramConfigInitArgs, ProgramConfigSetAuthorityArgs, ProgramConfigSetMultisigCreationFeeArgs,
    ProgramConfigSetTreasuryArgs,
};

/// Accounts for `program_config_init`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProgramConfigInit {
    pub program_config: Address,
    /// The hard-coded account that is used to initialize the program config once.
    pub initializer: Address,
    pub system_program: Address,
}

impl ProgramConfigInit {
    pub fn instruction(
        &self,
        args: ProgramConfigInitArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.program_config, true, false),
                meta(self.initializer, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::PROGRAM_CONFIG_INIT, &args)?,
        })
    }
}

/// Accounts for `program_config_set_authority`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProgramConfigSetAuthority {
    pub program_config: Address,
    pub authority: Address,
}

impl ProgramConfigSetAuthority {
    pub fn instruction(
        &self,
        args: ProgramConfigSetAuthorityArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.program_config, true, false),
                meta(self.authority, false, true),
            ],
            data: data(
                discriminator::instruction::PROGRAM_CONFIG_SET_AUTHORITY,
                &args,
            )?,
        })
    }
}

/// Accounts for `program_config_set_multisig_creation_fee`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProgramConfigSetMultisigCreationFee {
    pub program_config: Address,
    pub authority: Address,
}

impl ProgramConfigSetMultisigCreationFee {
    pub fn instruction(
        &self,
        args: ProgramConfigSetMultisigCreationFeeArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.program_config, true, false),
                meta(self.authority, false, true),
            ],
            data: data(
                discriminator::instruction::PROGRAM_CONFIG_SET_MULTISIG_CREATION_FEE,
                &args,
            )?,
        })
    }
}

/// Accounts for `program_config_set_treasury`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProgramConfigSetTreasury {
    pub program_config: Address,
    pub authority: Address,
}

impl ProgramConfigSetTreasury {
    pub fn instruction(
        &self,
        args: ProgramConfigSetTreasuryArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.program_config, true, false),
                meta(self.authority, false, true),
            ],
            data: data(
                discriminator::instruction::PROGRAM_CONFIG_SET_TREASURY,
                &args,
            )?,
        })
    }
}
