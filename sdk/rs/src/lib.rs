//! Rust client for the Squads Multisig 4r program (`SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5`).
//! It re-exports the program crate's core (types, builders, PDAs, messages; no Anchor) and adds
//! async owner-checked account fetches (`rpc`, feature `fetch`), the migration planners (v4 and
//! v3 sources) and a v3 client (`v3`).

pub mod error;
pub mod lookup_tables;
pub mod planner;
#[cfg(feature = "fetch")]
pub mod rpc;
pub mod v3;
pub mod v3_migration;

pub use squads_multisig_4r_program::{
    account, builders, discriminator, errors, events, instructions, message, migration, pda,
    prelude, state, SmallVec, ID, LEGACY_V4_PROGRAM_ID,
};
