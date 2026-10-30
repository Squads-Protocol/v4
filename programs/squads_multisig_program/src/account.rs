//! Account decoding with owner and discriminator checks, without Anchor.

use solana_address::Address;

use crate::discriminator::account as disc;
use crate::error::{CoreError, CoreResult};
use crate::prelude::BorshDeserialize;
use crate::state::{
    Batch, ConfigTransaction, Multisig, ProgramConfig, Proposal, SpendingLimit, TransactionBuffer,
    VaultBatchTransaction, VaultTransaction,
};

/// A program account: its discriminator and its borsh layout after the discriminator.
pub trait ProgramAccount: BorshDeserialize {
    const ACCOUNT_DISCRIMINATOR: [u8; 8];

    /// Decodes account data after checking the discriminator. Trailing bytes are ignored,
    /// as Anchor does (accounts can be larger than their content).
    fn try_from_account_data(address: &Address, data: &[u8]) -> CoreResult<Self> {
        let body = data
            .strip_prefix(&Self::ACCOUNT_DISCRIMINATOR)
            .ok_or(CoreError::WrongDiscriminator(*address))?;
        Self::deserialize(&mut &body[..]).map_err(|_| CoreError::Deserialization(*address))
    }
}

macro_rules! program_accounts {
    ($($ty:ident => $disc:ident),* $(,)?) => {
        $(impl ProgramAccount for $ty {
            const ACCOUNT_DISCRIMINATOR: [u8; 8] = disc::$disc;
        })*
    };
}

program_accounts! {
    Batch => BATCH,
    ConfigTransaction => CONFIG_TRANSACTION,
    Multisig => MULTISIG,
    ProgramConfig => PROGRAM_CONFIG,
    Proposal => PROPOSAL,
    SpendingLimit => SPENDING_LIMIT,
    TransactionBuffer => TRANSACTION_BUFFER,
    VaultBatchTransaction => VAULT_BATCH_TRANSACTION,
    VaultTransaction => VAULT_TRANSACTION,
}

/// Decodes `data` as `T` after checking that `owner` is the program (default [`crate::ID`])
/// and that the data starts with `T`'s discriminator.
pub fn decode_checked<T: ProgramAccount>(
    address: &Address,
    owner: &Address,
    data: &[u8],
    program_id: Option<&Address>,
) -> CoreResult<T> {
    let expected = *program_id.unwrap_or(&crate::ID);
    match *owner == expected {
        true => T::try_from_account_data(address, data),
        false => Err(CoreError::WrongOwner {
            address: *address,
            owner: *owner,
            expected,
        }),
    }
}
