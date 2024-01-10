use clap_v3::ArgMatches;
use solana_clap_v3_utils::keypair::signer_from_path;
use solana_sdk::signer::Signer;

pub fn create_signer_from_path(
    keypair_path: String,
) -> Result<Box<dyn Signer>, Box<dyn std::error::Error>> {
    let mut wallet_manager = None;
    let matches = ArgMatches::default();

    signer_from_path(&matches, &keypair_path, "Keypair", &mut wallet_manager)
}
