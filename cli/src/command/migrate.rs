//! Move a v4 multisig vault to its 4r successor: `migrate-plan` (read only), `migrate-propose`
//! (create the v4 proposals), `migrate-execute` (run an approved v4 vault transaction or batch)
//! and `migrate-lookup-tables` (get the rent of the lookup tables back).

use std::str::FromStr;

use clap::{ArgGroup, Args};
use colored::Colorize;
use dialoguer::Confirm;
use eyre::eyre;
use solana_commitment_config::CommitmentConfig;
use solana_compute_budget_interface::ComputeBudgetInstruction;
use solana_rpc_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::instruction::Instruction;
use solana_sdk::message::v0::Message;
use solana_sdk::message::{AddressLookupTableAccount, VersionedMessage};
use solana_sdk::pubkey::Pubkey;
use solana_sdk::signer::Signer;
use solana_sdk::transaction::VersionedTransaction;
use squads_multisig_4r::discriminator::account::{BATCH, VAULT_TRANSACTION};
use squads_multisig_4r::lookup_tables::{
    close_lookup_table, create_lookup_tables, deactivate_lookup_table,
};
use squads_multisig_4r::message::AddressLookupTableAccount as VaultLookupTable;
use squads_multisig_4r::pda::get_transaction_pda;
use squads_multisig_4r::planner::{
    migration_lookup_table_addresses, plan_v4_migration, v4_batch_execute_instructions,
    v4_batch_lookup_tables, v4_migration_proposal, v4_vault_transaction_execute_instruction,
    with_migration_lookup_tables, InventoryScans, MigrationGroup, MigrationLimits,
    MigrationOptions, PlanInput, V4MigrationPlan,
};
use squads_multisig_4r::LEGACY_V4_PROGRAM_ID;

use crate::utils::{send_and_confirm_transaction, signer_from_path};

const DEFAULT_RPC_URL: &str = "https://api.mainnet-beta.solana.com";

/// Reads at `confirmed`: a plan or an execution must see the newest proposals and approvals.
fn rpc_client(url: Option<String>) -> RpcClient {
    RpcClient::new_with_commitment(
        url.unwrap_or_else(|| DEFAULT_RPC_URL.to_string()),
        CommitmentConfig::confirmed(),
    )
}

fn parse_pubkey(value: &str, name: &str) -> eyre::Result<Pubkey> {
    Pubkey::from_str(value).map_err(|_| eyre!("invalid {name}: {value}"))
}

/// Arguments that every migrate command takes.
#[derive(Args)]
pub struct MigrateTarget {
    /// The v4 multisig to move.
    #[arg(long)]
    multisig_pubkey: String,

    /// The v4 vault to move. Its assets go to the successor vault with the same index.
    #[arg(long, default_value_t = 0)]
    vault_index: u8,

    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// The 4r program ID (default: mainnet).
    #[arg(long)]
    program_id: Option<String>,

    /// Keep the v4 token accounts open. By default they close, and their rent goes to the successor vault.
    #[arg(long)]
    keep_token_accounts: bool,

    /// Move token accounts that are not associated token accounts by owner change, so they keep their address.
    #[arg(long)]
    preserve_token_account_addresses: bool,

    /// A mint where the vault holds only Token-2022 extension or metadata authorities (the scan cannot find it).
    #[arg(long = "extra-mint")]
    extra_mints: Vec<String>,

    /// Do not scan for token roles (close authority, delegate), stakes, vote accounts, upgradeable programs and mints (for RPCs that refuse getProgramAccounts).
    #[arg(long)]
    skip_program_scans: bool,
}

impl MigrateTarget {
    fn rpc(&self) -> RpcClient {
        rpc_client(self.rpc_url.clone())
    }

