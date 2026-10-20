//! Config transactions.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta, optional};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::ConfigTransactionCreateArgs;

/// Accounts for `config_transaction_accounts_close`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigTransactionAccountsClose {
    pub multisig: Address,
    /// the logic within `config_transaction_accounts_close` does the rest of the checks.
    pub proposal: Address,
    /// ConfigTransaction corresponding to the `proposal`.
    pub transaction: Address,
    /// The rent collector.
    pub rent_collector: Address,
    pub system_program: Address,
}

impl ConfigTransactionAccountsClose {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.proposal, true, false),
                meta(self.transaction, true, false),
                meta(self.rent_collector, true, false),
                meta(self.system_program, false, false),
            ],
            data: discriminator::instruction::CONFIG_TRANSACTION_ACCOUNTS_CLOSE.to_vec(),
        }
    }
}

/// Accounts for `config_transaction_create`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigTransactionCreate {
    pub multisig: Address,
    pub transaction: Address,
    /// The member of the multisig that is creating the transaction.
    pub creator: Address,
    /// The payer for the transaction account rent.
    pub rent_payer: Address,
    pub system_program: Address,
}

impl ConfigTransactionCreate {
    pub fn instruction(
        &self,
        args: ConfigTransactionCreateArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.transaction, true, false),
                meta(self.creator, false, true),
                meta(self.rent_payer, true, true),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::CONFIG_TRANSACTION_CREATE, &args)?,
        })
    }
}

/// Accounts for `config_transaction_execute`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ConfigTransactionExecute {
    /// The multisig account that owns the transaction.
    pub multisig: Address,
    /// One of the multisig members with `Execute` permission.
    pub member: Address,
    /// The proposal account associated with the transaction.
    pub proposal: Address,
    /// The transaction to execute.
    pub transaction: Address,
    /// The account that will be charged/credited in case the config transaction causes space reallocation,
    /// for example when adding a new member, adding or removing a spending limit.
    pub rent_payer: Option<Address>,
    /// We might need it in case reallocation is needed.
    pub system_program: Option<Address>,
}

impl ConfigTransactionExecute {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, true, false),
                meta(self.member, false, true),
                meta(self.proposal, true, false),
                meta(self.transaction, false, false),
                optional(self.rent_payer, true, true, &program_id),
                optional(self.system_program, false, false, &program_id),
            ],
            data: discriminator::instruction::CONFIG_TRANSACTION_EXECUTE.to_vec(),
        }
    }
}
