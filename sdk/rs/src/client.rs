use solana_client::nonblocking::rpc_client::RpcClient;

pub use squads_multisig_program::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
pub use squads_multisig_program::accounts::ConfigTransactionExecute as ConfigTransactionExecuteAccounts;
pub use squads_multisig_program::accounts::MultisigCreate as MultisigCreateAccounts;
pub use squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
pub use squads_multisig_program::accounts::ProposalVote as ProposalVoteAccounts;
pub use squads_multisig_program::accounts::SpendingLimitUse as SpendingLimitUseAccounts;
pub use squads_multisig_program::accounts::VaultTransactionCreate as VaultTransactionCreateAccounts;
use squads_multisig_program::anchor_lang::AnchorSerialize;
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
use squads_multisig_program::TransactionMessage;

use crate::anchor_lang::prelude::Pubkey;
use crate::anchor_lang::AccountDeserialize;
use crate::anchor_lang::{
    solana_program::instruction::Instruction, InstructionData, ToAccountMetas,
};
use crate::error::ClientError;
use crate::pda::get_vault_pda;
use crate::solana_program::instruction::AccountMeta;
use crate::state::{Multisig, SpendingLimit};
use crate::vault_transaction_message::VaultTransactionMessageExt;
use crate::ClientResult;

/// Gets a `Multisig` account from the chain.
pub async fn get_multisig(rpc_client: &RpcClient, multisig_key: &Pubkey) -> ClientResult<Multisig> {
    let multisig_account = rpc_client.get_account(multisig_key).await?;

    let multisig = Multisig::try_deserialize(&mut multisig_account.data.as_slice())
        .map_err(|_| ClientError::DeserializationError)?;

    Ok(multisig)
}

/// Gets a `SpendingLimit` account from the chain.
pub async fn get_spending_limit(
    rpc_client: &RpcClient,
    spending_limit_key: &Pubkey,
) -> ClientResult<SpendingLimit> {
    let spending_limit_account = rpc_client.get_account(spending_limit_key).await?;

    let spending_limit =
        SpendingLimit::try_deserialize(&mut spending_limit_account.data.as_slice())
            .map_err(|_| ClientError::DeserializationError)?;

    Ok(spending_limit)
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
///     vec![],
///     Some(squads_multisig_program::ID)
/// );
/// ```
pub fn config_transaction_execute(
    accounts: ConfigTransactionExecuteAccounts,
    spending_limit_accounts: Vec<Pubkey>,
    program_id: Option<Pubkey>,
) -> Instruction {
    let account_metas = [
        accounts.to_account_metas(Some(false)),
        // Spending Limit accounts are optional and are passed as remaining_accounts
        // if the Config Transaction adds or removes some.
        spending_limit_accounts
            .into_iter()
            .map(|key| AccountMeta::new(key, false))
            .collect(),
    ]
    .concat();

    Instruction {
        accounts: account_metas,
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
/// use squads_multisig::solana_program::{system_instruction, system_program};
/// use squads_multisig::client::{
///     VaultTransactionCreateAccounts,
///     VaultTransactionCreateArgs,
///     vault_transaction_create,
/// };
/// use squads_multisig::pda::get_vault_pda;
/// use squads_multisig::vault_transaction_message::VaultTransactionMessageExt;
/// use squads_multisig_program::TransactionMessage;
///
/// let multisig = Pubkey::new_unique();
/// let vault_index = 0;
/// let vault_pda = get_vault_pda(&multisig, vault_index, None).0;
///
/// let ix = vault_transaction_create(
///     VaultTransactionCreateAccounts {
///         multisig,
///         transaction: Pubkey::new_unique(),
///         creator: Pubkey::new_unique(),
///         rent_payer: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     0,
///     // Create a vault transaction that includes 1 instruction - SOL transfer from the default vault.
///     vec![system_instruction::transfer(&vault_pda, &Pubkey::new_unique(), 1_000_000)],
///     0,
///     None,
///     None,
/// );
/// ```
pub fn vault_transaction_create(
    accounts: VaultTransactionCreateAccounts,
    vault_index: u8,
    instructions: Vec<Instruction>,
    num_ephemeral_signers: u8,
    memo: Option<String>,
    program_id: Option<Pubkey>,
) -> Instruction {
    let vault_pda = get_vault_pda(&accounts.multisig, vault_index, None).0;

    let message = TransactionMessage::try_compile(&vault_pda, &instructions, &[])
        .unwrap()
        .try_to_vec()
        .unwrap();

    let args = VaultTransactionCreateArgs {
        vault_index,
        ephemeral_signers: num_ephemeral_signers,
        transaction_message: message,
        memo,
    };

    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: VaultTransactionCreateData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}
