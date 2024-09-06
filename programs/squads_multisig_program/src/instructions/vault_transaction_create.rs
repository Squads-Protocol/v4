use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::*;
use crate::state::*;
use crate::utils::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct VaultTransactionCreateArgs {
    /// Index of the vault this transaction belongs to.
    pub vault_index: u8,
    /// Number of ephemeral signing PDAs required by the transaction.
    pub ephemeral_signers: u8,
    pub transaction_message: Vec<u8>,
    pub memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: VaultTransactionCreateArgs)]
pub struct VaultTransactionCreate<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = rent_payer,
        space = VaultTransaction::size(args.ephemeral_signers, &args.transaction_message)?,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction: Account<'info, VaultTransaction>,

    /// The member of the multisig that is creating the transaction.
    pub creator: Signer<'info>,

    /// The payer for the transaction account rent.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> VaultTransactionCreate<'info> {
    pub fn validate(&self) -> Result<()> {
        let Self {
            multisig, creator, ..
        } = self;

        // creator
        require!(
            multisig.is_member(creator.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            multisig.member_has_permission(creator.key(), Permission::Initiate),
            MultisigError::Unauthorized
        );

        Ok(())
    }

    /// Create a new vault transaction.
    #[access_control(ctx.accounts.validate())]
    pub fn vault_transaction_create(
        ctx: Context<Self>,
        args: VaultTransactionCreateArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let creator = &mut ctx.accounts.creator;

        let transaction_message =
            TransactionMessage::deserialize(&mut args.transaction_message.as_slice())?;

        let multisig_key = multisig.key();
        let transaction_key = transaction.key();

        let vault_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            SEED_VAULT,
            &args.vault_index.to_le_bytes(),
        ];
        let (_, vault_bump) = Pubkey::find_program_address(vault_seeds, ctx.program_id);

        let ephemeral_signer_bumps: Vec<u8> = (0..args.ephemeral_signers)
            .map(|ephemeral_signer_index| {
                let ephemeral_signer_seeds = &[
                    SEED_PREFIX,
                    transaction_key.as_ref(),
                    SEED_EPHEMERAL_SIGNER,
                    &ephemeral_signer_index.to_le_bytes(),
                ];

                let (_, bump) =
                    Pubkey::find_program_address(ephemeral_signer_seeds, ctx.program_id);
                bump
            })
            .collect();

        // Increment the transaction index.
        let transaction_index = multisig.transaction_index.checked_add(1).unwrap();

        // Initialize the transaction fields.
        transaction.multisig = multisig_key;
        transaction.creator = creator.key();
        transaction.index = transaction_index;
        transaction.bump = ctx.bumps.transaction;
        transaction.vault_index = args.vault_index;
        transaction.vault_bump = vault_bump;
        transaction.ephemeral_signer_bumps = ephemeral_signer_bumps;
        transaction.message = transaction_message.try_into()?;

        // Updated last transaction index in the multisig account.
        multisig.transaction_index = transaction_index;

        multisig.invariant()?;

        // Logs for indexing.
        msg!("transaction index: {}", transaction_index);

        Ok(())
    }

    pub fn validate_transaction_buffer(
        ctx: &Context<Self>,
        transaction_buffer_account: &Account<'info, TransactionBuffer>,
        transaction_buffer_info: &AccountInfo<'info>,
    ) -> Result<()> {
        // Check that the buffer creator is the same as the transaction creator
        require_keys_eq!(
            transaction_buffer_account.creator,
            ctx.accounts.creator.key(),
            MultisigError::InvalidAccount
        );

        // Check that the buffer is writable
        require!(
            transaction_buffer_info.is_writable,
            MultisigError::InvalidAccount
        );
        // Validate that the final hash matches the buffer
        transaction_buffer_account.validate_hash()?;

        // Validate that the final size is correct
        transaction_buffer_account.validate_size()?;

        Ok(())
    }
    pub fn vault_transaction_create_from_buffer(
        ctx: Context<'_, '_, 'info, 'info, Self>,
        args: VaultTransactionCreateArgs,
    ) -> Result<()> {
        // Mutable Accounts
        let multisig = &ctx.accounts.multisig;
        let vault_transaction_account = &mut ctx.accounts.transaction;
        let vault_transaction_account_info = vault_transaction_account.to_account_info();
        let rent_payer = &ctx.accounts.rent_payer;

        // Readonly Accounts
        let remaining_accounts = ctx.remaining_accounts;
        // Determine valid buffer account address
        let (transaction_buffer_address, _) = Pubkey::find_program_address(
            &[
                SEED_PREFIX,
                multisig.key().as_ref(),
                SEED_TRANSACTION_BUFFER,
                &multisig
                    .transaction_index
                    .checked_add(1)
                    .unwrap()
                    .to_le_bytes(),
            ],
            ctx.program_id,
        );

        // Find the buffer account in remaining accounts
        let transaction_buffer_info = remaining_accounts
            .iter()
            .find(|acc| acc.key == &transaction_buffer_address)
            .ok_or(MultisigError::MissingAccount)?;

        let transaction_buffer_account: Account<'info, TransactionBuffer> =
            Account::<TransactionBuffer>::try_from(transaction_buffer_info)?;

        // Validate the Transaction Buffer
        VaultTransactionCreate::validate_transaction_buffer(
            &ctx,
            &transaction_buffer_account,
            &transaction_buffer_info,
        )?;

        // Check that the transaction message is "empty"
        require!(
            args.transaction_message == vec![0, 0, 0, 0, 0, 0],
            MultisigError::InvalidInstructionArgs
        );

        // Close the buffer account
        transaction_buffer_account.close(ctx.accounts.creator.to_account_info())?;

        // Calculate the new required length of the vault transaction account
        let new_len = VaultTransaction::size(
            args.ephemeral_signers,
            transaction_buffer_account.buffer.as_slice(),
        )?;

        // Calculate the rent exemption
        let rent_exempt_lamports = Rent::get().unwrap().minimum_balance(new_len).max(1);

        // Check the difference between the rent exemption and the current lamports
        let top_up_lamports =
            rent_exempt_lamports.saturating_sub(vault_transaction_account_info.lamports());

        // Top up the rent payer account with the difference
        **rent_payer.try_borrow_mut_lamports()? -= top_up_lamports;
        **vault_transaction_account_info.try_borrow_mut_lamports()? += top_up_lamports;

        // Reallocate the vault transaction account to the new length of the transaction message
        AccountInfo::realloc(&vault_transaction_account_info, new_len, true)?;

        // Build the args to overwrite the blank vault transaction account
        let create_args = VaultTransactionCreateArgs {
            vault_index: transaction_buffer_account.vault_index,
            ephemeral_signers: args.ephemeral_signers,
            transaction_message: transaction_buffer_account.buffer.clone(),
            memo: None,
        };
        // Populate the vault Transaction with the new args
        Self::vault_transaction_create(ctx, create_args)?;

        Ok(())
    }
}

