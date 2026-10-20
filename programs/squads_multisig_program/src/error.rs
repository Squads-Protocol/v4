//! Errors of the core helpers (decoding, message compilation, instruction data).
//! On-chain program errors are [`crate::errors::MultisigError`].

use solana_address::Address;
use thiserror::Error;

#[derive(Debug, Error, Clone, PartialEq, Eq)]
pub enum CoreError {
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
    #[error("failed to serialize instruction data: {0:?}")]
    Serialization(borsh::io::ErrorKind),
    #[error("address lookup table {0} was not provided")]
    MissingAddressLookupTable(Address),
    #[error("address lookup table {table} has no address at index {index}")]
    InvalidLookupIndex { table: Address, index: u8 },
    #[error("instruction references account {0}, which is not in the message")]
    UnknownInstructionKey(Address),
    #[error("the message has more than 256 accounts")]
    AccountIndexOverflow,
    #[error("an address lookup table index is greater than 255")]
    AddressTableLookupIndexOverflow,
    #[error("invalid transaction message")]
    InvalidTransactionMessage,
}

pub type CoreResult<T> = Result<T, CoreError>;
