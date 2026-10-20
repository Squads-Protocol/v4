//! The program entrypoint. `log_event` returns here, before Anchor's dispatch: it only carries an
//! event in its data. All other instructions go to Anchor's `entry`.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::entrypoint::ProgramResult;

use crate::discriminator::instruction::LOG_EVENT;
use crate::instructions::check_log_event;

anchor_lang::solana_program::entrypoint!(process_instruction);

fn process_instruction<'info>(
    program_id: &'info Pubkey,
    accounts: &'info [AccountInfo<'info>],
    data: &'info [u8],
) -> ProgramResult {
    if !data.starts_with(&LOG_EVENT) {
        return crate::entry(program_id, accounts, data);
    }
    log_event(program_id, accounts).map_err(|error| {
        error.log();
        error.into()
    })
}

// Anchor's `try_entry` checks the program ID; the account checks are `check_log_event`, which
// the Anchor `LogEvent` handler also runs. The event data is not decoded: only this program
// writes it.
fn log_event(program_id: &Pubkey, accounts: &[AccountInfo]) -> Result<()> {
    require_keys_eq!(*program_id, crate::ID, ErrorCode::DeclaredProgramIdMismatch);
    let log_authority = accounts.first().ok_or(ErrorCode::AccountNotEnoughKeys)?;
    check_log_event(log_authority)
}