/// Unvalidated instruction data, must be treated as untrusted.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TransactionMessage {
    /// The number of signer pubkeys in the account_keys vec.
    pub num_signers: u8,
    /// The number of writable signer pubkeys in the account_keys vec.
    pub num_writable_signers: u8,
    /// The number of writable non-signer pubkeys in the account_keys vec.
    pub num_writable_non_signers: u8,
    /// The list of unique account public keys (including program IDs) that will be used in the provided instructions.
    pub account_keys: SmallVec<u8, Pubkey>,
    /// The list of instructions to execute.
    pub instructions: SmallVec<u8, CompiledInstruction>,
    /// List of address table lookups used to load additional accounts
    /// for this transaction.
    pub address_table_lookups: SmallVec<u8, MessageAddressTableLookup>,
}

// Concise serialization schema for instructions that make up transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct CompiledInstruction {
    pub program_id_index: u8,
    /// Indices into the tx's `account_keys` list indicating which accounts to pass to the instruction.
    pub account_indexes: SmallVec<u8, u8>,
    /// Instruction data.
    pub data: SmallVec<u16, u8>,
}

/// Address table lookups describe an on-chain address lookup table to use
/// for loading more readonly and writable accounts in a single tx.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct MessageAddressTableLookup {
    /// Address lookup table account key
    pub account_key: Pubkey,
    /// List of indexes used to load writable account addresses
    pub writable_indexes: SmallVec<u8, u8>,
    /// List of indexes used to load readonly account addresses
    pub readonly_indexes: SmallVec<u8, u8>,
}
