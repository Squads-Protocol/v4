use clap::Args;
use colored::Colorize;
use solana_address_lookup_table_interface::state::AddressLookupTable;
use solana_sdk::pubkey::Pubkey;
use squads_multisig::anchor_lang::AccountDeserialize;
use squads_multisig::solana_rpc_client::nonblocking::rpc_client::RpcClient;
use bs58;
use squads_multisig::squads_multisig_program::state::VaultTransaction;
use squads_multisig::state::VaultTransactionMessage;
use std::str::FromStr;

/// Fetch a vault transaction account and display its decoded instructions, accounts, and address lookup tables.
#[derive(Args)]
pub struct ShowTransaction {
    /// RPC URL (default: https://api.mainnet-beta.solana.com)
    #[arg(long)]
    rpc_url: Option<String>,

    /// The VaultTransaction account address to inspect
    #[arg(long)]
    transaction_address: String,
}

struct AccountEntry {
    pubkey: Pubkey,
    is_writable: bool,
    is_signer: bool,
}

impl ShowTransaction {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc_url = self
            .rpc_url
            .unwrap_or_else(|| "https://api.mainnet-beta.solana.com".to_string());
        let transaction_address = Pubkey::from_str(&self.transaction_address)?;

        let rpc_client = RpcClient::new(rpc_url);

        let account_data = rpc_client.get_account(&transaction_address).await?.data;

        let vault_tx =
            VaultTransaction::try_deserialize(&mut account_data.as_slice())?;

        println!();
        println!("{}", "Transaction Details".bold());
        println!("  Address:     {}", transaction_address);
        println!("  Multisig:    {}", vault_tx.multisig);
        println!("  Creator:     {}", vault_tx.creator);
        println!("  Index:       {}", vault_tx.index);
        println!("  Vault Index: {}", vault_tx.vault_index);
        println!();

        let message = &vault_tx.message;

        // Build the full resolved account list: static keys first, then ALT-derived keys.
        let mut all_accounts: Vec<AccountEntry> = message
            .account_keys
            .iter()
            .enumerate()
            .map(|(i, key)| AccountEntry {
                pubkey: *key,
                is_writable: message.is_static_writable_index(i),
                is_signer: message.is_signer_index(i),
            })
            .collect();

        // Fetch each ALT, resolve its addresses, and append them to all_accounts.
        // Track the resolved entries for the summary printed at the end.
        let mut alt_summaries: Vec<(Pubkey, Vec<Pubkey>, Vec<Pubkey>)> = Vec::new();

        for lookup in &message.address_table_lookups {
            let alt_data = rpc_client.get_account(&lookup.account_key).await?.data;
            let alt = AddressLookupTable::deserialize(&alt_data)?;

            let mut writable_pubkeys = Vec::new();
            let mut readonly_pubkeys = Vec::new();

            for &idx in &lookup.writable_indexes {
                let pubkey = alt.addresses[idx as usize];
                writable_pubkeys.push(pubkey);
                all_accounts.push(AccountEntry {
                    pubkey,
                    is_writable: true,
                    is_signer: false,
                });
            }

            for &idx in &lookup.readonly_indexes {
                let pubkey = alt.addresses[idx as usize];
                readonly_pubkeys.push(pubkey);
                all_accounts.push(AccountEntry {
                    pubkey,
                    is_writable: false,
                    is_signer: false,
                });
            }

            alt_summaries.push((lookup.account_key, writable_pubkeys, readonly_pubkeys));
        }

        // Print each instruction.
        println!(
            "{}",
            format!("Instructions ({})", message.instructions.len()).bold()
        );
        println!();

        for (i, ix) in message.instructions.iter().enumerate() {
            let program_pubkey = all_accounts[ix.program_id_index as usize].pubkey;

            println!("{}", format!("Instruction {}", i + 1).yellow().bold());
            println!("  Program: {}", program_pubkey);

            if !ix.account_indexes.is_empty() {
                println!("  Accounts:");
                for (j, &idx) in ix.account_indexes.iter().enumerate() {
                    let acc = &all_accounts[idx as usize];
                    let flags = match (acc.is_writable, acc.is_signer) {
                        (true, true) => " [writable, signer]".cyan().to_string(),
                        (true, false) => " [writable]".cyan().to_string(),
                        (false, true) => " [signer]".cyan().to_string(),
                        (false, false) => String::new(),
                    };
                    println!("    {}: {}{}", j + 1, acc.pubkey, flags);
                }
            }

            if !ix.data.is_empty() {
                println!("  Data: {}", bs58::encode(&ix.data).into_string());
            }

            println!();
        }

        // Print ALT summary if any were used.
        if !alt_summaries.is_empty() {
            println!("{}", "Address Lookup Tables".bold());
            for (key, writable, readonly) in &alt_summaries {
                println!("  {}", key);
                if !writable.is_empty() {
                    println!("    Writable:");
                    for pk in writable {
                        println!("      {}", pk);
                    }
                }
                if !readonly.is_empty() {
                    println!("    Readonly:");
                    for pk in readonly {
                        println!("      {}", pk);
                    }
                }
            }
            println!();
        }

        Ok(())
    }
}
