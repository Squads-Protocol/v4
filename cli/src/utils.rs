use colored::Colorize;
use eyre::eyre;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_rpc_client_api::{
    client_error::ErrorKind as ClientErrorKind,
    request::{RpcError, RpcResponseErrorData},
    response::RpcSimulateTransactionResult,
};
use solana_sdk::transaction::VersionedTransaction;
use squads_multisig_4r::types::{Permissions, VaultTransactionMessage};

pub use crate::signer::signer_from_path;

/// A multisig member permission; the value is its bit in `Permissions::mask`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Permission {
    Initiate = 1 << 0,
    Vote = 1 << 1,
    Execute = 1 << 2,
}

pub fn has_permission(permissions: &Permissions, permission: Permission) -> bool {
    permissions.mask & permission as u8 != 0
}

pub fn is_signer_index(message: &VaultTransactionMessage, index: usize) -> bool {
    index < usize::from(message.num_signers)
}

pub fn is_static_writable_index(message: &VaultTransactionMessage, index: usize) -> bool {
    let num_signers = usize::from(message.num_signers);
    match index {
        i if i >= message.account_keys.len() => false,
        i if i < usize::from(message.num_writable_signers) => true,
        i if i >= num_signers => i - num_signers < usize::from(message.num_writable_non_signers),
        _ => false,
    }
}

pub async fn send_and_confirm_transaction(
    transaction: &VersionedTransaction,
    rpc_client: &RpcClient,
) -> eyre::Result<String> {
    // Try to send and confirm the transaction
    match rpc_client.send_and_confirm_transaction(transaction).await {
        Ok(signature) => {
            println!(
                "Transaction confirmed: {}\n\n",
                signature.to_string().green()
            );
            Ok(signature.to_string())
        }
        Err(err) => {
            if let ClientErrorKind::RpcError(RpcError::RpcResponseError {
                data:
                    RpcResponseErrorData::SendTransactionPreflightFailure(
                        RpcSimulateTransactionResult {
                            logs: Some(logs), ..
                        },
                    ),
                ..
            }) = err.kind.as_ref()
            {
                println!("Simulation logs:\n\n{}\n", logs.join("\n").yellow());
            }

            Err(eyre!("Transaction failed: {}", err.to_string().red()))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn message(
        num_signers: u8,
        writable_signers: u8,
        writable_non_signers: u8,
    ) -> VaultTransactionMessage {
        VaultTransactionMessage {
            num_signers,
            num_writable_signers: writable_signers,
            num_writable_non_signers: writable_non_signers,
            account_keys: (0..5)
                .map(|_| solana_sdk::pubkey::Pubkey::new_unique())
                .collect(),
            instructions: vec![],
            address_table_lookups: vec![],
        }
    }

    #[test]
    fn classifies_static_account_indexes() {
        let message = message(2, 1, 2);

        let flags: Vec<_> = (0..6)
            .map(|i| {
                (
                    is_signer_index(&message, i),
                    is_static_writable_index(&message, i),
                )
            })
            .collect();

        assert_eq!(
            flags,
            [
                (true, true),
                (true, false),
                (false, true),
                (false, true),
                (false, false),
                (false, false)
            ]
        );
    }

    #[test]
    fn checks_permission_bits() {
        let voter = Permissions { mask: 0b010 };

        assert!(has_permission(&voter, Permission::Vote));
        assert!(!has_permission(&voter, Permission::Initiate));
        assert!(!has_permission(&voter, Permission::Execute));
    }
}
