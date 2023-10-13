use solana_client::nonblocking::rpc_client::RpcClient;

pub use squads_multisig_program::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
pub use squads_multisig_program::accounts::ConfigTransactionExecute as ConfigTransactionExecuteAccounts;
pub use squads_multisig_program::accounts::MultisigCreate as MultisigCreateAccounts;
pub use squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
pub use squads_multisig_program::accounts::ProposalVote as ProposalVoteAccounts;
pub use squads_multisig_program::accounts::SpendingLimitUse as SpendingLimitUseAccounts;
pub use squads_multisig_program::accounts::VaultTransactionCreate as VaultTransactionCreateAccounts;
pub use squads_multisig_program::instruction::ConfigTransactionCreate as ConfigTransactionCreateData;
pub use squads_multisig_program::instruction::ConfigTransactionExecute as ConfigTransactionExecuteData;
pub use squads_multisig_program::instruction::MultisigCreate as MultisigCreateData;
pub use squads_multisig_program::instruction::ProposalApprove as ProposalApproveData;
pub use squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
pub use squads_multisig_program::instruction::SpendingLimitUse as SpendingLimitUseData;
pub use squads_multisig_program::instruction::VaultTransactionCreate as VaultTransactionCreateData;
pub use squads_multisig_program::instructions::ConfigTransactionCreateArgs;
pub use squads_multisig_program::instructions::MultisigCreateArgs;
pub use squads_multisig_program::instructions::ProposalCreateArgs;
pub use squads_multisig_program::instructions::ProposalVoteArgs;
pub use squads_multisig_program::instructions::SpendingLimitUseArgs;
pub use squads_multisig_program::instructions::VaultTransactionCreateArgs;
use squads_multisig_program::Multisig;

use crate::anchor_lang::prelude::Pubkey;
use crate::anchor_lang::AccountDeserialize;
use crate::anchor_lang::{
    solana_program::instruction::Instruction, InstructionData, ToAccountMetas,
};
use crate::error::ClientError;
use crate::ClientResult;

/// Gets a `Multisig` account from the chain.
pub async fn get_multisig(rpc_client: &RpcClient, multisig_key: &Pubkey) -> ClientResult<Multisig> {
    let multisig_account = rpc_client.get_account(multisig_key).await?;

    let multisig = Multisig::try_deserialize(&mut multisig_account.data.as_slice())
        .map_err(|_| ClientError::DeserializationError)?;

    Ok(multisig)
}

