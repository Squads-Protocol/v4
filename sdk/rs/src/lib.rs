//! Rust client for the Squads Multisig 4r program (`SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5`).
//! `generated` comes from Codama (`sdk/multisig-4r/scripts/generate.mjs`); the other modules
//! add PDA helpers, vault transaction message compilation, and owner-checked RPC fetches.

#[allow(unused_imports)]
mod generated;

pub mod error;
pub mod message;
pub mod pda;
#[cfg(feature = "fetch")]
pub mod rpc;

// Generated code refers to `crate::shared` and `crate::SQUADS_MULTISIG4R_ID`.
pub use generated::programs::{SQUADS_MULTISIG4R_ID, SQUADS_MULTISIG4R_ID as ID};
pub use generated::{accounts, errors, instructions, programs, shared, types};

/// Returns `instruction` addressed to `program_id`, for localnet or staging deployments.
/// Also moves the `None` optional-account placeholders (readonly, non-signer metas set to
/// the mainnet ID by the generated builders) to `program_id`, as Anchor expects.
pub fn with_program_id(
    instruction: solana_instruction::Instruction,
    program_id: &solana_address::Address,
) -> solana_instruction::Instruction {
    let is_placeholder = |meta: &solana_instruction::AccountMeta| {
        meta.pubkey == ID && !meta.is_signer && !meta.is_writable
    };
    solana_instruction::Instruction {
        program_id: *program_id,
        accounts: instruction
            .accounts
            .into_iter()
            .map(|meta| match is_placeholder(&meta) {
                true => solana_instruction::AccountMeta::new_readonly(*program_id, false),
                false => meta,
            })
            .collect(),
        data: instruction.data,
    }
}
