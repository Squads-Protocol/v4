use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;

use crate::errors::*;
use crate::events::*;
use crate::state::*;
use crate::utils::*;

#[derive(Accounts)]
pub struct TransactionExecute<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, multisig.create_key.as_ref(), SEED_MULTISIG],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Multisig>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            SEED_TRANSACTION
        ],
        bump = transaction.bump,
        constraint = transaction.status == TransactionStatus::ExecuteReady @ MultisigError::InvalidTransactionStatus,
        constraint = transaction.multisig == multisig.key() @ MultisigError::TransactionNotForMultisig
    )]
    pub transaction: Account<'info, MultisigTransaction>,

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

impl TransactionExecute<'_> {
    /// Execute the multisig transaction.
    /// The transaction must be `ExecuteReady`.
    pub fn transaction_execute(ctx: Context<Self>) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;

        let multisig_key = multisig.key();
        let transaction_key = transaction.key();

        let authority_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            &transaction.authority_index.to_le_bytes(),
            SEED_AUTHORITY,
            &[transaction.authority_bump],
        ];

        let authority_pubkey =
            Pubkey::create_program_address(authority_seeds, ctx.program_id).unwrap();

        let (additional_signer_keys, additional_signer_seeds): (Vec<_>, Vec<_>) = transaction
            .additional_signer_bumps
            .iter()
            .enumerate()
            .map(|(index, bump)| {
                let seeds = additional_signer_seeds_with_bump(
                    transaction_key,
                    u8::try_from(index).unwrap(),
                    *bump,
                );

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
            &authority_pubkey,
            &additional_signer_keys,
        )?;

        // Execute the transaction instructions one-by-one.
        for (ix, account_infos) in executable_message.to_instructions_and_accounts().iter() {
            // FIXME: Cleanup this seeds insanity.
            let signer_seeds = &additional_signer_seeds
                .iter()
                .map(|seeds| seeds.iter().map(Vec::as_slice).collect::<Vec<&[u8]>>())
                .collect::<Vec<Vec<&[u8]>>>();

            let mut signer_seeds_2 = signer_seeds
                .iter()
                .map(Vec::as_slice)
                .collect::<Vec<&[&[u8]]>>();

            // &mut &my_u8_array[..]

            signer_seeds_2.push(authority_seeds);

            // FIXME: Prevent reentrancy.
            invoke_signed(ix, account_infos, &signer_seeds_2)?;
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

fn additional_signer_seeds_with_bump(transaction_key: Pubkey, index: u8, bump: u8) -> Vec<Vec<u8>> {
    vec![
        SEED_PREFIX.to_vec(),
        transaction_key.to_bytes().to_vec(),
        index.to_le_bytes().to_vec(),
        SEED_ADDITIONAL_SIGNER.to_vec(),
        vec![bump],
    ]
}
