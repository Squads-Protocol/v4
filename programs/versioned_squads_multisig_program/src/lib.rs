#![allow(clippy::result_large_err)]
#![deny(arithmetic_overflow)]
#![deny(unused_must_use)]

use anchor_lang::prelude::*;

declare_id!("wegmivK2TiR2dbNxMAtR48Y2tVq2hGzp6iK8j3FbUU7"); // Replace with actual program ID
pub use anchor_lang;
pub use instructions::ProgramConfig;
pub use instructions::*;
pub use state::*;
pub use utils::SmallVec;

pub mod allocator;
pub mod errors;
pub mod instructions;
pub mod state;
mod utils;


#[program]
pub mod versioned_squads_multisig_program {

    use super::*;

    /// Initialize the program config.
    pub fn program_config_init(
        ctx: Context<ProgramConfigInit>,
        args: ProgramConfigInitArgs,
    ) -> Result<()> {
        ProgramConfigInit::program_config_init(ctx, args)
    }

    /// Create a new versioned multisig
    pub fn create_versioned_multisig(
        ctx: Context<VersionedMultisigCreateV2>,
        args: VersionedMultisigCreateArgsV2
    ) -> Result<()> {
        VersionedMultisigCreateV2::versioned_multisig_create(ctx, args)
    }

    /// Create a new proposal
    pub fn create_versioned_proposal(
        ctx: Context<CreateVersionedProposal>,
        args: VersionedProposalCreateArgs
    ) -> Result<()> {
        versioned_proposal_create::handler(ctx, args)
    }

    /// Vote on a proposal
    pub fn vote_on_versioned_proposal(
        ctx: Context<VoteOnVersionedProposal>,
        approve: bool,
    ) -> Result<()> {
        versioned_proposal_vote::handler(ctx, approve)
    }

    pub fn add_member(
        ctx: Context<VersionedMultisigConfig>,
        args: VersionedMultisigAddMemberArgs
    ) -> Result<()> {
        VersionedMultisigConfig::versioned_multisig_add_member(ctx, args)
    }

    pub fn remove_member(
        ctx: Context<VersionedMultisigConfig>,
        args: VersionedMultisigRemoveMemberArgs
    ) -> Result<()> {
        VersionedMultisigConfig::versioned_multisig_remove_member(ctx, args)
    }

    pub fn create_vault_transaction(
        ctx: Context<VaultTransactionCreate>,
        args: VaultTransactionCreateArgs
    ) -> Result<()> {
        VaultTransactionCreate::vault_transaction_create(ctx, args)
    }

    pub fn execute_vault_transaction(
        ctx: Context<VaultTransactionExecute>,
    ) -> Result<()> {
        VaultTransactionExecute::vault_transaction_execute(ctx)
    }

    pub fn vote_on_vault_transaction(
        ctx: Context<VoteOnVersionedProposal>,
        approve: bool,
    ) -> Result<()> {
        versioned_proposal_vote::handler(ctx, approve)
    }

    pub fn multisig_change_threshold(
        ctx: Context<VersionedMultisigConfig>,
        args: VersionedMultisigChangeThresholdArgs,
    ) -> Result<()> {
        VersionedMultisigConfig::multisig_change_threshold(ctx, args)
    }

    pub fn multisig_set_config_authority(
        ctx: Context<VersionedMultisigConfig>,
        args: VersionedMultisigSetConfigAuthorityArgs,
    ) -> Result<()> {
        VersionedMultisigConfig::multisig_set_config_authority(ctx, args)
    }

    /// Create a transaction buffer account.
    pub fn transaction_buffer_create(
        ctx: Context<TransactionBufferCreate>,
        args: TransactionBufferCreateArgs,
    ) -> Result<()> {
        TransactionBufferCreate::transaction_buffer_create(ctx, args)
    }

    /// Close a transaction buffer account.
    pub fn transaction_buffer_close(ctx: Context<TransactionBufferClose>) -> Result<()> {
        TransactionBufferClose::transaction_buffer_close(ctx)
    }

    /// Extend a transaction buffer account.
    pub fn transaction_buffer_extend(
        ctx: Context<TransactionBufferExtend>,
        args: TransactionBufferExtendArgs,
    ) -> Result<()> {
        TransactionBufferExtend::transaction_buffer_extend(ctx, args)
    }

    /// Create a new vault transaction from a completed transaction buffer.
    /// Finalized buffer hash must match `final_buffer_hash`
    pub fn vault_transaction_create_from_buffer<'info>(
        ctx: Context<'_, '_, 'info, 'info, VaultTransactionCreateFromBuffer<'info>>,
        args: VaultTransactionCreateArgs,
    ) -> Result<()> {
        VaultTransactionCreateFromBuffer::vault_transaction_create_from_buffer(ctx, args)
    }
} 
