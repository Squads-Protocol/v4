//! Instruction builders for every live instruction. Each builder holds the accounts and
//! returns a `solana_instruction::Instruction` for the given program ID (default [`crate::ID`]).
//! An omitted optional account (`None`) is encoded as the program ID, as Anchor expects.

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};

use crate::error::{CoreError, CoreResult};
use crate::prelude::BorshSerialize;

mod batch;
mod config_transaction;
mod log_event;
mod migration;
mod multisig;
mod program_config;
mod proposal;
mod spending_limit;
mod transaction_buffer;
mod vault_transaction;

pub use batch::*;
pub use config_transaction::*;
pub use log_event::*;
pub use migration::*;
pub use multisig::*;
pub use program_config::*;
pub use proposal::*;
pub use spending_limit::*;
pub use transaction_buffer::*;
pub use vault_transaction::*;

/// Enables events: appends the program ID as a trailing read-only account. Apply it last, after
/// any remaining accounts. A no-op for [`crate::LEGACY_V4_PROGRAM_ID`], which has no events.
pub fn with_events(mut instruction: Instruction) -> Instruction {
    if instruction.program_id != crate::LEGACY_V4_PROGRAM_ID {
        instruction
            .accounts
            .push(meta(instruction.program_id, false, false));
    }
    instruction
}

/// The System Program address, for the `system_program` accounts.
pub const SYSTEM_PROGRAM_ID: Address = Address::new_from_array([0; 32]);

fn meta(pubkey: Address, is_writable: bool, is_signer: bool) -> AccountMeta {
    AccountMeta {
        pubkey,
        is_signer,
        is_writable,
    }
}

fn optional(
    account: Option<Address>,
    is_writable: bool,
    is_signer: bool,
    program_id: &Address,
) -> AccountMeta {
    match account {
        Some(pubkey) => meta(pubkey, is_writable, is_signer),
        None => meta(*program_id, false, false),
    }
}

fn data<A: BorshSerialize>(discriminator: [u8; 8], args: &A) -> CoreResult<Vec<u8>> {
    let mut data = discriminator.to_vec();
    args.serialize(&mut data)
        .map_err(|error| CoreError::Serialization(error.kind()))?;
    Ok(data)
}
