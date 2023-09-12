use solana_client::nonblocking::rpc_client::RpcClient;

pub use squads_multisig_program::accounts::ConfigTransactionCreate as ConfigTransactionCreateAccounts;
pub use squads_multisig_program::accounts::ProposalCreate as ProposalCreateAccounts;
pub use squads_multisig_program::accounts::ProposalVote as ProposalVoteAccounts;
pub use squads_multisig_program::instruction::ConfigTransactionCreate as ConfigTransactionCreateData;
pub use squads_multisig_program::instruction::ProposalApprove as ProposalApproveData;
pub use squads_multisig_program::instruction::ProposalCreate as ProposalCreateData;
pub use squads_multisig_program::instructions::ConfigTransactionCreateArgs;
pub use squads_multisig_program::instructions::ProposalCreateArgs;
pub use squads_multisig_program::instructions::ProposalVoteArgs;
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
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::state::ConfigAction;
/// use squads_multisig::client::{
///     ConfigTransactionCreateAccounts,
///     ConfigTransactionCreateData,
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
///     ConfigTransactionCreateData {
///         args: ConfigTransactionCreateArgs {
///             actions: vec![ConfigAction::ChangeThreshold { new_threshold: 2 }],
///             memo: None,
///         },
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
///
pub fn config_transaction_create(
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

/// Creates a new multisig proposal.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::solana_program::system_program;
/// use squads_multisig::state::ConfigAction;
/// use squads_multisig::client::{
///     ProposalCreateAccounts,
///     ProposalCreateData,
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
///     ProposalCreateData {
///         args: ProposalCreateArgs {
///             transaction_index: 0,
///             draft: false,
///         },
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
///
pub fn proposal_create(
    accounts: ProposalCreateAccounts,
    data: ProposalCreateData,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: data.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}

/// Votes "approve" on a multisig proposal.
/// Example:
/// ```
/// use squads_multisig::solana_program::pubkey::Pubkey;
/// use squads_multisig::client::{
///     ProposalVoteAccounts,
///     ProposalApproveData,
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
///     ProposalApproveData {
///         args: ProposalVoteArgs { memo: None }
///     },
///     Some(squads_multisig_program::ID)
/// );
/// ```
pub fn proposal_approve(
    accounts: ProposalVoteAccounts,
    data: ProposalApproveData,
    program_id: Option<Pubkey>,
) -> Instruction {
    Instruction {
        accounts: accounts.to_account_metas(Some(false)),
        data: data.data(),
        program_id: program_id.unwrap_or(squads_multisig_program::ID),
    }
}