/// Creates a new multisig config transaction.
/// Example:
/// ```
/// use squads_multisig::anchor_lang::error::ComparedValues::Pubkeys;
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::state::{ConfigAction, Member, Permissions, Permission};
/// use squads_multisig::client::{
///     MultisigCreateAccounts,
///     MultisigCreateArgs,
///     multisig_create
/// };
///
/// let ix = multisig_create(
///     MultisigCreateAccounts {
///         multisig: Pubkey::new_unique(),
///         create_key: Pubkey::new_unique(),
///         creator: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     MultisigCreateArgs {
///         members: vec![
///             Member {
///                 key: Pubkey::new_unique(),
///                 permissions: Permissions::from_vec(&[Permission::Initiate, Permission::Vote, Permission::Execute]),
///             }
///         ],
///         threshold: 1,
///         time_lock: 0,
///         config_authority: None,
///         memo: Some("Deploy my own Squad".to_string()),
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
///
pub fn multisig_create(
    accounts: MultisigCreateAccounts,
    args: MultisigCreateArgs,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: MultisigCreateData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Creates a new multisig config transaction.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::state::ConfigAction;
/// use squads_multisig::client::{
///     ConfigTransactionCreateAccounts,
///     ConfigTransactionCreateArgs,
///     config_transaction_create
/// };
///
/// let ix = config_transaction_create(
///     ConfigTransactionCreateAccounts {
///         multisig: Pubkey::new_unique(),
///         creator: Pubkey::new_unique(),
///         rent_payer: Pubkey::new_unique(),
///         transaction: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     ConfigTransactionCreateArgs {
///         actions: vec![ConfigAction::ChangeThreshold { new_threshold: 2 }],
///         memo: None,
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
///
pub fn config_transaction_create(
    accounts: ConfigTransactionCreateAccounts,
    args: ConfigTransactionCreateArgs,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: ConfigTransactionCreateData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Executes a multisig config transaction.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::state::ConfigAction;
/// use squads_multisig::client::{
///     ConfigTransactionExecuteAccounts,
///     config_transaction_execute
/// };
///
/// let ix = config_transaction_execute(
///     ConfigTransactionExecuteAccounts {
///         multisig: Pubkey::new_unique(),
///         member: Pubkey::new_unique(),
///         proposal: Pubkey::new_unique(),
///         transaction: Pubkey::new_unique(),
///         rent_payer: None,
///         system_program: None,
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
pub fn config_transaction_execute(
    accounts: ConfigTransactionExecuteAccounts,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: ConfigTransactionExecuteData.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Creates a new multisig proposal.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::state::ConfigAction;
/// use squads_multisig::client::{
///     ProposalCreateAccounts,
///     ProposalCreateArgs,
///     proposal_create
/// };
///
/// let ix = proposal_create(
///     ProposalCreateAccounts {
///         multisig: Pubkey::new_unique(),
///         creator: Pubkey::new_unique(),
///         proposal: Pubkey::new_unique(),
///         rent_payer: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     ProposalCreateArgs {
///         transaction_index: 0,
///             draft: false,
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
///
pub fn proposal_create(
    accounts: ProposalCreateAccounts,
    args: ProposalCreateArgs,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: ProposalCreateData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Votes "approve" on a multisig proposal.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::client::{
///     ProposalVoteAccounts,
///     ProposalVoteArgs,
///     proposal_approve,
/// };
///
/// let ix = proposal_approve(
///     ProposalVoteAccounts {
///         multisig: Pubkey::new_unique(),
///         proposal: Pubkey::new_unique(),
///         member: Pubkey::new_unique(),
///     },
///     ProposalVoteArgs { memo: None },
///     Some(squads_multisig_program::ID)
/// );
/// ```
pub fn proposal_approve(
    accounts: ProposalVoteAccounts,
    args: ProposalVoteArgs,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: ProposalApproveData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Use a Spending Limit to transfer tokens from a multisig vault to a destination account.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::solana_program::native_token::LAMPORTS_PER_SOL;
/// use squads_multisig::client::{
///     SpendingLimitUseAccounts,
///     SpendingLimitUseArgs,
///     spending_limit_use,
/// };
///
/// let ix = spending_limit_use(
///     SpendingLimitUseAccounts {
///         multisig: Pubkey::new_unique(),
///         member: Pubkey::new_unique(),
///         spending_limit: Pubkey::new_unique(),
///         vault: Pubkey::new_unique(),
///         destination: Pubkey::new_unique(),
///         system_program: Some(system_program::id()),
///         mint: None,
///         vault_token_account: None,
///         destination_token_account: None,
///         token_program: None,
///     },
///     SpendingLimitUseArgs {
///         amount: 1 * LAMPORTS_PER_SOL,
///         decimals: 9,
///         memo: None
///     },
///     None,
/// );
/// ```
///
pub fn spending_limit_use(
    accounts: SpendingLimitUseAccounts,
    args: SpendingLimitUseArgs,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: SpendingLimitUseData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Creates a new vault transaction.
/// Example:
/// ```
/// use squads_multisig::anchor_lang::AnchorSerialize;
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::client::{
///     VaultTransactionCreateAccounts,
///     VaultTransactionCreateArgs,
///     vault_transaction_create,
/// };
/// use squads_multisig_program::TransactionMessage;
///
/// let message = TransactionMessage {
///     num_signers: 1,
///     num_writable_signers: 1,
///     num_writable_non_signers: 2,
///     account_keys: vec![].into(),
///     instructions: vec![].into(),
///     address_table_lookups: vec![].into(),
/// }.try_to_vec().unwrap();
///
/// let ix = vault_transaction_create(
///     VaultTransactionCreateAccounts {
///         multisig: Pubkey::new_unique(),
///         transaction: Pubkey::new_unique(),
///         creator: Pubkey::new_unique(),
///         rent_payer: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     VaultTransactionCreateArgs {
///         vault_index: 0,
///         ephemeral_signers: 0,
///         transaction_message: message,
///         memo: None,
///     },
///     None
/// );
/// ```
pub fn vault_transaction_create(
    accounts: VaultTransactionCreateAccounts,
    args: VaultTransactionCreateArgs,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: VaultTransactionCreateData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}