    async fn plan(&self, rpc: &RpcClient) -> eyre::Result<V4MigrationPlan> {
        let source_multisig = parse_pubkey(&self.multisig_pubkey, "multisig address")?;
        let program_id = self
            .program_id
            .as_deref()
            .map(|id| parse_pubkey(id, "program ID"))
            .transpose()?;
        let extra_mints = self
            .extra_mints
            .iter()
            .map(|mint| parse_pubkey(mint, "mint"))
            .collect::<eyre::Result<Vec<_>>>()?;
        let scans = match self.skip_program_scans {
            true => InventoryScans {
                token_roles: false,
                stakes: false,
                vote_accounts: false,
                programs: false,
                mints: false,
            },
            false => InventoryScans::default(),
        };
        Ok(plan_v4_migration(
            rpc,
            PlanInput {
                source_multisig,
                vault_index: self.vault_index,
                program_id: program_id.as_ref(),
                events: true,
                options: MigrationOptions {
                    keep_token_accounts: self.keep_token_accounts,
                    preserve_token_account_addresses: self.preserve_token_account_addresses,
                    skip_sol: false,
                },
                address_lookup_tables: &[],
                limits: None,
                scans,
                extra_mints: &extra_mints,
            },
        )
        .await?)
    }
}

fn group_label(group: &MigrationGroup) -> &'static str {
    match group {
        MigrationGroup::Tokens { .. } => "tokens",
        MigrationGroup::TokenAuthorities { .. } => "token authorities",
        MigrationGroup::Stakes(_) => "stakes",
        MigrationGroup::VoteAccounts(_) => "vote accounts",
        MigrationGroup::Programs(_) => "upgrade authorities",
        MigrationGroup::Sol { .. } => "SOL",
    }
}

fn print_items(plan: &V4MigrationPlan) {
    let tables = match plan.address_lookup_tables.len() {
        0 => String::new(),
        count => format!(" (with {count} lookup tables)"),
    };
    println!("Batch items{tables}: {}", plan.items.len());
    plan.items.iter().enumerate().for_each(|(i, item)| {
        println!(
            "  [{}] {} x {}, {} message bytes, {} accounts, {} instructions (worst case)",
            i + 1,
            item.group.len(),
            group_label(&item.group),
            item.message_bytes,
            item.message_accounts,
            item.instruction_trace,
        );
    });
}

fn print_plan(plan: &V4MigrationPlan) {
    let inventory = &plan.inventory;
    let index = plan.source.vault_index;
    println!();
    println!("v4 multisig:       {}", plan.source.source_multisig);
    println!("v4 vault {index}:        {}", plan.source_vault);
    println!("4r successor:      {}", plan.successor);
    println!("4r vault {index}:        {}", plan.vault);
    println!(
        "Successor:         {}",
        match (plan.create_successor.is_some(), plan.governance_matches) {
            (true, _) => "not created yet (the first proposal creates it)".yellow(),
            (false, Some(true)) => "exists, same governance as v4".green(),
            _ => "exists, DIFFERENT governance: migrate fails until they agree".red(),
        }
    );
    if let Some(fee) = plan.creation_fee {
        println!("Creation fee:      {fee} lamports (the most that the proposal allows)");
    }
    println!();
    println!("Inventory");
    println!("  SOL:             {} lamports", inventory.lamports);
    println!("  Token accounts:  {}", inventory.tokens.len());
    inventory.tokens.iter().for_each(|token| {
        let state = if token.frozen { " (frozen)" } else { "" };
        println!(
            "    {}  mint {}  amount {}{}",
            token.account, token.mint, token.amount, state
        );
    });
    println!("  Token roles:     {}", inventory.token_roles.len());
    inventory.token_roles.iter().for_each(|role| {
        let close = if role.close_authority {
            "  close authority"
        } else {
            ""
        };
        let delegate = role
            .delegated_amount
            .map(|amount| format!("  delegate for {amount}"))
            .unwrap_or_default();
        println!(
            "    {}  owner {}{close}{delegate}",
            role.account, role.owner
        );
    });
    println!("  Stake accounts:  {}", inventory.stakes.len());
    println!("  Vote accounts:   {}", inventory.vote_accounts.len());
    println!("  Programs:        {}", inventory.program_data.len());
    println!("  Mints:           {}", inventory.mints.len());
    inventory.mints.iter().for_each(|mint| {
        println!("    {}  authorities {:?}", mint.mint, mint.authorities);
    });
    println!();
    print_items(plan);
    plan.warnings
        .iter()
        .for_each(|warning| println!("{} {}", "warning:".yellow(), warning));
    println!();
}

fn message_tables(tables: &[VaultLookupTable]) -> Vec<AddressLookupTableAccount> {
    tables
        .iter()
        .map(|table| AddressLookupTableAccount {
            key: table.key,
            addresses: table.addresses.clone(),
        })
        .collect()
}

