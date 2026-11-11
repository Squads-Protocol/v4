//! Proposals and votes.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::{ProposalCreateArgs, ProposalVoteArgs};

/// Accounts for `proposal_activate`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProposalActivate {
    pub multisig: Address,
    pub member: Address,
    pub proposal: Address,
}

impl ProposalActivate {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.member, true, true),
                meta(self.proposal, true, false),
            ],
            data: discriminator::instruction::PROPOSAL_ACTIVATE.to_vec(),
        }
    }
}

/// Accounts for `proposal_approve`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProposalApprove {
    pub multisig: Address,
    pub member: Address,
    pub proposal: Address,
}

impl ProposalApprove {
    pub fn instruction(
        &self,
        args: ProposalVoteArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.member, true, true),
                meta(self.proposal, true, false),
            ],
            data: data(discriminator::instruction::PROPOSAL_APPROVE, &args)?,
        })
    }
}

/// Accounts for `proposal_cancel`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProposalCancel {
    pub multisig: Address,
    pub member: Address,
    pub proposal: Address,
}

impl ProposalCancel {
    pub fn instruction(
        &self,
        args: ProposalVoteArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.member, true, true),
                meta(self.proposal, true, false),
            ],
            data: data(discriminator::instruction::PROPOSAL_CANCEL, &args)?,
        })
    }
}

/// Accounts for `proposal_cancel_v2`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProposalCancelV2 {
    pub multisig: Address,
    pub member: Address,
    pub proposal: Address,
    pub system_program: Address,
}

impl ProposalCancelV2 {
    pub fn instruction(
        &self,
        args: ProposalVoteArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.member, true, true),
                meta(self.proposal, true, false),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::PROPOSAL_CANCEL_V2, &args)?,
        })
    }
}

/// Accounts for `proposal_create`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProposalCreate {
    pub multisig: Address,
    pub proposal: Address,
    /// The member of the multisig that is creating the proposal.
    pub creator: Address,
    /// The payer for the proposal account rent.
    pub rent_payer: Address,
    pub system_program: Address,
}

impl ProposalCreate {
    pub fn instruction(
        &self,
        args: ProposalCreateArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.proposal, true, false),
                meta(self.creator, false, true),
                meta(self.rent_payer, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::PROPOSAL_CREATE, &args)?,
        })
    }
}

/// Accounts for `proposal_reject`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ProposalReject {
    pub multisig: Address,
    pub member: Address,
    pub proposal: Address,
}

impl ProposalReject {
    pub fn instruction(
        &self,
        args: ProposalVoteArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.member, true, true),
                meta(self.proposal, true, false),
            ],
            data: data(discriminator::instruction::PROPOSAL_REJECT, &args)?,
        })
    }
}
