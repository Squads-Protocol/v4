//! Rust client for the Squads Multisig 4r program (`SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5`).
//! It re-exports the program crate's core (types, builders, PDAs, messages; no Anchor) and adds
//! async owner-checked account fetches (`rpc`, feature `fetch`).

pub mod error;
#[cfg(feature = "fetch")]
pub mod rpc;

pub use squads_multisig_4r_program::{
    account, builders, discriminator, errors, instructions, message, pda, prelude, state, SmallVec,
    ID, LEGACY_V4_PROGRAM_ID,
};