/// Signs and sends each instruction list as one transaction, in order. Stops at the first failure.
async fn send_all(
    rpc: &RpcClient,
    transactions: &[Vec<Instruction>],
    signers: &[&dyn Signer],
    payer: &Pubkey,
    priority_fee_lamports: u64,
    compute_unit_limit: Option<u32>,
    lookup_tables: &[AddressLookupTableAccount],
) -> eyre::Result<Vec<String>> {
    let mut signatures = Vec::new();
    for instructions in transactions {
        let budget = [ComputeBudgetInstruction::set_compute_unit_price(
            priority_fee_lamports,
        )]
        .into_iter()
        .chain(compute_unit_limit.map(ComputeBudgetInstruction::set_compute_unit_limit));
        let instructions: Vec<Instruction> = budget.chain(instructions.iter().cloned()).collect();
        let blockhash = rpc.get_latest_blockhash().await?;
        let message = Message::try_compile(payer, &instructions, lookup_tables, blockhash)?;
        let transaction = VersionedTransaction::try_new(VersionedMessage::V0(message), signers)?;
        signatures.push(send_and_confirm_transaction(&transaction, rpc).await?);
    }
    Ok(signatures)
}

fn confirm(prompt: &str) -> eyre::Result<bool> {
    Ok(Confirm::new()
        .with_prompt(prompt)
        .default(false)
        .interact()?)
}

/// The member and the optional fee payer; the payer is the fee payer, else the member.
struct Signers {
    member: Box<dyn Signer>,
    fee_payer: Option<Box<dyn Signer>>,
}

impl Signers {
    fn load(keypair: &str, fee_payer_keypair: Option<&str>) -> eyre::Result<Self> {
        Ok(Self {
            member: signer_from_path(keypair)?,
            fee_payer: fee_payer_keypair.map(signer_from_path).transpose()?,
        })
    }

    fn payer(&self) -> Pubkey {
        self.fee_payer
            .as_ref()
            .map_or_else(|| self.member.pubkey(), |signer| signer.pubkey())
    }

    fn all(&self) -> Vec<&dyn Signer> {
        [Some(&*self.member), self.fee_payer.as_deref()]
            .into_iter()
            .flatten()
            .collect()
    }
}

/// Show what a v4 vault holds and how it moves to its 4r successor. Sends nothing.
#[derive(Args)]
#[command(about = "Plan the move of a v4 vault to its 4r successor (read only)")]
pub struct MigratePlan {
    #[command(flatten)]
    target: MigrateTarget,
}

impl MigratePlan {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc = self.target.rpc();
        print_plan(&self.target.plan(&rpc).await?);
        Ok(())
    }
}

/// Create the v4 proposals of a migration: a vault transaction that creates the successor (if
/// needed) and one batch that moves the assets. Members then approve and run `migrate-execute`.
#[derive(Args)]
#[command(about = "Propose the move of a v4 vault to its 4r successor")]
pub struct MigratePropose {
    #[command(flatten)]
    target: MigrateTarget,

    /// Path to the keypair of a v4 member with Initiate permission
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair (also pays the rent of the proposal accounts)
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    /// Approve the proposals too (the member needs Vote permission)
    #[arg(long)]
    approve: bool,

    /// Put the item accounts in new address lookup tables (the member is their authority, the
    /// payer pays the rent): fewer, larger batch entries. Close them with migrate-lookup-tables.
    #[arg(long)]
    lookup_tables: bool,

    #[arg(long, default_value_t = 200_000)]
    priority_fee_lamports: u64,

    /// Do not ask for confirmation (for scripts)
    #[arg(long)]
    yes: bool,
}

impl MigratePropose {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc = self.target.rpc();
        let signers = Signers::load(&self.keypair, self.fee_payer_keypair.as_deref())?;
        let (member, payer) = (signers.member.pubkey(), signers.payer());

