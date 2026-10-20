use solana_address::Address;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ClientError {
    #[cfg(feature = "fetch")]
    #[error(transparent)]
    Rpc(#[from] solana_rpc_client_api::client_error::Error),
    #[error("account {address} is owned by {owner}, expected {expected}")]
    WrongOwner {
        address: Address,
        owner: Address,
        expected: Address,
    },
    #[error("account {0} has an unexpected discriminator")]
    WrongDiscriminator(Address),
    #[error("failed to deserialize account {0}")]
    Deserialization(Address),
    #[error("address lookup table {0} was not provided")]
    MissingAddressLookupTable(Address),
    #[error("address lookup table {table} has no address at index {index}")]
    InvalidLookupIndex { table: Address, index: u8 },
    #[error("invalid transaction message")]
    InvalidTransactionMessage,
    #[error(transparent)]
    Compile(#[from] solana_message::CompileError),
}

pub type ClientResult<T> = Result<T, ClientError>;
