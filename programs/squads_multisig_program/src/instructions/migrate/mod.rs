//! Migration from v4: one instruction for each asset class. Every instruction runs inside a v4
//! vault transaction, checks the lineage and the governance (`MigrationAccounts`), and moves
//! assets only to the successor vault with the same index.

pub use common::*;
#[cfg(feature = "program")]
pub use programs::*;
pub use sol::*;
#[cfg(feature = "program")]
pub use stakes::*;
pub use token_authorities::*;
pub use tokens::*;
#[cfg(feature = "program")]
pub use vote_accounts::*;

mod common;
#[cfg(feature = "program")]
mod programs;
mod sol;
#[cfg(feature = "program")]
mod stakes;
mod token_authorities;
#[cfg(feature = "program")]
mod token_state;
mod tokens;
#[cfg(feature = "program")]
mod vote_accounts;

#[cfg(all(test, feature = "program"))]
mod proptests;
