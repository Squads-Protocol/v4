#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::*;
#[cfg(feature = "program")]
use crate::events::{
    self, BatchTransactionEvent, BatchTransactionEventKind, LogAuthority, MultisigEvent,
};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
#[cfg(feature = "program")]
use crate::state::*;
#[cfg(feature = "program")]
use crate::TransactionMessage;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
pub struct BatchAddTransactionArgs {
    /// Number of ephemeral signing PDAs required by the transaction.
    pub ephemeral_signers: u8,
    pub transaction_message: Vec<u8>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
#[instruction(args: BatchAddTransactionArgs)]
pub struct BatchAddTransaction<'info> {
    /// Multisig account this batch belongs to.
    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, multisig.create_key.as_ref()],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Multisig>,

    /// The proposal account associated with the batch.
    #[account(
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &batch.index.to_le_bytes(),
            SEED_PROPOSAL,
        ],
        bump = proposal.bump,
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &batch.index.to_le_bytes(),
        ],
        bump = batch.bump,
    )]
    pub batch: Account<'info, Batch>,

    /// `VaultBatchTransaction` account to initialize and add to the `batch`.
    #[account(
        init,
        payer = rent_payer,
        space = VaultBatchTransaction::size(args.ephemeral_signers, &args.transaction_message)?,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_TRANSACTION,
            &batch.index.to_le_bytes(),
            SEED_BATCH_TRANSACTION,
            &batch.size.checked_add(1).unwrap().to_le_bytes(),
        ],
        bump
    )]
    pub transaction: Account<'info, VaultBatchTransaction>,

    /// Member of the multisig.
    pub member: Signer<'info>,

    /// The payer for the batch transaction account rent.
    #[account(mut)]
    pub rent_payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[cfg(feature = "program")]
impl BatchAddTransaction<'_> {
    fn validate(&self) -> Result<()> {
        let Self {
            multisig,
            member,
            proposal,
            batch,
            ..
        } = self;

        // `member`
        require!(
            multisig.is_member(member.key()).is_some(),
            MultisigError::NotAMember
        );
        require!(
            multisig.member_has_permission(member.key(), Permission::Initiate),
            MultisigError::Unauthorized
        );
        // Only batch creator can add transactions to it.
        require!(member.key() == batch.creator, MultisigError::Unauthorized);

        // `proposal`
        require!(
            matches!(proposal.status, ProposalStatus::Draft { .. }),
            MultisigError::InvalidProposalStatus
        );

        // `batch` is validated by its seeds.

        Ok(())
    }

    /// Add a transaction to the batch.
    #[access_control(ctx.accounts.validate())]
    pub fn batch_add_transaction(ctx: Context<Self>, args: BatchAddTransactionArgs) -> Result<()> {
        let batch = &mut ctx.accounts.batch;
        let transaction = &mut ctx.accounts.transaction;

        let batch_key = batch.key();

        let transaction_message =
            TransactionMessage::deserialize(&mut args.transaction_message.as_slice())?;

        let ephemeral_signer_bumps: Vec<u8> = (0..args.ephemeral_signers)
            .map(|ephemeral_signer_index| {
                let ephemeral_signer_seeds = &[
                    SEED_PREFIX,
                    batch_key.as_ref(),
                    SEED_EPHEMERAL_SIGNER,
                    &ephemeral_signer_index.to_le_bytes(),
                ];

                let (_, bump) =
                    Pubkey::find_program_address(ephemeral_signer_seeds, ctx.program_id);

                bump
            })
            .collect();

        transaction.bump = ctx.bumps.transaction;
        transaction.ephemeral_signer_bumps = ephemeral_signer_bumps;
        transaction.message = transaction_message.try_into()?;

        // Increment the batch size.
        batch.size = batch.size.checked_add(1).expect("overflow");

        let batch = &ctx.accounts.batch;
        let transaction = &ctx.accounts.transaction;
        events::emit(
            events::enabled(ctx.remaining_accounts),
            || LogAuthority::multisig(&ctx.accounts.multisig),
            || {
                vec![MultisigEvent::BatchTransaction(BatchTransactionEvent {
                    kind: BatchTransactionEventKind::Add,
                    multisig: batch.multisig,
                    batch: batch.key(),
                    transaction: transaction.key(),
                    batch_index: batch.index,
                    transaction_index: batch.size,
                    member: Some(ctx.accounts.member.key()),
                    snapshot: Some(Cow::Borrowed(transaction)),
                })]
            },
        )
    }
}
