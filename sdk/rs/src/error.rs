pub use squads_multisig_4r_program::error::{CoreError, CoreResult};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ClientError {
    #[error(transparent)]
    Core(#[from] CoreError),
    #[cfg(feature = "fetch")]
    #[error(transparent)]
    Rpc(#[from] solana_rpc_client_api::client_error::Error),
}

pub type ClientResult<T> = Result<T, ClientError>;
