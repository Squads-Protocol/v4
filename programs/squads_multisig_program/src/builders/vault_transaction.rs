//! Vault transactions.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::VaultTransactionCreateArgs;

/// Accounts for `vault_transaction_accounts_close`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VaultTransactionAccountsClose {
    pub multisig: Address,
    /// the logic within `vault_transaction_accounts_close` does the rest of the checks.
    pub proposal: Address,
    /// VaultTransaction corresponding to the `proposal`.
    pub transaction: Address,
    /// The rent collector.
    pub rent_collector: Address,
    pub system_program: Address,
}

impl VaultTransactionAccountsClose {
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
            data: discriminator::instruction::VAULT_TRANSACTION_ACCOUNTS_CLOSE.to_vec(),
        }
    }
}

/// Accounts for `vault_transaction_create`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VaultTransactionCreate {
    pub multisig: Address,
    pub transaction: Address,
    /// The member of the multisig that is creating the transaction.
    pub creator: Address,
    /// The payer for the transaction account rent.
    pub rent_payer: Address,
    pub system_program: Address,
}

impl VaultTransactionCreate {
    pub fn instruction(
        &self,
        args: VaultTransactionCreateArgs,
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
            data: data(discriminator::instruction::VAULT_TRANSACTION_CREATE, &args)?,
        })
    }
}

/// Accounts for `vault_transaction_create_from_buffer`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VaultTransactionCreateFromBuffer {
    pub vault_transaction_create_multisig: Address,
    pub vault_transaction_create_transaction: Address,
    /// The member of the multisig that is creating the transaction.
    pub vault_transaction_create_creator: Address,
    /// The payer for the transaction account rent.
    pub vault_transaction_create_rent_payer: Address,
    pub vault_transaction_create_system_program: Address,
    pub transaction_buffer: Address,
    pub creator: Address,
}

impl VaultTransactionCreateFromBuffer {
    pub fn instruction(
        &self,
        args: VaultTransactionCreateArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.vault_transaction_create_multisig, true, false),
                meta(self.vault_transaction_create_transaction, true, false),
                meta(self.vault_transaction_create_creator, false, true),
                meta(self.vault_transaction_create_rent_payer, true, true),
                meta(self.vault_transaction_create_system_program, false, false),
                meta(self.transaction_buffer, true, false),
                meta(self.creator, true, true),
            ],
            data: data(
                discriminator::instruction::VAULT_TRANSACTION_CREATE_FROM_BUFFER,
                &args,
            )?,
        })
    }
}

/// Accounts for `vault_transaction_execute`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct VaultTransactionExecute {
    pub multisig: Address,
    /// The proposal account associated with the transaction.
    pub proposal: Address,
    /// The transaction to execute.
    pub transaction: Address,
    pub member: Address,
}

impl VaultTransactionExecute {
    pub fn instruction(&self, program_id: Option<&Address>) -> Instruction {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.proposal, true, false),
                meta(self.transaction, false, false),
                meta(self.member, false, true),
            ],
            data: discriminator::instruction::VAULT_TRANSACTION_EXECUTE.to_vec(),
        }
    }
}
