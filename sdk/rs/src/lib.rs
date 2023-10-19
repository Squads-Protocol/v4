// Re-export dependencies for convenience
pub use solana_client;

pub use squads_multisig_program;
pub use squads_multisig_program::anchor_lang;
pub use squads_multisig_program::anchor_lang::solana_program;

pub mod client;
pub mod pda;
pub mod vault_transaction;

pub mod error {
    use thiserror::Error;

    #[derive(Debug, Error)]
    pub enum ClientError {
        #[error(transparent)]
        Client(#[from] solana_client::client_error::ClientError),
        #[error("Failed to deserialize account data")]
        DeserializationError,
        #[error("Invalid AddressLookupTableAccount")]
        InvalidAddressLookupTableAccount,
        #[error("Invalid TransactionMessage")]
        InvalidTransactionMessage,
    }
}

pub type ClientResult<T> = Result<T, error::ClientError>;

pub mod state {
    pub use squads_multisig_program::instructions::TransactionMessage;
    pub use squads_multisig_program::state::{
        Batch, ConfigAction, ConfigTransaction, Member, Multisig, MultisigCompiledInstruction,
        MultisigMessageAddressTableLookup, Period, Permission, Permissions, Proposal,
        ProposalStatus, SpendingLimit, VaultTransactionMessage,
    };
    pub use squads_multisig_program::SmallVec;
}

pub mod cpi {
    use squads_multisig_program::anchor_lang::prelude::{CpiContext, Pubkey, Result};
    pub use squads_multisig_program::cpi::accounts::{
        BatchAddTransaction, BatchCreate, BatchExecuteTransaction, ConfigTransactionCreate,
        ConfigTransactionExecute, MultisigAddSpendingLimit, MultisigConfig, MultisigCreate,
        MultisigRemoveSpendingLimit, ProposalActivate, ProposalCreate, ProposalVote,
        SpendingLimitUse, VaultTransactionCreate, VaultTransactionExecute,
    };
    use squads_multisig_program::Member;

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
}
