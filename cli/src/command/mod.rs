use crate::command::config_transaction_create::ConfigTransactionCreate;
use crate::command::config_transaction_execute::ConfigTransactionExecute;
use crate::command::display_proposals::DisplayProposals;
use crate::command::display_vault::DisplayVault;
use crate::command::initiate_program_upgrade::InitiateProgramUpgrade;
use crate::command::initiate_batch_transfer::InitiateBatchTransfer;
use crate::command::initiate_transfer::InitiateTransfer;
use crate::command::multisig_create::MultisigCreate;
use crate::command::program_config_init::ProgramConfigInit;
use crate::command::proposal_vote::ProposalVote;
use crate::command::claim_rent::ClaimRent;
use crate::command::vault_transaction_accounts_close::VaultTransactionAccountsClose;
use crate::command::vault_transaction_create::VaultTransactionCreate;
use crate::command::display_config_transaction::DisplayConfigTransaction;
use crate::command::display_transaction::DisplayTransaction;
use crate::command::vault_transaction_execute::VaultTransactionExecute;

use clap::Subcommand;

pub mod config_transaction_create;
pub mod config_transaction_execute;
pub mod display_proposals;
pub mod display_vault;
pub mod initiate_batch_transfer;
pub mod initiate_program_upgrade;
pub mod initiate_transfer;
pub mod transfer_common;
pub mod multisig_create;
pub mod program_config_init;
pub mod proposal_vote;
pub mod claim_rent;
pub mod display_config_transaction;
pub mod display_transaction;
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
    ClaimRent(ClaimRent),
    InitiateTransfer(InitiateTransfer),
    InitiateBatchTransfer(InitiateBatchTransfer),
    InitiateProgramUpgrade(InitiateProgramUpgrade),
    DisplayVault(DisplayVault),
    DisplayProposals(DisplayProposals),
    DisplayTransaction(DisplayTransaction),
    DisplayConfigTransaction(DisplayConfigTransaction),
}
