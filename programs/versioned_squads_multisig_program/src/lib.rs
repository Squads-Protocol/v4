#![allow(clippy::result_large_err)]
#![deny(arithmetic_overflow)]
#![deny(unused_must_use)]

use anchor_lang::prelude::*;

declare_id!("5XyhmmQ2dRFpnLtjbWZYkNH46YkEBzaKodnjTR7Cm9er"); // Replace with actual program ID
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

    
} 