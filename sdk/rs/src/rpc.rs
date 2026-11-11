//! Async account fetches that check the owner (default: the mainnet program ID) and the
//! discriminator before decoding, so a v4 (`SQDS4…`) account or a look-alike is rejected.

use solana_account::Account;
use solana_address::Address;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use squads_multisig_4r_program::account::ProgramAccount;
use squads_multisig_4r_program::state::{Multisig, SpendingLimit, VaultTransaction};

use crate::error::ClientResult;

/// Decodes `account` as `T` after checking its owner and discriminator.
pub fn decode_checked<T: ProgramAccount>(
    address: &Address,
    account: &Account,
    program_id: Option<&Address>,
) -> ClientResult<T> {
    Ok(squads_multisig_4r_program::account::decode_checked(
        address,
        &account.owner,
        &account.data,
        program_id,
    )?)
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
