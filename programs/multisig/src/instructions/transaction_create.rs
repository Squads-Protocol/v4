use anchor_lang::prelude::*;

use crate::errors::*;
use crate::events::*;
use crate::state::*;
use crate::utils::*;

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct TransactionCreateArgs {
    authority_index: u8,
    transaction_message: Vec<u8>,
    memo: Option<String>,
}

#[derive(Accounts)]
#[instruction(args: TransactionCreateArgs)]
pub struct TransactionCreate<'info> {
    #[account(
        mut,
        seeds = [SEED_PREFIX, multisig.create_key.as_ref(), SEED_MULTISIG],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    #[account(
        init,
        payer = creator,
        space = MultisigTransaction::size(multisig.members.len(), &args.transaction_message)?,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
            SEED_TRANSACTION
        ],
        bump
    )]
    pub transaction: Account<'info, MultisigTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(creator.key()).is_some() @MultisigError::NotAMember,
        constraint = multisig.member_has_permission(creator.key(), Permission::Initiate) @MultisigError::Unauthorized,
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl TransactionCreate<'_> {
    /// Create a new multisig transaction.
    pub fn transaction_create(ctx: Context<Self>, args: TransactionCreateArgs) -> Result<()> {
        let multisig = &mut ctx.accounts.multisig;
        let transaction = &mut ctx.accounts.transaction;
        let creator = &mut ctx.accounts.creator;

        let transaction_message =
            TransactionMessage::deserialize(&mut args.transaction_message.as_slice())?;

        let multisig_key = multisig.key();

        let authority_seeds = &[
            SEED_PREFIX,
            multisig_key.as_ref(),
            &args.authority_index.to_le_bytes(),
            SEED_AUTHORITY,
        ];
        let (_, authority_bump) = Pubkey::find_program_address(authority_seeds, ctx.program_id);

        // Increment the transaction index.
        let transaction_index = multisig.transaction_index.checked_add(1).unwrap();

        // Initialize the transaction fields.
        transaction.creator = creator.key();
        transaction.multisig = multisig_key;
        transaction.transaction_index = transaction_index;
        transaction.authority_index = args.authority_index;
        transaction.authority_bump = authority_bump;
        transaction.status = TransactionStatus::Active;
        transaction.bump = *ctx.bumps.get("transaction").unwrap();
        transaction.approved = Vec::new();
        transaction.rejected = Vec::new();
        transaction.cancelled = Vec::new();
        transaction.message = transaction_message.try_into()?;

        // Updated last transaction index in the multisig account.
        multisig.transaction_index = transaction_index;

        emit!(TransactionCreatedEvent {
            multisig: multisig_key,
            transaction: transaction.key(),
            memo: args.memo,
        });

        Ok(())
    }
}

/// Unvalidated instruction data, must be treated as untrusted.
#[derive(AnchorDeserialize, Clone)]
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
#[derive(AnchorDeserialize, Clone)]
pub struct CompiledInstruction {
    pub program_id_index: u8,
    /// Indices into the tx's `account_keys` list indicating which accounts to pass to the instruction.
    pub account_indexes: SmallVec<u8, u8>,
    /// Instruction data.
    pub data: SmallVec<u16, u8>,
}

/// Address table lookups describe an on-chain address lookup table to use
/// for loading more readonly and writable accounts in a single tx.
#[derive(AnchorDeserialize, Clone)]
pub struct MessageAddressTableLookup {
    /// Address lookup table account key
    pub account_key: Pubkey,
    /// List of indexes used to load writable account addresses
    pub writable_indexes: SmallVec<u8, u8>,
    /// List of indexes used to load readonly account addresses
    pub readonly_indexes: SmallVec<u8, u8>,
}
