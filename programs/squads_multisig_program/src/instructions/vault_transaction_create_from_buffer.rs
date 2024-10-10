use crate::errors::*;
use crate::instructions::*;
use crate::state::*;
use anchor_lang::{prelude::*, system_program};

#[derive(Accounts)]
pub struct VaultTransactionCreateFromBuffer<'info> {
    // The context needed for the VaultTransactionCreate instruction
    pub vault_transaction_create: VaultTransactionCreate<'info>,

    #[account(
        mut,
        close = creator,
        // Only the creator can turn the buffer into a transaction and reclaim
        // the rent
        constraint = transaction_buffer.creator == creator.key() @ MultisigError::Unauthorized,
        seeds = [
            SEED_PREFIX,
            vault_transaction_create.multisig.key().as_ref(),
            SEED_TRANSACTION_BUFFER,
            creator.key().as_ref(),
            &transaction_buffer.buffer_index.to_le_bytes(),
        ],
        bump
    )]
    pub transaction_buffer: Box<Account<'info, TransactionBuffer>>,

    // Anchor doesn't allow us to use the creator inside of
    // vault_transaction_create, so we just re-pass it here with the same constraint
    #[account(
        mut,
        address = vault_transaction_create.creator.key(),
    )]
    pub creator: Signer<'info>,
}

impl<'info> VaultTransactionCreateFromBuffer<'info> {
    pub fn validate(&self, args: &VaultTransactionCreateArgs) -> Result<()> {
        let transaction_buffer_account = &self.transaction_buffer;

        // Check that the transaction message is "empty"
        require!(
            args.transaction_message == vec![0, 0, 0, 0, 0, 0],
            MultisigError::InvalidInstructionArgs
        );

        // Validate that the final hash matches the buffer
        transaction_buffer_account.validate_hash()?;

        // Validate that the final size is correct
        transaction_buffer_account.validate_size()?;
        Ok(())
    }
    /// Create a new vault transaction from a completed transaction buffer account.
    #[access_control(ctx.accounts.validate(&args))]
    pub fn vault_transaction_create_from_buffer(
        ctx: Context<'_, '_, 'info, 'info, Self>,
        args: VaultTransactionCreateArgs,
    ) -> Result<()> {
        // Account infos necessary for reallocation
        let vault_transaction_account_info = &ctx
            .accounts
            .vault_transaction_create
            .transaction
            .to_account_info();
        let rent_payer_account_info = &ctx
            .accounts
            .vault_transaction_create
            .rent_payer
            .to_account_info();

        let system_program = &ctx.accounts.vault_transaction_create.system_program.to_account_info();

        // Read-only accounts
        let transaction_buffer = &ctx.accounts.transaction_buffer;

        // Calculate the new required length of the vault transaction account,
        // since it was initialized with an empty transaction message
        let new_len =
            VaultTransaction::size(args.ephemeral_signers, transaction_buffer.buffer.as_slice())?;

        // Calculate the rent exemption for new length
        let rent_exempt_lamports = Rent::get().unwrap().minimum_balance(new_len).max(1);

        // Check the difference between the rent exemption and the current lamports
        let top_up_lamports =
            rent_exempt_lamports.saturating_sub(vault_transaction_account_info.lamports());

        // System Transfer the remaining difference to the vault transaction account
        let transfer_context = CpiContext::new(
            system_program.to_account_info(),
            system_program::Transfer {
                from: rent_payer_account_info.clone(),
                to: vault_transaction_account_info.clone(),
            },
        );
        system_program::transfer(transfer_context, top_up_lamports)?;

        // Reallocate the vault transaction account to the new length of the
        // actual transaction message
        AccountInfo::realloc(&vault_transaction_account_info, new_len, true)?;

        // Create the args for the vault transaction create instruction
        let create_args = VaultTransactionCreateArgs {
            vault_index: args.vault_index,
            ephemeral_signers: args.ephemeral_signers,
            transaction_message: transaction_buffer.buffer.clone(),
            memo: args.memo,
        };
        // Create the context for the vault transaction create instruction
        let context = Context::new(
            ctx.program_id,
            &mut ctx.accounts.vault_transaction_create,
            ctx.remaining_accounts,
            ctx.bumps.vault_transaction_create,
        );

        // Call the vault transaction create instruction
        VaultTransactionCreate::vault_transaction_create(context, create_args)?;

        Ok(())
    }
}
