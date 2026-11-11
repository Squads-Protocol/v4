//! Multisig creation and direct (controlled) configuration.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta, optional};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::{
    MultisigAddMemberArgs, MultisigAddSpendingLimitArgs, MultisigChangeThresholdArgs,
    MultisigCreateArgsV2, MultisigRemoveMemberArgs, MultisigRemoveSpendingLimitArgs,
    MultisigSetConfigAuthorityArgs, MultisigSetRentCollectorArgs, MultisigSetTimeLockArgs,
};

/// Accounts for `multisig_add_member`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigAddMember {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    /// The account that will be charged or credited in case the multisig account needs to reallocate space,
    /// for example when adding a new member or a spending limit.
    pub rent_payer: Option<Address>,
    /// We might need it in case reallocation is needed.
    pub system_program: Option<Address>,
}

impl MultisigAddMember {
    pub fn instruction(
        &self,
        args: MultisigAddMemberArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.config_authority, false, true),
                optional(self.rent_payer, true, true, &program_id),
                optional(self.system_program, false, false, &program_id),
            ],
            data: data(discriminator::instruction::MULTISIG_ADD_MEMBER, &args)?,
        })
    }
}

/// Accounts for `multisig_add_spending_limit`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigAddSpendingLimit {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    pub spending_limit: Address,
    /// This is usually the same as `config_authority`, but can be a different account if needed.
    pub rent_payer: Address,
    pub system_program: Address,
}

impl MultisigAddSpendingLimit {
    pub fn instruction(
        &self,
        args: MultisigAddSpendingLimitArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.config_authority, false, true),
                meta(self.spending_limit, true, false),
                meta(self.rent_payer, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(
                discriminator::instruction::MULTISIG_ADD_SPENDING_LIMIT,
                &args,
            )?,
        })
    }
}

/// Accounts for `multisig_change_threshold`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigChangeThreshold {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    /// The account that will be charged or credited in case the multisig account needs to reallocate space,
    /// for example when adding a new member or a spending limit.
    pub rent_payer: Option<Address>,
    /// We might need it in case reallocation is needed.
    pub system_program: Option<Address>,
}

impl MultisigChangeThreshold {
    pub fn instruction(
        &self,
        args: MultisigChangeThresholdArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.config_authority, false, true),
                optional(self.rent_payer, true, true, &program_id),
                optional(self.system_program, false, false, &program_id),
            ],
            data: data(discriminator::instruction::MULTISIG_CHANGE_THRESHOLD, &args)?,
        })
    }
}

/// Accounts for `multisig_create_v2`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigCreateV2 {
    /// Global program config account.
    pub program_config: Address,
    /// The treasury where the creation fee is transferred to.
    pub treasury: Address,
    pub multisig: Address,
    /// An ephemeral signer that is used as a seed for the Multisig PDA.
    /// Must be a signer to prevent front-running attack by someone else but the original creator.
    pub create_key: Address,
    /// The creator of the multisig.
    pub creator: Address,
    pub system_program: Address,
}

impl MultisigCreateV2 {
    pub fn instruction(
        &self,
        args: MultisigCreateArgsV2,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.program_config, false, false),
                meta(self.treasury, true, false),
                meta(self.multisig, true, false),
                meta(self.create_key, false, true),
                meta(self.creator, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::MULTISIG_CREATE_V2, &args)?,
        })
    }
}

/// Accounts for `multisig_remove_member`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigRemoveMember {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    /// The account that will be charged or credited in case the multisig account needs to reallocate space,
    /// for example when adding a new member or a spending limit.
    pub rent_payer: Option<Address>,
    /// We might need it in case reallocation is needed.
    pub system_program: Option<Address>,
}

impl MultisigRemoveMember {
    pub fn instruction(
        &self,
        args: MultisigRemoveMemberArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.config_authority, false, true),
                optional(self.rent_payer, true, true, &program_id),
                optional(self.system_program, false, false, &program_id),
            ],
            data: data(discriminator::instruction::MULTISIG_REMOVE_MEMBER, &args)?,
        })
    }
}

/// Accounts for `multisig_remove_spending_limit`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigRemoveSpendingLimit {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    pub spending_limit: Address,
    /// This is usually the same as `config_authority`, but can be a different account if needed.
    pub rent_collector: Address,
}

impl MultisigRemoveSpendingLimit {
    pub fn instruction(
        &self,
        args: MultisigRemoveSpendingLimitArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.config_authority, false, true),
                meta(self.spending_limit, true, false),
                meta(self.rent_collector, true, false),
            ],
            data: data(
                discriminator::instruction::MULTISIG_REMOVE_SPENDING_LIMIT,
                &args,
            )?,
        })
    }
}

/// Accounts for `multisig_set_config_authority`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigSetConfigAuthority {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    /// The account that will be charged or credited in case the multisig account needs to reallocate space,
    /// for example when adding a new member or a spending limit.
    pub rent_payer: Option<Address>,
    /// We might need it in case reallocation is needed.
    pub system_program: Option<Address>,
}

impl MultisigSetConfigAuthority {
    pub fn instruction(
        &self,
        args: MultisigSetConfigAuthorityArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.config_authority, false, true),
                optional(self.rent_payer, true, true, &program_id),
                optional(self.system_program, false, false, &program_id),
            ],
            data: data(
                discriminator::instruction::MULTISIG_SET_CONFIG_AUTHORITY,
                &args,
            )?,
        })
    }
}

/// Accounts for `multisig_set_rent_collector`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigSetRentCollector {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    /// The account that will be charged or credited in case the multisig account needs to reallocate space,
    /// for example when adding a new member or a spending limit.
    pub rent_payer: Option<Address>,
    /// We might need it in case reallocation is needed.
    pub system_program: Option<Address>,
}

impl MultisigSetRentCollector {
    pub fn instruction(
        &self,
        args: MultisigSetRentCollectorArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.config_authority, false, true),
                optional(self.rent_payer, true, true, &program_id),
                optional(self.system_program, false, false, &program_id),
            ],
            data: data(
                discriminator::instruction::MULTISIG_SET_RENT_COLLECTOR,
                &args,
            )?,
        })
    }
}

/// Accounts for `multisig_set_time_lock`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigSetTimeLock {
    pub multisig: Address,
    /// Multisig `config_authority` that must authorize the configuration change.
    pub config_authority: Address,
    /// The account that will be charged or credited in case the multisig account needs to reallocate space,
    /// for example when adding a new member or a spending limit.
    pub rent_payer: Option<Address>,
    /// We might need it in case reallocation is needed.
    pub system_program: Option<Address>,
}

impl MultisigSetTimeLock {
    pub fn instruction(
        &self,
        args: MultisigSetTimeLockArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.config_authority, false, true),
                optional(self.rent_payer, true, true, &program_id),
                optional(self.system_program, false, false, &program_id),
            ],
            data: data(discriminator::instruction::MULTISIG_SET_TIME_LOCK, &args)?,
        })
    }
}
