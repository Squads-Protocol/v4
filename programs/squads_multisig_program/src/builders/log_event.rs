//! `log_event`. Only the program calls it, through a self-CPI; clients decode it.

use solana_address::Address;
use solana_instruction::Instruction;

use super::{data, meta};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::LogEventArgs;

/// Accounts for `log_event`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LogEvent {
    pub log_authority: Address,
}

impl LogEvent {
    pub fn instruction(
        &self,
        args: LogEventArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let program_id = *program_id.unwrap_or(&crate::ID);
        Ok(Instruction {
            program_id,
            accounts: vec![meta(self.log_authority, false, true)],
            data: data(discriminator::instruction::LOG_EVENT, &args)?,
        })
    }
}
