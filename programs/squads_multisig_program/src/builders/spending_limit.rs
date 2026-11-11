//! Spending limits.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta, optional};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::SpendingLimitUseArgs;

/// Accounts for `spending_limit_use`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SpendingLimitUse {
    /// The multisig account the `spending_limit` is for.
    pub multisig: Address,
    pub member: Address,
    /// The SpendingLimit account to use.
    pub spending_limit: Address,
    /// Multisig vault account to transfer tokens from.
    pub vault: Address,
    /// Destination account to transfer tokens to.
    pub destination: Address,
    /// In case `spending_limit.mint` is SOL.
    pub system_program: Option<Address>,
    /// The mint of the tokens to transfer in case `spending_limit.mint` is an SPL token.
    pub mint: Option<Address>,
    /// Multisig vault token account to transfer tokens from in case `spending_limit.mint` is an SPL token.
    pub vault_token_account: Option<Address>,
    /// Destination token account in case `spending_limit.mint` is an SPL token.
    pub destination_token_account: Option<Address>,
    /// In case `spending_limit.mint` is an SPL token.
    pub token_program: Option<Address>,
}

impl SpendingLimitUse {
    pub fn instruction(
        &self,
        args: SpendingLimitUseArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![
                meta(self.multisig, false, false),
                meta(self.member, false, true),
                meta(self.spending_limit, true, false),
                meta(self.vault, true, false),
                meta(self.destination, true, false),
                optional(self.system_program, false, false, &program_id),
                optional(self.mint, false, false, &program_id),
                optional(self.vault_token_account, true, false, &program_id),
                optional(self.destination_token_account, true, false, &program_id),
                optional(self.token_program, false, false, &program_id),
            ],
            data: data(discriminator::instruction::SPENDING_LIMIT_USE, &args)?,
        })
    }
}
