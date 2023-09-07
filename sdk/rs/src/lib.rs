// Export current sdk types for downstream users building with a different sdk version
pub use squads_multisig_program::anchor_lang;
pub use squads_multisig_program::anchor_lang::solana_program;
// Export the program types
pub use squads_multisig_program;

pub mod state {
    pub use squads_multisig_program::state::{
        Batch, ConfigAction, ConfigTransaction, Member, Multisig, MultisigCompiledInstruction,
        MultisigMessageAddressTableLookup, Period, Permission, Permissions, Proposal,
        ProposalStatus,
    };
}

pub mod cpi {
    use squads_multisig_program::anchor_lang::prelude::{CpiContext, Pubkey, Result};
    use squads_multisig_program::Member;

    pub use squads_multisig_program::cpi::accounts::{
        BatchAddTransaction, BatchCreate, BatchExecuteTransaction, ConfigTransactionCreate,
        ConfigTransactionExecute, MultisigAddSpendingLimit, MultisigConfig, MultisigCreate,
        MultisigRemoveSpendingLimit, ProposalActivate, ProposalCreate, ProposalVote,
        SpendingLimitUse, VaultTransactionCreate, VaultTransactionExecute,
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
}

pub mod client {
    use squads_multisig_program::anchor_lang::prelude::Pubkey;
    use squads_multisig_program::anchor_lang::{
        solana_program::instruction::Instruction, InstructionData, ToAccountMetas,
    };

    pub use squads_multisig_program::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
    pub use squads_multisig_program::instruction::ConfigTransactionCreate as ConfigTransactionCreateData;
    pub use squads_multisig_program::instructions::ConfigTransactionCreateArgs;

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
