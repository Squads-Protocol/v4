use std::str::FromStr;
use std::time::Duration;

use clap::Args;
use colored::Colorize;
use dialoguer::Confirm;
use indicatif::ProgressBar;
use solana_sdk::commitment_config::CommitmentConfig;
use solana_sdk::compute_budget::ComputeBudgetInstruction;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::VersionedMessage;
use solana_sdk::program_pack::Pack;
use solana_sdk::pubkey::Pubkey;
use solana_sdk::transaction::VersionedTransaction;

use spl_associated_token_account::get_associated_token_address_with_program_id;
use spl_token::instruction::transfer;
use spl_token::state::{Account as TokenAccount, Mint};
use squads_multisig::anchor_lang::{AnchorSerialize, InstructionData};
use squads_multisig::client::get_multisig;
use squads_multisig::pda::{get_proposal_pda, get_transaction_pda, get_vault_pda};
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;
use squads_multisig::solana_rpc_client_api::request::RpcError;
use squads_multisig::squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
use squads_multisig::squads_multisig_program::accounts::VaultTransactionCreate as VaultTransactionCreateAccounts;
use squads_multisig::squads_multisig_program::anchor_lang::ToAccountMetas;
use squads_multisig::squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
use squads_multisig::squads_multisig_program::instruction::VaultTransactionCreate as VaultTransactionCreateData;
use squads_multisig::squads_multisig_program::ProposalCreateArgs;
use squads_multisig::squads_multisig_program::TransactionMessage;
use squads_multisig::squads_multisig_program::VaultTransactionCreateArgs;
use squads_multisig::vault_transaction::VaultTransactionMessageExt;

use crate::utils::{create_signer_from_path, send_and_confirm_transaction};

#[derive(Args)]
pub struct InitiateTransfer {
    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Token program ID. Defaults to regular SPL.
    #[arg(long)]
    token_program_id: Option<String>,

    /// Token Mint Address.
    #[arg(long)]
    token_mint_address: String,

    #[arg(long)]
    token_amount_u64: u64,

    /// The recipient wallet address or token account address. If a wallet address is provided,
    /// the associated token account (ATA) will be derived automatically. If a token account address
    /// is provided, it will be validated to ensure it's for the correct mint.
    #[arg(long)]
    recipient: String,

    /// Path to the Program Config Initializer Keypair
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    /// The multisig where the transaction has been proposed
    #[arg(long)]
    multisig_pubkey: String,

    #[arg(long)]
    vault_index: u8,

    /// Memo to be included in the transaction
    #[arg(long)]
    memo: Option<String>,

    #[arg(long)]
    priority_fee_lamports: Option<u64>,
}

