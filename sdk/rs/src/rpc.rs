//! Owner- and discriminator-checked account fetches. The generated `fetch_*` functions
//! check neither, so a v4 (`SQDS4…`) account or a look-alike would decode without error.

use solana_account::Account;
use solana_address::Address;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;

use crate::accounts::*;
use crate::error::{ClientError, ClientResult};
use crate::ID;

/// An account type of this program, identified by its Anchor discriminator.
pub trait ProgramAccount: Sized {
    const DISCRIMINATOR: [u8; 8];
    fn decode(data: &[u8]) -> std::io::Result<Self>;
}

macro_rules! program_accounts {
    ($($ty:ident => $disc:ident),* $(,)?) => {
        $(impl ProgramAccount for $ty {
            const DISCRIMINATOR: [u8; 8] = $disc;
            fn decode(data: &[u8]) -> std::io::Result<Self> { $ty::from_bytes(data) }
        })*
    };
}

program_accounts!(
    Batch => BATCH_DISCRIMINATOR,
    ConfigTransaction => CONFIG_TRANSACTION_DISCRIMINATOR,
    Multisig => MULTISIG_DISCRIMINATOR,
    ProgramConfig => PROGRAM_CONFIG_DISCRIMINATOR,
    Proposal => PROPOSAL_DISCRIMINATOR,
    SpendingLimit => SPENDING_LIMIT_DISCRIMINATOR,
    TransactionBuffer => TRANSACTION_BUFFER_DISCRIMINATOR,
    VaultBatchTransaction => VAULT_BATCH_TRANSACTION_DISCRIMINATOR,
    VaultTransaction => VAULT_TRANSACTION_DISCRIMINATOR,
);

/// Decodes `account` as `T` after checking the owner (default: the mainnet program ID)
/// and the discriminator.
pub fn decode_checked<T: ProgramAccount>(
    address: &Address,
    account: &Account,
    program_id: Option<&Address>,
) -> ClientResult<T> {
    let expected = *program_id.unwrap_or(&ID);
    if account.owner != expected {
        return Err(ClientError::WrongOwner {
            address: *address,
            owner: account.owner,
            expected,
        });
    }
    if account.data.get(..8) != Some(&T::DISCRIMINATOR[..]) {
        return Err(ClientError::WrongDiscriminator(*address));
    }
    T::decode(&account.data).map_err(|_| ClientError::Deserialization(*address))
}

pub async fn fetch<T: ProgramAccount>(
    rpc: &RpcClient,
    address: &Address,
    program_id: Option<&Address>,
) -> ClientResult<T> {
    let account = rpc.get_account(address).await?;
    decode_checked(address, &account, program_id)
}

pub async fn fetch_multisig(
    rpc: &RpcClient,
    address: &Address,
    program_id: Option<&Address>,
) -> ClientResult<Multisig> {
    fetch(rpc, address, program_id).await
}

pub async fn fetch_spending_limit(
    rpc: &RpcClient,
    address: &Address,
    program_id: Option<&Address>,
) -> ClientResult<SpendingLimit> {
    fetch(rpc, address, program_id).await
}

pub async fn fetch_vault_transaction(
    rpc: &RpcClient,
    address: &Address,
    program_id: Option<&Address>,
) -> ClientResult<VaultTransaction> {
    fetch(rpc, address, program_id).await
}
