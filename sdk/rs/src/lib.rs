pub mod pda;

// Re-export dependencies for convenience
pub use solana_client;

pub use squads_multisig_program;
pub use squads_multisig_program::anchor_lang;
pub use squads_multisig_program::anchor_lang::solana_program;

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
    pub use squads_multisig_program::state::{
        Batch, ConfigAction, ConfigTransaction, Member, Multisig, MultisigCompiledInstruction,
        MultisigMessageAddressTableLookup, Period, Permission, Permissions, Proposal,
        ProposalStatus,
    };
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

pub mod client {
    use solana_client::nonblocking::rpc_client::RpcClient;

    pub use squads_multisig_program::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
    pub use squads_multisig_program::instruction::ConfigTransactionCreate as ConfigTransactionCreateData;
    pub use squads_multisig_program::instructions::ConfigTransactionCreateArgs;
    use squads_multisig_program::Multisig;

    use crate::anchor_lang::prelude::Pubkey;
    use crate::anchor_lang::AnchorDeserialize;
    use crate::anchor_lang::{
        solana_program::instruction::Instruction, InstructionData, ToAccountMetas,
    };
    use crate::error::ClientError;
    use crate::ClientResult;

    /// Gets a `Multisig` account from the chain.
    pub async fn get_multisig(
        rpc_client: &RpcClient,
        multisig_key: &Pubkey,
    ) -> ClientResult<Multisig> {
        let multisig_account = rpc_client.get_account(multisig_key).await?;

        let multisig = Multisig::try_from_slice(&multisig_account.data)
            .map_err(|_| ClientError::DeserializationError)?;

        Ok(multisig)
    }

    /// Creates a new multisig config transaction.
    /// Example:
    /// ```
    /// use squads_multisig::solana_program::pubkey::Pubkey;
    /// use squads_multisig::state::ConfigAction;
    /// use squads_multisig::client::{
    ///     ConfigTransactionCreateAccounts,
    ///     ConfigTransactionCreateData,
    ///     ConfigTransactionCreateArgs,
    ///     create_config_transaction
    /// };
    ///
    /// let data = ConfigTransactionCreateData {
    ///     args: ConfigTransactionCreateArgs {
    ///         actions: vec![ConfigAction::ChangeThreshold {
    ///         new_threshold: 2,
    ///     }],
    ///     memo: None,
    ///  },
    /// };
    ///
    /// let accounts = ConfigTransactionCreateAccounts {
    ///     multisig: Pubkey::new_unique(),
    ///     creator: Pubkey::new_unique(),
    ///     rent_payer: Pubkey::new_unique(),
    ///     system_program: Pubkey::new_unique(),
    ///     transaction: Pubkey::new_unique(),
    /// };
    ///
    /// let ix = create_config_transaction(accounts, data, Some(squads_multisig_program::ID));
    /// ```
    ///
    pub fn create_config_transaction(
        accounts: ConfigTransactionCreateAccounts,
        data: ConfigTransactionCreateData,
        program_id: Option<Pubkey>,
    ) -> Instruction {
        Instruction {
            accounts: accounts.to_account_metas(Some(false)),
            data: data.data(),
            program_id: program_id.unwrap_or(squads_multisig_program::ID),
        }
    }
}
