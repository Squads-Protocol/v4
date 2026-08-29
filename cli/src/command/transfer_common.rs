use std::str::FromStr;

use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::program_pack::Pack;
use solana_sdk::pubkey::Pubkey;
use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token::state::{Account as TokenAccount, Mint};
use spl_token_2022::extension::StateWithExtensions;
use spl_token_2022::state::Mint as Mint2022;
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;

fn unpack_mint_decimals(data: &[u8], token_program_id: &Pubkey) -> eyre::Result<u8> {
    if token_program_id == &spl_token::id() {
        Ok(Mint::unpack(data)?.decimals)
    } else {
        Ok(StateWithExtensions::<Mint2022>::unpack(data)?.base.decimals)
    }
}

/// Resolved recipient information for a token transfer.
pub(crate) struct ResolvedRecipient {
    /// The token account address to receive the transfer
    pub token_account: Pubkey,
    /// The wallet address that owns/controls the token account
    pub authority: Pubkey,
}

/// Resolves the recipient token account address for a token transfer.
pub(crate) async fn resolve_recipient_token_account(
    rpc_client: &RpcClient,
    recipient_pubkey: &Pubkey,
    token_mint: &Pubkey,
    token_program_id: &Pubkey,
) -> eyre::Result<ResolvedRecipient> {
    match rpc_client
        .get_account_with_commitment(recipient_pubkey, CommitmentConfig::confirmed())
        .await
        .map(|resp| resp.value)
    {
        Ok(Some(account_info)) => {
            if account_info.owner == *token_program_id {
                match TokenAccount::unpack(&account_info.data) {
                    Ok(token_account) => {
                        if token_account.mint == *token_mint {
                            Ok(ResolvedRecipient {
                                token_account: *recipient_pubkey,
                                authority: token_account.owner,
                            })
                        } else {
                            Err(eyre::eyre!(
                                "Recipient token account {} is for mint {}, but transfer is for mint {}",
                                recipient_pubkey,
                                token_account.mint,
                                token_mint
                            ))
                        }
                    }
                    Err(_) => Err(eyre::eyre!(
                        "Recipient account {} is owned by token program but failed to deserialize as a token account",
                        recipient_pubkey
                    )),
                }
            } else {
                Ok(ResolvedRecipient {
                    token_account: get_associated_token_address_with_program_id(
                        recipient_pubkey,
                        token_mint,
                        token_program_id,
                    ),
                    authority: *recipient_pubkey,
                })
            }
        }
        Ok(None) => Ok(ResolvedRecipient {
            token_account: get_associated_token_address_with_program_id(
                recipient_pubkey,
                token_mint,
                token_program_id,
            ),
            authority: *recipient_pubkey,
        }),
        Err(e) => Err(eyre::eyre!(
            "Failed to get account {}: {}",
            recipient_pubkey,
            e
        )),
    }
}

pub(crate) fn format_token_amount(amount: u64, decimals: u8) -> String {
    let amount_str = amount.to_string();
    let amount_len = amount_str.len();
    let decimals_usize = decimals as usize;

    if amount_len <= decimals_usize {
        let padded = format!("{:0>width$}", amount_str, width = decimals_usize);
        format!("0.{}", padded)
    } else {
        let integer_part = &amount_str[..amount_len - decimals_usize];
        let fractional_part = &amount_str[amount_len - decimals_usize..];
        let trimmed_fractional = fractional_part.trim_end_matches('0');
        if trimmed_fractional.is_empty() {
            integer_part.to_string()
        } else {
            format!("{}.{}", integer_part, trimmed_fractional)
        }
    }
}

pub(crate) async fn fetch_mint_decimals(
    rpc_client: &RpcClient,
    token_mint: &Pubkey,
    token_program_id: &Pubkey,
) -> eyre::Result<u8> {
    let mint_account = rpc_client
        .get_account(token_mint)
        .await
        .map_err(|e| eyre::eyre!("Failed to fetch mint account {}: {}", token_mint, e))?;

    if mint_account.owner != *token_program_id {
        return Err(eyre::eyre!(
            "Mint account {} is not owned by token program {}",
            token_mint,
            token_program_id
        ));
    }

    let decimals = unpack_mint_decimals(&mint_account.data, token_program_id)
        .map_err(|e| eyre::eyre!("Failed to deserialize mint account {}: {}", token_mint, e))?;
    Ok(decimals)
}

/// Decimals and SPL token program id inferred from the mint account (mint account owner).
pub(crate) async fn fetch_mint_decimals_and_token_program(
    rpc_client: &RpcClient,
    token_mint: &Pubkey,
) -> eyre::Result<(u8, Pubkey)> {
    let mint_account = rpc_client
        .get_account(token_mint)
        .await
        .map_err(|e| eyre::eyre!("Failed to fetch mint account {}: {}", token_mint, e))?;

    let token_program_id = mint_account.owner;

    let decimals = unpack_mint_decimals(&mint_account.data, &token_program_id)
        .map_err(|e| eyre::eyre!("Failed to deserialize mint account {}: {}", token_mint, e))?;
    Ok((decimals, token_program_id))
}

pub(crate) fn parse_pubkey(label: &str, s: &str) -> eyre::Result<Pubkey> {
    Pubkey::from_str(s).map_err(|_| eyre::eyre!("Invalid {} address: {}", label, s))
}
