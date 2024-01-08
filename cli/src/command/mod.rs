use crate::command::program_config_init::ProgramConfigInit;
use clap::Subcommand;

pub mod program_config_init;

#[derive(Subcommand)]
pub enum Command {
    ProgramConfigInit(ProgramConfigInit),
}