impl InitiateTransfer {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            rpc_url,
            program_id,
            token_program_id,
            keypair,
            fee_payer_keypair,
            multisig_pubkey,
            memo,
            vault_index,
            priority_fee_lamports,
            token_amount_u64,
            token_mint_address,
            recipient,
        } = self;

        let program_id =
            program_id.unwrap_or_else(|| "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string());

        let token_program_id = token_program_id
            .unwrap_or_else(|| "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA".to_string());

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");
        let token_program_id = Pubkey::from_str(&token_program_id).expect("Invalid program ID");

        let transaction_creator_keypair = create_signer_from_path(keypair).unwrap();
        let transaction_creator = transaction_creator_keypair.pubkey();
        let fee_payer_keypair =
            fee_payer_keypair.map(|path| create_signer_from_path(path).unwrap());
        let fee_payer = fee_payer_keypair.as_ref().map(|kp| kp.pubkey());

        let rpc_url = rpc_url.unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let rpc_url_clone = rpc_url.clone();
        let rpc_client = &RpcClient::new(rpc_url);

        let multisig = Pubkey::from_str(&multisig_pubkey).expect("Invalid multisig address");

        let recipient_pubkey = Pubkey::from_str(&recipient).expect("Invalid recipient address");

        let token_mint = Pubkey::from_str(&token_mint_address).expect("Invalid Token Mint Address");

        // Fetch mint account to get decimals
        let mint_account = rpc_client
            .get_account(&token_mint)
            .await
            .map_err(|e| eyre::eyre!("Failed to fetch mint account {}: {}", token_mint, e))?;

        if mint_account.owner != token_program_id {
            return Err(eyre::eyre!(
                "Mint account {} is not owned by token program {}",
                token_mint,
                token_program_id
            ));
        }

        let mint = Mint::unpack(&mint_account.data)
            .map_err(|e| eyre::eyre!("Failed to deserialize mint account {}: {}", token_mint, e))?;
        let decimals = mint.decimals;

        let resolved_recipient = resolve_recipient_token_account(
            rpc_client,
            &recipient_pubkey,
            &token_mint,
            &token_program_id,
        )
        .await?;
        let recipient_ata = resolved_recipient.token_account;

        let multisig_data = get_multisig(rpc_client, &multisig).await?;

        let transaction_index = multisig_data.transaction_index + 1;

        let transaction_pda = get_transaction_pda(&multisig, transaction_index, Some(&program_id));
        let proposal_pda = get_proposal_pda(&multisig, transaction_index, Some(&program_id));
        println!();
        println!(
            "{}",
            "👀 You're about to create a vault transaction, please review the details:".yellow()
        );
        println!();
        println!("RPC Cluster URL:   {}", rpc_url_clone);
        println!("Program ID:        {}", program_id);
        println!("Your Public Key:       {}", transaction_creator);
        println!();
        println!("⚙️ Config Parameters");
        println!("Multisig Key:       {}", multisig_pubkey);
        println!("Transaction Index:       {}", transaction_index);
        println!("Vault Index:       {}", vault_index);
        println!();

        println!("Recipient:       {}", resolved_recipient.authority);
        println!("Recipient Token Account:       {}", recipient_ata);
        println!(
            "Transfer Amount:       {}",
            format_token_amount(token_amount_u64, decimals)
        );

        let proceed = Confirm::new()
            .with_prompt("Do you want to proceed?")
            .default(false)
            .interact()?;
        if !proceed {
            println!("OK, aborting.");
            return Ok(());
        }
        println!();

        let progress = ProgressBar::new_spinner().with_message("Sending transaction...");
        progress.enable_steady_tick(Duration::from_millis(100));

        let blockhash = rpc_client
            .get_latest_blockhash()
            .await
            .expect("Failed to get blockhash");

        let vault_pda = get_vault_pda(&multisig, vault_index, Some(&program_id));

        let sender_ata = get_associated_token_address_with_program_id(
            &vault_pda.0,
            &token_mint,
            &token_program_id,
        );

        let transfer_message = TransactionMessage::try_compile(
            &vault_pda.0,
            &[transfer(
                &token_program_id,
                &sender_ata,
                &recipient_ata,
                &vault_pda.0,
                &[&vault_pda.0],
                token_amount_u64,
            )
            .unwrap()],
            &[],
        )
        .unwrap();

        let payer = fee_payer.unwrap_or(transaction_creator);
        let message = Message::try_compile(
            &payer,
            &[
                ComputeBudgetInstruction::set_compute_unit_price(
                    priority_fee_lamports.unwrap_or(200_000),
                ),
                Instruction {
                    accounts: VaultTransactionCreateAccounts {
                        creator: transaction_creator,
                        rent_payer: fee_payer.unwrap_or(transaction_creator),
                        transaction: transaction_pda.0,
                        multisig,
                        system_program: solana_sdk::system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: VaultTransactionCreateData {
                        args: VaultTransactionCreateArgs {
                            ephemeral_signers: 0,
                            vault_index,
                            memo,
                            transaction_message: transfer_message.try_to_vec().unwrap(),
                        },
                    }
                    .data(),
                    program_id,
                },
                Instruction {
                    accounts: ProposalCreateAccounts {
                        creator: transaction_creator,
                        rent_payer: fee_payer.unwrap_or(transaction_creator),
                        proposal: proposal_pda.0,
                        multisig,
                        system_program: solana_sdk::system_program::id(),
                    }
                    .to_account_metas(Some(false)),
                    data: ProposalCreateData {
                        args: ProposalCreateArgs {
                            draft: false,
                            transaction_index,
                        },
                    }
                    .data(),
                    program_id,
                },
            ],
            &[],
            blockhash,
        )
        .unwrap();

        let mut signers = vec![&*transaction_creator_keypair];
        if let Some(ref fee_payer_kp) = fee_payer_keypair {
            signers.push(&**fee_payer_kp);
        }

        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), &signers)
            .expect("Failed to create transaction");

        let signature = send_and_confirm_transaction(&transaction, &rpc_client).await?;

        println!(
            "✅ Transaction created successfully. Signature: {}",
            signature.green()
        );
        Ok(())
    }
}

