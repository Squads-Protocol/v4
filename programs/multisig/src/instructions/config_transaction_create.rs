use anchor_lang::prelude::*;

use crate::errors::*;
use crate::events::*;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct ConfigTransactionCreateArgs {
    pub actions: Vec<ConfigAction>,
    pub memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: ConfigTransactionCreateArgs)]
pub struct ConfigTransactionCreate<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, multisig.create_key.as_ref(), SEED_MULTISIG],
        bump = multisig.bump,
        constraint = multisig.config_authority != Pubkey::default() @ MultisigError::NotSupportedForControlled,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = creator,
        space = ConfigTransaction::size(multisig.members.len(), args.actions.len()),
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction: Account<'info, ConfigTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(creator.key()).is_some() @ MultisigError::NotAMember,
        constraint = multisig.member_has_permission(creator.key(), Permission::Initiate) @ MultisigError::Unauthorized,
    )]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

impl ConfigTransactionCreate<'_> {
    /// Create a new config transaction.
    pub fn config_transaction_create(
        ctx: Context<Self>,
        args: ConfigTransactionCreateArgs,
    ) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let creator = &mut ctx.accounts.creator;

        let multisig_key = multisig.key();
        let transaction_key = transaction.key();

        // Increment the transaction index.
        let transaction_index = multisig.transaction_index.checked_add(1).unwrap();

        // Initialize the transaction fields.
        transaction.multisig = multisig_key;
        transaction.creator = creator.key();
        transaction.transaction_index = transaction_index;
        transaction.settled_at = 0;
        transaction.status = TransactionStatus::Active;
        transaction.bump = *ctx.bumps.get("transaction").unwrap();
        transaction.approved = Vec::new();
        transaction.rejected = Vec::new();
        transaction.cancelled = Vec::new();
        transaction.actions = args.actions;

        // Updated last transaction index in the multisig account.
        multisig.transaction_index = transaction_index;

        multisig.invariant()?;

        emit!(TransactionCreated {
            multisig: multisig_key,
            transaction: transaction_key,
            memo: args.memo,
        });

        Ok(())
    }
}
