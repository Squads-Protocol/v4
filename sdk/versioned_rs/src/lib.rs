// Re-export dependencies for convenience
pub use solana_client;

pub use versioned_squads_multisig_program;
pub use versioned_squads_multisig_program::anchor_lang;
pub use versioned_squads_multisig_program::anchor_lang::solana_program;
    
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
    pub use versioned_squads_multisig_program::instructions::TransactionMessage;
    pub use versioned_squads_multisig_program::state::{
     ConfigAction, ConfigTransaction, VersionedMember, VersionedMultisig, MultisigCompiledInstruction,
        MultisigMessageAddressTableLookup, Period, Permission, Permissions, Proposal,
        ProposalStatus, VaultTransactionMessage,
    };
    pub use versioned_squads_multisig_program::SmallVec;
}

pub mod cpi {
    use versioned_squads_multisig_program::anchor_lang::prelude::{CpiContext, Pubkey, Result};
    pub use versioned_squads_multisig_program::cpi::accounts::
        VersionedMultisigCreateV2
    ;
    use versioned_squads_multisig_program::VersionedMember;

    pub fn create_multisig<'info>(
        ctx: CpiContext<'_, '_, '_, 'info, VersionedMultisigCreateV2<'info>>,
        members: Vec<VersionedMember>,
        threshold: u16,
        config_authority: Option<Pubkey>,
        rent_collector: Option<Pubkey>,
        time_lock: u32,
        memo: Option<String>,
    ) -> Result<()> {
        versioned_squads_multisig_program::cpi::create_versioned_multisig(
            ctx,
            versioned_squads_multisig_program::VersionedMultisigCreateArgsV2 {
                members,
                threshold,
                config_authority,
                rent_collector,
                time_lock,
                memo,
            },
        )
    }
}
