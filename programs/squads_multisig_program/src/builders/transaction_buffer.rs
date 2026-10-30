//! Transaction buffers.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::{TransactionBufferCreateArgs, TransactionBufferExtendArgs};

/// Accounts for `transaction_buffer_close`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransactionBufferClose {
    pub multisig: Address,
    pub transaction_buffer: Address,
    /// The member of the multisig that created the TransactionBuffer.
    pub creator: Address,
}

impl TransactionBufferClose {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.transaction_buffer, true, false),
                meta(self.creator, false, true),
            ],
            data: discriminator::instruction::TRANSACTION_BUFFER_CLOSE.to_vec(),
        }
    }
}

/// Accounts for `transaction_buffer_create`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransactionBufferCreate {
    pub multisig: Address,
    pub transaction_buffer: Address,
    /// The member of the multisig that is creating the transaction.
    pub creator: Address,
    /// The payer for the transaction account rent.
    pub rent_payer: Address,
    pub system_program: Address,
}

impl TransactionBufferCreate {
    pub fn instruction(
        &self,
        args: TransactionBufferCreateArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.transaction_buffer, true, false),
                meta(self.creator, false, true),
                meta(self.rent_payer, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::TRANSACTION_BUFFER_CREATE, &args)?,
        })
    }
}

/// Accounts for `transaction_buffer_extend`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TransactionBufferExtend {
    pub multisig: Address,
    pub transaction_buffer: Address,
    /// The member of the multisig that created the TransactionBuffer.
    pub creator: Address,
}

impl TransactionBufferExtend {
    pub fn instruction(
        &self,
        args: TransactionBufferExtendArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.transaction_buffer, true, false),
                meta(self.creator, false, true),
            ],
            data: data(discriminator::instruction::TRANSACTION_BUFFER_EXTEND, &args)?,
        })
    }
}
