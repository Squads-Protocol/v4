use squads_multisig::pda::get_vault_pda;
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

use clap::Args;

#[derive(Args)]
pub struct DisplayVault {
    /// Multisig Program ID
    #[arg(long)]
    program_id: Option<String>,

    /// Path to the Program Config Initializer Keypair
    #[arg(long)]
    multisig_address: String,

    // index to derive the vault, default 0
    #[arg(long)]
    vault_index: Option<u8>,
}

impl DisplayVault {
    pub async fn execute(self) -> eyre::Result<()> {
        let Self {
            program_id,
            multisig_address,
            vault_index,
        } = self;

        let program_id = program_id.unwrap_or_else(|| {
            "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf".to_string()
        });

        let program_id = Pubkey::from_str(&program_id).expect("Invalid program ID");

        let multisig_address = Pubkey::from_str(&multisig_address).expect("Invalid multisig address");

        let vault_index = vault_index.unwrap_or(0);

        let vault_address = get_vault_pda(&multisig_address, vault_index, Some(&program_id));

        println!("Vault: {:?}", vault_address);

        Ok(())
    }
}