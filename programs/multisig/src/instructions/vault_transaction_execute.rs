use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::Discriminator;

use crate::errors::*;
use crate::events::*;
use crate::id;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
pub struct VaultTransactionExecute<'info> {
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Multisig>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &transaction.transaction_index.to_le_bytes(),
        ],
        bump = transaction.bump,
        constraint = transaction.multisig == multisig.key() @ MultisigError::TransactionNotForMultisig,
        constraint = transaction.status == TransactionStatus::ExecuteReady @ MultisigError::InvalidTransactionStatus,
        constraint = Clock::get()?.unix_timestamp - transaction.settled_at >= i64::from(multisig.time_lock) @ MultisigError::TimeLockNotReleased,
    )]
    pub transaction: Account<'info, VaultTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(member.key()).is_some() @ MultisigError::NotAMember,
        constraint = multisig.member_has_permission(member.key(), Permission::Execute) @ MultisigError::Unauthorized,
    )]
    pub member: Signer<'info>,
    // `remaining_accounts` must include the following accounts in the exact order:
    // 1. AddressLookupTable accounts in the order they appear in `message.address_table_lookups`.
    // 2. Accounts in the order they appear in `message.account_keys`.
    // 3. Accounts in the order they appear in `message.address_table_lookups`.
}

impl VaultTransactionExecute<'_> {
    /// Execute the multisig transaction.
    /// The transaction must be `ExecuteReady`.
    pub fn vault_transaction_execute(ctx: Context<Self>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;

        let multisig_key = multisig.key();
        let transaction_key = transaction.key();

        let vault_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            SEED_VAULT,
            &transaction.vault_index.to_le_bytes(),
            &[transaction.vault_bump],
        ];

        let vault_pubkey = Pubkey::create_program_address(vault_seeds, ctx.program_id).unwrap();

        let (additional_signer_keys, additional_signer_seeds): (Vec<_>, Vec<_>) = transaction
            .ephemeral_signer_bumps
            .iter()
            .enumerate()
            .map(|(index, bump)| {
                let seeds = vec![
                    SEED_PREFIX.to_vec(),
                    transaction_key.to_bytes().to_vec(),
                    SEED_EPHEMERAL_SIGNER.to_vec(),
                    u8::try_from(index).unwrap().to_le_bytes().to_vec(),
                    vec![*bump],
                ];

                (
                    Pubkey::create_program_address(
                        seeds
                            .iter()
                            .map(Vec::as_slice)
                            .collect::<Vec<&[u8]>>()
                            .as_slice(),
                        ctx.program_id,
                    )
                    .unwrap(),
                    seeds,
                )
            })
            .unzip();

        let transaction_message = &transaction.message;
        let num_lookups = transaction_message.address_table_lookups.len();
        let message_account_infos = ctx
            .remaining_accounts
            .get(num_lookups..)
            .ok_or(MultisigError::InvalidNumberOfAccounts)?;
        let address_lookup_table_account_infos = ctx
            .remaining_accounts
            .get(..num_lookups)
            .ok_or(MultisigError::InvalidNumberOfAccounts)?;

        let executable_message = ExecutableTransactionMessage::new_validated(
            transaction_message,
            message_account_infos,
            address_lookup_table_account_infos,
            &vault_pubkey,
            &additional_signer_keys,
        )?;

        // Execute the transaction instructions one-by-one.
        for (ix, account_infos) in executable_message.to_instructions_and_accounts().iter() {
            // Make sure we don't allow reentrancy of transaction_execute.
            if ix.program_id == id() {
                require!(
                    ix.data[..8] != crate::instruction::VaultTransactionExecute::DISCRIMINATOR,
                    MultisigError::ExecuteReentrancy
                )
            }

            // First round of type conversion; from Vec<Vec<Vec<u8>>> to Vec<Vec<&[u8]>>.
            let additional_signer_seeds = &additional_signer_seeds
                .iter()
                .map(|seeds| seeds.iter().map(Vec::as_slice).collect::<Vec<&[u8]>>())
                .collect::<Vec<Vec<&[u8]>>>();
            // Second round of type conversion; from Vec<Vec<&[u8]>> to Vec<&[&[u8]]>.
            let mut signer_seeds = additional_signer_seeds
                .iter()
                .map(Vec::as_slice)
                .collect::<Vec<&[&[u8]]>>();

            // Add the authority seeds.
            signer_seeds.push(vault_seeds);

            invoke_signed(ix, account_infos, &signer_seeds)?;
        }

        // Mark it as executed
        transaction.status = TransactionStatus::Executed;

        emit!(TransactionExecuted {
            multisig: multisig_key,
            transaction: transaction.key(),
        });

        Ok(())
    }
}
