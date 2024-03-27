use crate::command::config_transaction_create::ConfigTransactionCreate;
use crate::command::config_transaction_execute::ConfigTransactionExecute;
use crate::command::initiate_program_upgrade::InitiateProgramUpgrade;
use crate::command::initiate_transfer::InitiateTransfer;
use crate::command::multisig_create::MultisigCreate;
use crate::command::program_config_init::ProgramConfigInit;
use crate::command::proposal_vote::ProposalVote;
use crate::command::vault_transaction_accounts_close::VaultTransactionAccountsClose;
use crate::command::vault_transaction_create::VaultTransactionCreate;
use crate::command::vault_transaction_execute::VaultTransactionExecute;

use clap::Subcommand;

pub mod config_transaction_create;
pub mod config_transaction_execute;
pub mod initiate_program_upgrade;
pub mod initiate_transfer;
pub mod multisig_create;
pub mod program_config_init;
pub mod proposal_vote;
pub mod vault_transaction_accounts_close;
pub mod vault_transaction_create;
pub mod vault_transaction_execute;

#[derive(Subcommand)]
pub enum Command {
    ProgramConfigInit(ProgramConfigInit),
    MultisigCreate(MultisigCreate),
    ProposalVote(ProposalVote),
    VaultTransactionExecute(VaultTransactionExecute),
    VaultTransactionCreate(VaultTransactionCreate),
    ConfigTransactionCreate(ConfigTransactionCreate),
    ConfigTransactionExecute(ConfigTransactionExecute),
    VaultTransactionAccountsClose(VaultTransactionAccountsClose),
    InitiateTransfer(InitiateTransfer),
    InitiateProgramUpgrade(InitiateProgramUpgrade),
}