        let plan = self.target.plan(&rpc).await?;
        print_plan(&plan);
        if plan.governance_matches == Some(false) {
            return Err(eyre!(
                "the successor governance differs from v4; make them equal first"
            ));
        }
        let addresses = migration_lookup_table_addresses(&plan);
        let (plan, tables) = match self.lookup_tables && !addresses.is_empty() {
            true => {
                let recent_slot = rpc
                    .get_slot_with_commitment(CommitmentConfig::finalized())
                    .await?;
                let setup = create_lookup_tables(&addresses, &member, &payer, recent_slot);
                let plan = with_migration_lookup_tables(
                    plan,
                    setup.tables,
                    MigrationLimits::LOOKUP_TABLES,
                )?;
                print_items(&plan);
                println!();
                (plan, setup.transactions)
            }
            false => (plan, Vec::new()),
        };
        let proposal = v4_migration_proposal(&rpc, &plan, &member, &payer, self.approve).await?;
        if proposal.transactions.is_empty() {
            println!("Nothing to propose.");
            return Ok(());
        }
        println!("v4 program:        {}", LEGACY_V4_PROGRAM_ID);
        plan.address_lookup_tables.iter().for_each(|table| {
            println!(
                "Lookup table:      {} ({} addresses)",
                table.key,
                table.addresses.len()
            )
        });
        if let Some(index) = proposal.create_index {
            println!("Create successor:  v4 vault transaction {index}");
        }
        if let Some(index) = proposal.batch_index {
            println!(
                "Migrate assets:    v4 batch {index} with {} entries",
                plan.items.len()
            );
        }
        println!(
            "Transactions to send: {}",
            tables.len() + proposal.transactions.len()
        );
        println!();
        if !self.yes && !confirm("Do you want to proceed?")? {
            println!("OK, aborting.");
            return Ok(());
        }

        let fee = self.priority_fee_lamports;
        send_all(&rpc, &tables, &signers.all(), &payer, fee, None, &[]).await?;
        send_all(
            &rpc,
            &proposal.transactions,
            &signers.all(),
            &payer,
            fee,
            None,
            &[],
        )
        .await?;
        println!(
            "✅ Proposed. After approval, run migrate-execute with these transaction indexes:"
        );
        proposal
            .create_index
            .iter()
            .chain(proposal.batch_index.iter())
            .for_each(|index| println!("  --transaction-index {index}"));
        if !plan.address_lookup_tables.is_empty() {
            let keys: Vec<String> = plan
                .address_lookup_tables
                .iter()
                .map(|table| table.key.to_string())
                .collect();
            println!(
                "After the batch runs, get the table rent back: migrate-lookup-tables --deactivate --tables {}, then --close about 513 slots later.",
                keys.join(",")
            );
        }
        Ok(())
    }
}

/// Run an approved v4 vault transaction (successor creation) or the remaining entries of an
/// approved v4 batch, in order. Stops at the first entry that fails.
#[derive(Args)]
#[command(about = "Execute an approved v4 migration proposal")]
pub struct MigrateExecute {
    /// The v4 multisig
    #[arg(long)]
    multisig_pubkey: String,

    /// The v4 transaction index of the vault transaction or batch
    #[arg(long)]
    transaction_index: u64,

    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Path to the keypair of a v4 member with Execute permission
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    #[arg(long, default_value_t = 200_000)]
    priority_fee_lamports: u64,

    /// Do not ask for confirmation (for scripts)
    #[arg(long)]
    yes: bool,

    #[arg(long, default_value_t = 1_400_000)]
    compute_unit_limit: u32,
}

impl MigrateExecute {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc = rpc_client(self.rpc_url.clone());
        let multisig = parse_pubkey(&self.multisig_pubkey, "multisig address")?;
        let signers = Signers::load(&self.keypair, self.fee_payer_keypair.as_deref())?;
        let member = signers.member.pubkey();

        let transaction = get_transaction_pda(
            &multisig,
            self.transaction_index,
            Some(&LEGACY_V4_PROGRAM_ID),
        )
        .0;
        let account = rpc.get_account(&transaction).await?;
        if account.owner != LEGACY_V4_PROGRAM_ID {
            return Err(eyre!("{transaction} is not a v4 account"));
        }
        let index = self.transaction_index;
        let (executes, tables) = match account.data.get(..8) {
            Some(d) if d == VAULT_TRANSACTION => (
                vec![
                    v4_vault_transaction_execute_instruction(&rpc, &multisig, index, &member, &[])
                        .await?,
                ],
                Vec::new(),
            ),
            Some(d) if d == BATCH => {
                // The entries read their item accounts from the lookup tables in their messages.
                let tables = v4_batch_lookup_tables(&rpc, &multisig, index).await?;
                let executes =
                    v4_batch_execute_instructions(&rpc, &multisig, index, &member, &tables).await?;
                (executes, tables)
            }
            _ => {
                return Err(eyre!(
                    "{transaction} is neither a vault transaction nor a batch"
                ))
            }
        };
        println!();
        println!("v4 multisig:          {multisig}");
        println!("Transaction index:    {index}");
        println!("Lookup tables:        {}", tables.len());
        println!(
            "Executions to send:   {} (one transaction each, in order)",
            executes.len()
        );
        println!();
        if executes.is_empty() {
            println!("Nothing left to execute.");
            return Ok(());
        }
        if !self.yes && !confirm("Do you want to proceed?")? {
            println!("OK, aborting.");
            return Ok(());
        }

