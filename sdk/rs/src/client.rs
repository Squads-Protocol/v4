use solana_client::nonblocking::rpc_client::RpcClient;

pub use squads_multisig_program::accounts::BatchAccountsClose as BatchAccountsCloseAccounts;
pub use squads_multisig_program::accounts::ConfigTransactionAccountsClose as ConfigTransactionAccountsCloseAccounts;
pub use squads_multisig_program::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
pub use squads_multisig_program::accounts::ConfigTransactionExecute as ConfigTransactionExecuteAccounts;
pub use squads_multisig_program::accounts::MultisigCreate as MultisigCreateAccounts;
pub use squads_multisig_program::accounts::MultisigCreateV2 as MultisigCreateAccountsV2;
pub use squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
pub use squads_multisig_program::accounts::ProposalVote as ProposalVoteAccounts;
pub use squads_multisig_program::accounts::SpendingLimitUse as SpendingLimitUseAccounts;
pub use squads_multisig_program::accounts::VaultBatchTransactionAccountClose as VaultBatchTransactionAccountCloseAccounts;
pub use squads_multisig_program::accounts::VaultTransactionAccountsClose as VaultTransactionAccountsCloseAccounts;
pub use squads_multisig_program::accounts::VaultTransactionCreate as VaultTransactionCreateAccounts;
pub use squads_multisig_program::accounts::VaultTransactionExecute as VaultTransactionExecuteAccounts;
use squads_multisig_program::anchor_lang::AnchorSerialize;
pub use squads_multisig_program::instruction::ConfigTransactionAccountsClose as ConfigTransactionAccountsCloseData;
pub use squads_multisig_program::instruction::ConfigTransactionCreate as ConfigTransactionCreateData;
pub use squads_multisig_program::instruction::ConfigTransactionExecute as ConfigTransactionExecuteData;
pub use squads_multisig_program::instruction::MultisigCreate as MultisigCreateData;
pub use squads_multisig_program::instruction::MultisigCreateV2 as MultisigCreateDataV2;
pub use squads_multisig_program::instruction::ProposalApprove as ProposalApproveData;
pub use squads_multisig_program::instruction::ProposalCancel as ProposalCancelData;
pub use squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
pub use squads_multisig_program::instruction::SpendingLimitUse as SpendingLimitUseData;
pub use squads_multisig_program::instruction::VaultTransactionAccountsClose as VaultTransactionAccountsCloseData;
pub use squads_multisig_program::instruction::VaultTransactionCreate as VaultTransactionCreateData;
pub use squads_multisig_program::instruction::VaultTransactionExecute as VaultTransactionExecuteData;
pub use squads_multisig_program::instructions::ConfigTransactionCreateArgs;
pub use squads_multisig_program::instructions::MultisigCreateArgs;
pub use squads_multisig_program::instructions::MultisigCreateArgsV2;
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
use crate::client::utils::IntoAccountMetas;
use crate::error::ClientError;
use crate::pda::get_vault_pda;
use crate::solana_program::address_lookup_table_account::AddressLookupTableAccount;
use crate::solana_program::instruction::AccountMeta;
use crate::state::{Multisig, SpendingLimit};
use crate::vault_transaction::{Error, VaultTransactionMessageExt};
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
/// use squads_multisig::anchor_lang::error::ComparedValues::Pubkeys;
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::state::{ConfigAction, Member, Permissions, Permission};
/// use squads_multisig::client::{
///     MultisigCreateAccountsV2,
///     MultisigCreateArgsV2,
///     multisig_create_v2
/// };
///
/// let ix = multisig_create_v2(
///     MultisigCreateAccountsV2 {
///         program_config: Pubkey::new_unique(),
///         treasury: Pubkey::new_unique(),
///         multisig: Pubkey::new_unique(),
///         create_key: Pubkey::new_unique(),
///         creator: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     MultisigCreateArgsV2 {
///         members: vec![
///             Member {
///                 key: Pubkey::new_unique(),
///                 permissions: Permissions::from_vec(&[Permission::Initiate, Permission::Vote, Permission::Execute]),
///             }
///         ],
///         threshold: 1,
///         time_lock: 0,
///         config_authority: None,
///         rent_collector: None,
///         memo: Some("Deploy my own Squad".to_string()),
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
///
pub fn multisig_create_v2(
    accounts: MultisigCreateAccountsV2,
    args: MultisigCreateArgsV2,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: MultisigCreateDataV2 { args }.data(),
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
    let program_id = program_id.unwrap_or(squads_multisig_program::ID);

    let account_metas = [
        accounts.into_account_metas(program_id),
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
        program_id,
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

/// Votes "cancel" on a multisig proposal.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::client::{
///     ProposalVoteAccounts,
///     ProposalVoteArgs,
///     proposal_cancel,
/// };
///
/// let ix = proposal_cancel(
///     ProposalVoteAccounts {
///         multisig: Pubkey::new_unique(),
///         proposal: Pubkey::new_unique(),
///         member: Pubkey::new_unique(),
///     },
///     ProposalVoteArgs { memo: None },
///     Some(squads_multisig_program::ID)
/// );
/// ```
pub fn proposal_cancel(
    accounts: ProposalVoteAccounts,
    args: ProposalVoteArgs,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: ProposalCancelData { args }.data(),
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
    let program_id = program_id.unwrap_or(squads_multisig_program::ID);

    Instruction {
        accounts: accounts.into_account_metas(program_id),
        data: SpendingLimitUseData { args }.data(),
        program_id,
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
/// use squads_multisig::vault_transaction::VaultTransactionMessageExt;
/// use squads_multisig_program::TransactionMessage;
///
/// let multisig = Pubkey::new_unique();
/// let vault_index = 0;
/// let vault_pda = get_vault_pda(&multisig, vault_index, None).0;
///
/// // Create a vault transaction that includes 1 instruction - SOL transfer from the default vault.
/// let message = TransactionMessage::try_compile(
///     &vault_pda,
///     &[system_instruction::transfer(&vault_pda, &Pubkey::new_unique(), 1_000_000)],
///     &[]
/// ).unwrap();
///
/// let ix = vault_transaction_create(
///     VaultTransactionCreateAccounts {
///         multisig,
///         transaction: Pubkey::new_unique(),
///         creator: Pubkey::new_unique(),
///         rent_payer: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     vault_index,
///     0,
///     &message,
///     None,
///     None,
/// );
/// ```
pub fn vault_transaction_create(
    accounts: VaultTransactionCreateAccounts,
    vault_index: u8,
    num_ephemeral_signers: u8,
    message: &TransactionMessage,
    memo: Option<String>,
    program_id: Option<Pubkey>,
) -> Instruction {
    let args = VaultTransactionCreateArgs {
        vault_index,
        ephemeral_signers: num_ephemeral_signers,
        transaction_message: message.try_to_vec().unwrap(),
        memo,
    };

    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: VaultTransactionCreateData { args }.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Executes a vault transaction.
/// Example:
/// ```
/// use squads_multisig::anchor_lang::AnchorSerialize;
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::{system_instruction, system_program};
/// use squads_multisig::client::{
///     VaultTransactionExecuteAccounts,
///     vault_transaction_execute
/// };
/// use squads_multisig::pda::get_vault_pda;
/// use squads_multisig::vault_transaction::VaultTransactionMessageExt;
/// use squads_multisig_program::TransactionMessage;
///
/// let multisig = Pubkey::new_unique();
/// let vault_index = 0;
/// let vault_pda = get_vault_pda(&multisig, vault_index, None).0;
///
/// // Create a vault transaction that includes 1 instruction - SOL transfer from the default vault.
/// let message = TransactionMessage::try_compile(
///     &vault_pda,
///     &[system_instruction::transfer(&vault_pda, &Pubkey::new_unique(), 1_000_000)],
///     &[]
/// ).unwrap();
///
/// let ix = vault_transaction_execute(
///     VaultTransactionExecuteAccounts {
///         multisig,
///         transaction: Pubkey::new_unique(),
///         member: Pubkey::new_unique(),
///         proposal: Pubkey::new_unique(),
///     },
///     0,
///     0,
///     &message,
///     &[],
///     None,
/// );
///
/// ```
pub fn vault_transaction_execute(
    accounts: VaultTransactionExecuteAccounts,
    vault_index: u8,
    num_ephemeral_signers: u8,
    message: &TransactionMessage,
    address_lookup_table_accounts: &[AddressLookupTableAccount],
    program_id: Option<Pubkey>,
) -> ClientResult<Instruction> {
    let program_id = program_id.unwrap_or(squads_multisig_program::ID);

    let vault_pda = get_vault_pda(&accounts.multisig, vault_index, Some(&program_id)).0;

    let accounts_for_execute = message
        .get_accounts_for_execute(
            &vault_pda,
            &accounts.transaction,
            &address_lookup_table_accounts,
            num_ephemeral_signers,
            &program_id,
        )
        .map_err(|err| match err {
            Error::InvalidAddressLookupTableAccount => {
                ClientError::InvalidAddressLookupTableAccount
            }
            Error::InvalidTransactionMessage => ClientError::InvalidTransactionMessage,
        })?;

    let mut accounts = accounts.to_account_metas(Some(false));
    // Append the accounts required for executing the inner instructions.
    accounts.extend(accounts_for_execute.into_iter());

    Ok(Instruction {
        accounts,
        data: VaultTransactionExecuteData {}.data(),
        program_id,
    })
}

/// Closes a `ConfigTransaction` and the corresponding `Proposal`.
/// `transaction` can be closed if either:
/// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
/// - the `proposal` is stale.
///
/// Example:
/// ```
/// use squads_multisig::solana_program::{pubkey::Pubkey, system_program};
/// use squads_multisig::client::{
///    ConfigTransactionAccountsCloseAccounts,
///    config_transaction_accounts_close
/// };
///
/// let ix = config_transaction_accounts_close(
///     ConfigTransactionAccountsCloseAccounts {
///         multisig: Pubkey::new_unique(),
///         proposal: Pubkey::new_unique(),
///         transaction: Pubkey::new_unique(),
///         rent_collector: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     None,
/// );
pub fn config_transaction_accounts_close(
    accounts: ConfigTransactionAccountsCloseAccounts,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: ConfigTransactionAccountsCloseData {}.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Closes a `VaultTransaction` and the corresponding `Proposal`.
/// `transaction` can be closed if either:
/// - the `proposal` is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
/// - the `proposal` is stale and not `Approved`.
///
/// Example:
/// ```
/// use squads_multisig::solana_program::{pubkey::Pubkey, system_program};
/// use squads_multisig::client::{
///     VaultTransactionAccountsCloseAccounts,
///     vault_transaction_accounts_close
/// };
///
/// let ix = vault_transaction_accounts_close(
///     VaultTransactionAccountsCloseAccounts {
///         multisig: Pubkey::new_unique(),
///         proposal: Pubkey::new_unique(),
///         transaction: Pubkey::new_unique(),
///         rent_collector: Pubkey::new_unique(),
///         system_program: system_program::id(),
///     },
///     None,
/// );
/// ```
pub fn vault_transaction_accounts_close(
    accounts: VaultTransactionAccountsCloseAccounts,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: VaultTransactionAccountsCloseData {}.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

pub mod utils {
    use squads_multisig_program::accounts::{ConfigTransactionExecute, SpendingLimitUse};

    use crate::solana_program::instruction::AccountMeta;
    use crate::solana_program::pubkey::Pubkey;

    /// A fix for the auto derived anchor `ToAccountMetas` trait.
    /// The anchor one works incorrectly with Option accounts when program ID is different from the canonical one.
    pub trait IntoAccountMetas {
        fn into_account_metas(self, program_id: Pubkey) -> Vec<AccountMeta>;
    }

    impl IntoAccountMetas for ConfigTransactionExecute {
        fn into_account_metas(self, program_id: Pubkey) -> Vec<AccountMeta> {
            vec![
                AccountMeta::new(self.multisig, false),
                AccountMeta::new_readonly(self.member, true),
                AccountMeta::new(self.proposal, false),
                AccountMeta::new(self.transaction, false),
                if let Some(rent_payer) = self.rent_payer {
                    AccountMeta::new(rent_payer, true)
                } else {
                    AccountMeta::new_readonly(program_id, false)
                },
                if let Some(system_program) = self.system_program {
                    AccountMeta::new_readonly(system_program, false)
                } else {
                    AccountMeta::new_readonly(program_id, false)
                },
            ]
        }
    }

    impl IntoAccountMetas for SpendingLimitUse {
        fn into_account_metas(self, program_id: Pubkey) -> Vec<AccountMeta> {
            vec![
                AccountMeta::new_readonly(self.multisig, false),
                AccountMeta::new_readonly(self.member, true),
                AccountMeta::new(self.spending_limit, false),
                AccountMeta::new(self.vault, false),
                AccountMeta::new(self.destination, false),
                if let Some(system_program) = self.system_program {
                    AccountMeta::new_readonly(system_program, false)
                } else {
                    AccountMeta::new_readonly(program_id, false)
                },
                if let Some(mint) = self.mint {
                    AccountMeta::new_readonly(mint, false)
                } else {
                    AccountMeta::new_readonly(program_id, false)
                },
                if let Some(vault_token_account) = self.vault_token_account {
                    AccountMeta::new(vault_token_account, false)
                } else {
                    AccountMeta::new_readonly(program_id, false)
                },
                if let Some(destination_token_account) = self.destination_token_account {
                    AccountMeta::new(destination_token_account, false)
                } else {
                    AccountMeta::new_readonly(program_id, false)
                },
                if let Some(token_program) = self.token_program {
                    AccountMeta::new_readonly(token_program, false)
                } else {
                    AccountMeta::new_readonly(program_id, false)
                },
            ]
        }
    }

    #[cfg(test)]
    mod test {
        use crate::anchor_lang::prelude::Pubkey;
        use crate::anchor_lang::ToAccountMetas;
        use crate::client::utils::IntoAccountMetas;
        use squads_multisig_program::accounts::SpendingLimitUse;

        #[test]
        fn spending_limit_use_into_account_metas_matches_anchor_implementation() {
            let accounts = SpendingLimitUse {
                multisig: Pubkey::new_unique(),
                member: Pubkey::new_unique(),
                spending_limit: Pubkey::new_unique(),
                vault: Pubkey::new_unique(),
                destination: Pubkey::new_unique(),
                system_program: Some(Pubkey::new_unique()),
                mint: Some(Pubkey::new_unique()),
                vault_token_account: Some(Pubkey::new_unique()),
                destination_token_account: Some(Pubkey::new_unique()),
                token_program: Some(Pubkey::new_unique()),
            };

            // When program_id is the canonical one our implementation should match the anchor one.
            let anchor_metas = accounts.to_account_metas(Some(false));
            let sdk_metas = accounts.into_account_metas(squads_multisig_program::ID);

            assert_eq!(anchor_metas, sdk_metas);
        }

        #[test]
        fn config_transaction_execute_into_account_metas_matches_anchor_implementation() {
            let accounts = squads_multisig_program::accounts::ConfigTransactionExecute {
                multisig: Pubkey::new_unique(),
                member: Pubkey::new_unique(),
                proposal: Pubkey::new_unique(),
                transaction: Pubkey::new_unique(),
                rent_payer: Some(Pubkey::new_unique()),
                system_program: Some(Pubkey::new_unique()),
            };

            // When program_id is the canonical one our implementation should match the anchor one.
            let anchor_metas = accounts.to_account_metas(Some(false));
            let sdk_metas = accounts.into_account_metas(squads_multisig_program::ID);

            assert_eq!(anchor_metas, sdk_metas);
        }
    }
}
