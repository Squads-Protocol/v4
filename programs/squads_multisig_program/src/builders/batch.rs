//! Batches.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::{BatchAddTransactionArgs, BatchCreateArgs};

/// Accounts for `batch_accounts_close`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BatchAccountsClose {
    pub multisig: Address,
    /// the logic within `batch_accounts_close` does the rest of the checks.
    pub proposal: Address,
    /// `Batch` corresponding to the `proposal`.
    pub batch: Address,
    /// The rent collector.
    pub rent_collector: Address,
    pub system_program: Address,
}

impl BatchAccountsClose {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.proposal, true, false),
                meta(self.batch, true, false),
                meta(self.rent_collector, true, false),
                meta(self.system_program, false, false),
            ],
            data: discriminator::instruction::BATCH_ACCOUNTS_CLOSE.to_vec(),
        }
    }
}

/// Accounts for `batch_add_transaction`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BatchAddTransaction {
    /// Multisig account this batch belongs to.
    pub multisig: Address,
    /// The proposal account associated with the batch.
    pub proposal: Address,
    pub batch: Address,
    /// `VaultBatchTransaction` account to initialize and add to the `batch`.
    pub transaction: Address,
    /// Member of the multisig.
    pub member: Address,
    /// The payer for the batch transaction account rent.
    pub rent_payer: Address,
    pub system_program: Address,
}

impl BatchAddTransaction {
    pub fn instruction(
        &self,
        args: BatchAddTransactionArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.proposal, false, false),
                meta(self.batch, true, false),
                meta(self.transaction, true, false),
                meta(self.member, false, true),
                meta(self.rent_payer, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::BATCH_ADD_TRANSACTION, &args)?,
        })
    }
}

/// Accounts for `batch_create`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BatchCreate {
    pub multisig: Address,
    pub batch: Address,
    /// The member of the multisig that is creating the batch.
    pub creator: Address,
    /// The payer for the batch account rent.
    pub rent_payer: Address,
    pub system_program: Address,
}

impl BatchCreate {
    pub fn instruction(
        &self,
        args: BatchCreateArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.batch, true, false),
                meta(self.creator, false, true),
                meta(self.rent_payer, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::BATCH_CREATE, &args)?,
        })
    }
}

/// Accounts for `batch_execute_transaction`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BatchExecuteTransaction {
    /// Multisig account this batch belongs to.
    pub multisig: Address,
    /// Member of the multisig.
    pub member: Address,
    /// The proposal account associated with the batch.
    /// If `transaction` is the last in the batch, the `proposal` status will be set to `Executed`.
    pub proposal: Address,
    pub batch: Address,
    /// Batch transaction to execute.
    pub transaction: Address,
}

impl BatchExecuteTransaction {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.member, false, true),
                meta(self.proposal, true, false),
                meta(self.batch, true, false),
                meta(self.transaction, false, false),
            ],
            data: discriminator::instruction::BATCH_EXECUTE_TRANSACTION.to_vec(),
        }
    }
}

/// Accounts for `vault_batch_transaction_account_close`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VaultBatchTransactionAccountClose {
    pub multisig: Address,
    pub proposal: Address,
    /// `Batch` corresponding to the `proposal`.
    pub batch: Address,
    /// `VaultBatchTransaction` account to close.
    /// The transaction must be the current last one in the batch.
    pub transaction: Address,
    /// The rent collector.
    pub rent_collector: Address,
    pub system_program: Address,
}

impl VaultBatchTransactionAccountClose {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.proposal, false, false),
                meta(self.batch, true, false),
                meta(self.transaction, true, false),
                meta(self.rent_collector, true, false),
                meta(self.system_program, false, false),
            ],
            data: discriminator::instruction::VAULT_BATCH_TRANSACTION_ACCOUNT_CLOSE.to_vec(),
        }
    }
}