        let transactions: Vec<Vec<Instruction>> = executes
            .into_iter()
            .map(|instruction| vec![instruction])
            .collect();
        send_all(
            &rpc,
            &transactions,
            &signers.all(),
            &signers.payer(),
            self.priority_fee_lamports,
            Some(self.compute_unit_limit),
            &message_tables(&tables),
        )
        .await?;
        println!("✅ Executed.");
        Ok(())
    }
}

/// Deactivate the lookup tables of a migration, or close them about 513 slots after deactivation
/// to get their rent back.
#[derive(Args)]
#[command(about = "Deactivate or close the lookup tables of a migration")]
#[command(group(ArgGroup::new("action").required(true).args(["deactivate", "close"])))]
pub struct MigrateLookupTables {
    /// The lookup tables (comma-separated)
    #[arg(long, value_delimiter = ',', required = true)]
    tables: Vec<String>,

    /// Deactivate the tables: they stop working for new transactions
    #[arg(long)]
    deactivate: bool,

    /// Close deactivated tables; the rent goes to the recipient
    #[arg(long)]
    close: bool,

    /// The recipient of the rent (default: the authority)
    #[arg(long)]
    recipient: Option<String>,

    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Path to the keypair of the table authority (the member that proposed)
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    #[arg(long, default_value_t = 200_000)]
    priority_fee_lamports: u64,
}

impl MigrateLookupTables {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc = rpc_client(self.rpc_url.clone());
        let signers = Signers::load(&self.keypair, self.fee_payer_keypair.as_deref())?;
        let authority = signers.member.pubkey();
        let recipient = self
            .recipient
            .as_deref()
            .map(|recipient| parse_pubkey(recipient, "recipient"))
            .transpose()?
            .unwrap_or(authority);
        let instructions = self
            .tables
            .iter()
            .map(|table| {
                let table = parse_pubkey(table, "lookup table")?;
                Ok(match self.close {
                    true => close_lookup_table(&table, &authority, &recipient),
                    false => deactivate_lookup_table(&table, &authority),
                })
            })
            .collect::<eyre::Result<Vec<_>>>()?;
        send_all(
            &rpc,
            &[instructions],
            &signers.all(),
            &signers.payer(),
            self.priority_fee_lamports,
            None,
            &[],
        )
        .await?;
        let action = if self.close { "Closed" } else { "Deactivated" };
        println!("✅ {action} {} lookup tables.", self.tables.len());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use solana_address_lookup_table_interface::instruction as interface;
    use solana_sdk::pubkey::Pubkey;
    use squads_multisig_4r::lookup_tables::{
        close_lookup_table, create_lookup_table, deactivate_lookup_table, extend_lookup_table,
    };

    fn key(byte: u8) -> Pubkey {
        Pubkey::new_from_array([byte; 32])
    }

    #[test]
    fn lookup_table_instructions_match_the_interface_crate() {
        // Arrange
        let (authority, payer, table, recipient) = (key(1), key(2), key(3), key(4));
        let addresses = vec![key(5), key(6)];

        // Act
        let (created, ours_create) = create_lookup_table(&authority, &payer, 42);
        let (theirs_create, theirs_table) = interface::create_lookup_table(authority, payer, 42);

        // Assert
        assert_eq!((created, ours_create), (theirs_table, theirs_create));
        assert_eq!(
            extend_lookup_table(&table, &authority, &payer, &addresses),
            interface::extend_lookup_table(table, authority, Some(payer), addresses)
        );
        assert_eq!(
            deactivate_lookup_table(&table, &authority),
            interface::deactivate_lookup_table(table, authority)
        );
        assert_eq!(
            close_lookup_table(&table, &authority, &recipient),
            interface::close_lookup_table(table, authority, recipient)
        );
    }
}
