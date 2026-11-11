pub use squads_multisig_4r_program::error::{CoreError, CoreResult};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ClientError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[error("{0}")]
    Plan(String),
    /// A v3 member is a roles delegate: change the v3 members before the migration.
    #[error(transparent)]
    V3DelegateMembers(#[from] crate::v3_migration::V3DelegateMembersError),
    #[cfg(feature = "fetch")]
    #[error(transparent)]
    Rpc(#[from] solana_rpc_client_api::client_error::Error),
}

pub type ClientResult<T> = Result<T, ClientError>;
