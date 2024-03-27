use clap::Parser;

use command::Command;

mod command;
pub mod utils;

#[derive(Parser)]
struct App {
    #[command(subcommand)]
    command: Command,
}

#[tokio::main]
async fn main() -> eyre::Result<()> {
    let app = App::parse();

    match app.command {
        Command::ProgramConfigInit(command) => command.execute().await,
        Command::MultisigCreate(command) => command.execute().await,
        Command::ProposalVote(command) => command.execute().await,
        Command::VaultTransactionExecute(command) => command.execute().await,
        Command::VaultTransactionCreate(command) => command.execute().await,
        Command::ConfigTransactionCreate(command) => command.execute().await,
        Command::ConfigTransactionExecute(command) => command.execute().await,
        Command::VaultTransactionAccountsClose(command) => command.execute().await,
        Command::InitiateTransfer(command) => command.execute().await,
        Command::InitiateProgramUpgrade(command) => command.execute().await,
    }
}
