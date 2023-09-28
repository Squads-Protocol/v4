// Re-export dependencies for convenience
pub use solana_client;

pub use squads_multisig_program;
pub use squads_multisig_program::anchor_lang;
pub use squads_multisig_program::anchor_lang::solana_program;

pub mod client;
pub mod pda;

pub mod error {
    use thiserror::Error;

    #[derive(Debug, Error)]
    pub enum ClientError {
        #[error(transparent)]
        Client(#[from] solana_client::client_error::ClientError),

        #[error("Failed to deserialize account data")]
        DeserializationError,
    }
}

pub type ClientResult<T> = Result<T, error::ClientError>;

pub mod state {
    pub use squads_multisig_program::instructions::TransactionMessage;
    pub use squads_multisig_program::state::{
        Batch, ConfigAction, ConfigTransaction, Member, Multisig, MultisigCompiledInstruction,
        MultisigMessageAddressTableLookup, Period, Permission, Permissions, Proposal,
        ProposalStatus, VaultTransactionMessage,
    };
    pub use squads_multisig_program::SmallVec;
}

pub mod cpi {
    use std::mem;

    pub use squads_multisig_program::cpi::accounts::{
        BatchAddTransaction, BatchCreate, BatchExecuteTransaction, ConfigTransactionCreate,
        ConfigTransactionExecute, MultisigAddSpendingLimit, MultisigConfig, MultisigCreate,
        MultisigRemoveSpendingLimit, ProposalActivate, ProposalCreate, ProposalVote,
        SpendingLimitUse, VaultTransactionCreate, VaultTransactionExecute,
    };
    pub use squads_multisig_program::{
        anchor_lang::prelude::{CpiContext, Pubkey, Result},
        BatchCreateArgs, ConfigAction, Member,
    };
    use squads_multisig_program::{instruction::ProposalReject, SpendingLimitUseArgs};
    use squads_multisig_program::{
        BatchAddTransactionArgs, MultisigAddMemberArgs, MultisigAddSpendingLimitArgs,
        MultisigChangeThresholdArgs, MultisigRemoveMemberArgs, MultisigRemoveSpendingLimitArgs,
        MultisigSetConfigAuthorityArgs, MultisigSetTimeLockArgs, ProposalCreateArgs,
        ProposalVoteArgs, VaultTransactionCreateArgs,
    };

    pub fn create_multisig<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigCreate<'info>>,
        members: Vec<Member>,
        threshold: u16,
        config_authority: Option<Pubkey>,
        time_lock: u32,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_create(
            ctx,
            squads_multisig_program::MultisigCreateArgs {
                members,
                threshold,
                config_authority,
                time_lock,
                memo,
            },
        )
    }

    pub fn create_config_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ConfigTransactionCreate<'info>>,
        config_action: Vec<ConfigAction>,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::config_transaction_create(
            ctx,
            squads_multisig_program::ConfigTransactionCreateArgs {
                actions: config_action,
                memo,
            },
        )
    }

    pub fn execute_config_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ConfigTransactionExecute<'info>>,
    ) -> Result<()> {
        squads_multisig_program::cpi::config_transaction_execute(ctx)
    }

    pub fn create_batch<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, BatchCreate<'info>>,
        vault_index: u8,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::batch_create(
            ctx,
            BatchCreateArgs {
                vault_index: vault_index,
                memo: memo,
            },
        )
    }

    pub fn batch_add_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, BatchAddTransaction<'info>>,
        ephemeral_signers: u8,
        transaction_message: Vec<u8>,
    ) -> Result<()> {
        squads_multisig_program::cpi::batch_add_transaction(
            ctx,
            BatchAddTransactionArgs {
                ephemeral_signers,
                transaction_message,
            },
        )
    }

    pub fn execute_batch_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, BatchExecuteTransaction<'info>>,
    ) -> Result<()> {
        squads_multisig_program::cpi::batch_execute_transaction(ctx)
    }

    pub fn add_member<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigConfig<'info>>,
        new_member: Member,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_add_member(
            ctx,
            MultisigAddMemberArgs { new_member, memo },
        )
    }

    pub fn add_spending_limitr<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigAddSpendingLimit<'info>>,
        amount: u64,
        memo: Option<String>,
        create_key: Pubkey,
        vault_index: u8,
        destinations: Vec<Pubkey>,
        apply_to_members: Vec<Pubkey>,
        apply_to_mint: Pubkey,
        period: crate::state::Period,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_add_spending_limit(
            ctx,
            MultisigAddSpendingLimitArgs {
                amount,
                memo,
                create_key,
                vault_index,
                destinations,
                members: apply_to_members,
                mint: apply_to_mint,
                period,
            },
        )
    }

    pub fn change_threshold<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigConfig<'info>>,
        memo: Option<String>,
        new_threshold: u16,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_change_threshold(
            ctx,
            MultisigChangeThresholdArgs {
                new_threshold,
                memo,
            },
        )
    }

    pub fn remove_member<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigConfig<'info>>,
        old_member: Pubkey,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_remove_member(
            ctx,
            MultisigRemoveMemberArgs { old_member, memo },
        )
    }

    pub fn remove_spending_limit<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigRemoveSpendingLimit<'info>>,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_remove_spending_limit(
            ctx,
            MultisigRemoveSpendingLimitArgs { memo },
        )
    }

    pub fn set_new_config_authority<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigConfig<'info>>,
        memo: Option<String>,
        new_config_authority: Pubkey,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_set_config_authority(
            ctx,
            MultisigSetConfigAuthorityArgs {
                memo,
                config_authority: new_config_authority,
            },
        )
    }

    pub fn set_time_lock<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, MultisigConfig<'info>>,
        time_lock: u32,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::multisig_set_time_lock(
            ctx,
            MultisigSetTimeLockArgs { memo, time_lock },
        )
    }

    pub fn activate_proposal<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ProposalActivate<'info>>,
    ) -> Result<()> {
        squads_multisig_program::cpi::proposal_activate(ctx)
    }

    pub fn approve_proposal<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ProposalVote<'info>>,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::proposal_approve(ctx, ProposalVoteArgs { memo })
    }

    pub fn cancel_proposal<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ProposalVote<'info>>,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::proposal_cancel(ctx, ProposalVoteArgs { memo })
    }

    pub fn create_proposal<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ProposalCreate<'info>>,
        transaction_index: u64,
        is_draft: bool,
    ) -> Result<()> {
        squads_multisig_program::cpi::proposal_create(
            ctx,
            ProposalCreateArgs {
                transaction_index,
                draft: is_draft,
            },
        )
    }

    pub fn reject_proposal<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, ProposalVote<'info>>,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::proposal_reject(ctx, ProposalVoteArgs { memo })
    }

    pub fn use_spending_limit<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, SpendingLimitUse<'info>>,
        amount: u64,
        decimals: u8,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::spending_limit_use(
            ctx,
            SpendingLimitUseArgs {
                memo,
                amount,
                decimals,
            },
        )
    }

    pub fn create_vault_transaction<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, VaultTransactionCreate<'info>>,
        vault_index: u8,
        transaction_message: Vec<u8>,
        ephemeral_signers: u8,
        memo: Option<String>,
    ) -> Result<()> {
        squads_multisig_program::cpi::vault_transaction_create(
            ctx,
            VaultTransactionCreateArgs {
                memo,
                vault_index,
                transaction_message,
                ephemeral_signers,
            },
        )
    }

    pub fn execute_proposal<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, VaultTransactionExecute<'info>>,
    ) -> Result<()> {
        squads_multisig_program::cpi::vault_transaction_execute(ctx)
    }
}