/// Formats a token amount with decimals without using floating-point arithmetic.
///
/// This function converts a raw token amount (as u64) to a human-readable string
/// with the appropriate decimal point placement based on the token's decimals.
///
/// # Arguments
///
/// * `amount` - The raw token amount as u64 (e.g., 1000000 for 1 token with 6 decimals)
/// * `decimals` - The number of decimal places for the token (typically 6, 8, or 9)
///
/// # Returns
///
/// Returns a formatted string with the decimal point correctly placed.
/// Examples:
/// - format_token_amount(1000000, 6) -> "1.000000"
/// - format_token_amount(123456789, 9) -> "0.123456789"
/// - format_token_amount(100, 6) -> "0.000100"
fn format_token_amount(amount: u64, decimals: u8) -> String {
    let amount_str = amount.to_string();
    let amount_len = amount_str.len();
    let decimals_usize = decimals as usize;

    if amount_len <= decimals_usize {
        // Amount is smaller than one unit, pad with zeros
        let padded = format!("{:0>width$}", amount_str, width = decimals_usize);
        format!("0.{}", padded)
    } else {
        // Amount is >= 1 unit, insert decimal point
        let integer_part = &amount_str[..amount_len - decimals_usize];
        let fractional_part = &amount_str[amount_len - decimals_usize..];
        // Trim trailing zeros from fractional part
        let trimmed_fractional = fractional_part.trim_end_matches('0');
        if trimmed_fractional.is_empty() {
            integer_part.to_string()
        } else {
            format!("{}.{}", integer_part, trimmed_fractional)
        }
    }
}

/// Resolved recipient information for a token transfer.
struct ResolvedRecipient {
    /// The token account address to receive the transfer
    token_account: Pubkey,
    /// The wallet address that owns/controls the token account
    authority: Pubkey,
}

/// Resolves the recipient token account address for a token transfer.
///
/// This function determines the appropriate token account to use as the recipient:
/// - If the provided `recipient_pubkey` is already a valid token account for the specified `token_mint`,
///   it returns that address directly.
/// - If `recipient_pubkey` is a token account for a different mint, it returns an error.
/// - If `recipient_pubkey` is not owned by the token program it derives and returns the associated
///   token address (ATA) for the recipient and mint.
///
/// # Arguments
///
/// * `rpc_client` - The RPC client used to query account information
/// * `recipient_pubkey` - The recipient's wallet address (may be a token account or wallet address)
/// * `token_mint` - The token mint address for the transfer
/// * `token_program_id` - The token program ID (e.g., SPL Token or Token-2022)
///
/// # Returns
///
/// Returns `Ok(ResolvedRecipient)` containing the recipient token account address and authority, or an error if:
/// - The recipient account is a token account for a different mint
/// - The recipient account is owned by the token program but fails to deserialize as a token account
async fn resolve_recipient_token_account(
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
            // Check if the account is owned by the token program
            if account_info.owner == *token_program_id {
                // Try to deserialize as a token account to validate it's for the correct mint
                match TokenAccount::unpack(&account_info.data) {
                    Ok(token_account) => {
                        // Verify the token account is for the correct mint
                        if token_account.mint == *token_mint {
                            // It's a valid token account for the correct mint, use it directly
                            Ok(ResolvedRecipient {
                                token_account: *recipient_pubkey,
                                authority: token_account.owner,
                            })
                        } else {
                            // Token account exists but for a different mint, return error
                            Err(eyre::eyre!(
                                "Recipient token account {} is for mint {}, but transfer is for mint {}",
                                recipient_pubkey,
                                token_account.mint,
                                token_mint
                            ))
                        }
                    }
                    Err(_) => {
                        // Failed to deserialize as token account, return error
                        Err(eyre::eyre!(
                            "Recipient account {} is owned by token program but failed to deserialize as a token account",
                            recipient_pubkey
                        ))
                    }
                }
            } else {
                // Not a token account, derive the ATA
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
        Ok(None) => {
            // Account doesn't exist, derive the ATA
            Ok(ResolvedRecipient {
                token_account: get_associated_token_address_with_program_id(
                    recipient_pubkey,
                    token_mint,
                    token_program_id,
                ),
                authority: *recipient_pubkey,
            })
        }

        Err(e) => Err(eyre::eyre!(
            "Failed to get account {}: {}",
            recipient_pubkey,
            e
        )),
    }
}
