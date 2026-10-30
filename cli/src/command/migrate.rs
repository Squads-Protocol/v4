//! Move a v4 vault or a v3 authority to its 4r successor: `migrate-plan` (read only),
//! `migrate-propose` (create the v4 proposals or the v3 transaction), `migrate-execute` (run an
//! approved one) and `migrate-lookup-tables` (get the rent of the lookup tables back).

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
use squads_multisig_4r::error::ClientError;
use squads_multisig_4r::lookup_tables::{
    close_lookup_table, create_lookup_tables, deactivate_lookup_table,
};
use squads_multisig_4r::message::AddressLookupTableAccount as VaultLookupTable;
use squads_multisig_4r::pda::get_transaction_pda;
use squads_multisig_4r::planner::{
    migration_lookup_table_addresses, plan_v4_migration, v4_batch_execute_instructions,
    v4_batch_lookup_tables, v4_migration_proposal, v4_vault_transaction_execute_instruction,
    with_migration_lookup_tables, InventoryScans, MemberRisk, MemberSigningReport, MigrationGroup,
    MigrationItem, MigrationLimits, MigrationOptions, PlanInput, V4MigrationPlan, V4VaultInventory,
};
use squads_multisig_4r::v3::{MsTransactionStatus, LEGACY_V3_PROGRAM_ID};
use squads_multisig_4r::v3_migration::{
    fetch_v3_transaction, plan_v3_migration, v3_execute_instructions, v3_migration_proposal,
    V3MigrationPlan, V3PlanInput,
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

/// The lineage of a source multisig: the program that owns it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Lineage {
    V4,
    V3,
}

fn lineage_of(owner: &Pubkey) -> Option<Lineage> {
    match *owner {
        LEGACY_V4_PROGRAM_ID => Some(Lineage::V4),
        LEGACY_V3_PROGRAM_ID => Some(Lineage::V3),
        _ => None,
    }
}

/// Reads the owner of `multisig` to find its lineage.
async fn fetch_lineage(rpc: &RpcClient, multisig: &Pubkey) -> eyre::Result<Lineage> {
    let owner = rpc.get_account(multisig).await?.owner;
    lineage_of(&owner).ok_or_else(|| {
        eyre!(
            "{multisig} is owned by {owner}: neither a v4 ({LEGACY_V4_PROGRAM_ID}) nor a v3 ({LEGACY_V3_PROGRAM_ID}) multisig"
        )
    })
}

/// What moves: a v4 vault, or a v3 authority.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SourceIndex {
    V4Vault(u8),
    V3Authority(u32),
}

/// The source of `lineage` from the flags. Refuses the flag of the other lineage.
fn source_index(
    lineage: Lineage,
    vault_index: Option<u8>,
    authority_index: Option<u32>,
) -> eyre::Result<SourceIndex> {
    match (lineage, vault_index, authority_index) {
        (Lineage::V4, _, Some(_)) => Err(eyre!(
            "--authority-index is for v3 multisigs; this is a v4 multisig, use --vault-index"
        )),
        (Lineage::V3, Some(_), _) => Err(eyre!(
            "--vault-index is for v4 multisigs; this is a v3 multisig, use --authority-index (default 1)"
        )),
        (Lineage::V4, vault_index, None) => Ok(SourceIndex::V4Vault(vault_index.unwrap_or(0))),
        (Lineage::V3, None, authority_index) => {
            Ok(SourceIndex::V3Authority(authority_index.unwrap_or(1)))
        }
    }
}

/// A v3 plan error, with the delegate members as an actionable message.
fn v3_plan_error(error: ClientError) -> eyre::Report {
    match error {
        ClientError::V3DelegateMembers(delegates) => {
            eyre!("the migration is blocked.\n{delegates}")
        }
        error => error.into(),
    }
}

/// A plan of either lineage.
enum Plan {
    V4(V4MigrationPlan),
    V3(V3MigrationPlan),
}

/// What `print_plan` shows of a plan of either lineage.
struct PlanView<'a> {
    lineage: &'static str,
    source_multisig: Pubkey,
    source_label: String,
    source_vault: Pubkey,
    successor: Pubkey,
    vault_label: String,
    vault: Pubkey,
    creates_successor: bool,
    creation_fee: Option<u64>,
    governance_matches: Option<bool>,
    inventory: &'a V4VaultInventory,
    item_label: &'static str,
    items: &'a [MigrationItem],
    lookup_tables: usize,
    member_report: &'a MemberSigningReport,
    warnings: &'a [String],
}

impl Plan {
    fn view(&self) -> PlanView<'_> {
        match self {
            Plan::V4(plan) => PlanView {
                lineage: "v4",
                source_multisig: plan.source.source_multisig,
                source_label: format!("v4 vault {}", plan.source.vault_index),
                source_vault: plan.source_vault,
                successor: plan.successor,
                vault_label: format!("4r vault {}", plan.source.vault_index),
                vault: plan.vault,
                creates_successor: plan.create_successor.is_some(),
                creation_fee: plan.creation_fee,
                governance_matches: plan.governance_matches,
                inventory: &plan.inventory,
                item_label: "Batch items",
                items: &plan.items,
                lookup_tables: plan.address_lookup_tables.len(),
                member_report: &plan.member_report,
                warnings: &plan.warnings,
            },
            Plan::V3(plan) => PlanView {
                lineage: "v3",
                source_multisig: plan.source.source_multisig,
                source_label: format!("v3 authority {}", plan.source.authority_index),
                source_vault: plan.source_vault,
                successor: plan.successor,
                vault_label: format!("4r vault {}", plan.vault_index),
                vault: plan.vault,
                creates_successor: plan.create_successor.is_some(),
                creation_fee: plan.creation_fee,
                governance_matches: plan.governance_matches,
                inventory: &plan.inventory,
                item_label: "v3 instructions",
                items: &plan.items,
                lookup_tables: plan.address_lookup_tables.len(),
                member_report: &plan.member_report,
                warnings: &plan.warnings,
            },
        }
    }
}

/// Arguments that every migrate command takes.
#[derive(Args)]
pub struct MigrateTarget {
    /// The v4 or v3 multisig to move (the owner program sets the lineage).
    #[arg(long)]
    multisig_pubkey: String,

    /// v4 only (default 0): the v4 vault to move. Its assets go to the successor vault with the same index.
    #[arg(long)]
    vault_index: Option<u8>,

    /// v3 only (1 to 256, default 1): the v3 authority to move. Its assets go to the successor vault `index - 1`.
    #[arg(long)]
    authority_index: Option<u32>,

    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// The 4r program ID (default: mainnet).
    #[arg(long)]
    program_id: Option<String>,

    /// Keep the source token accounts open. By default they close, and their rent goes to the successor vault.
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

    async fn plan(&self, rpc: &RpcClient) -> eyre::Result<Plan> {
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
        let options = MigrationOptions {
            keep_token_accounts: self.keep_token_accounts,
            preserve_token_account_addresses: self.preserve_token_account_addresses,
            skip_sol: false,
        };
        let lineage = fetch_lineage(rpc, &source_multisig).await?;
        match source_index(lineage, self.vault_index, self.authority_index)? {
            SourceIndex::V4Vault(vault_index) => Ok(Plan::V4(
                plan_v4_migration(
                    rpc,
                    PlanInput {
                        source_multisig,
                        vault_index,
                        program_id: program_id.as_ref(),
                        events: true,
                        options,
                        address_lookup_tables: &[],
                        limits: None,
                        scans,
                        extra_mints: &extra_mints,
                    },
                )
                .await?,
            )),
            SourceIndex::V3Authority(authority_index) => plan_v3_migration(
                rpc,
                V3PlanInput {
                    source_multisig,
                    authority_index,
                    program_id: program_id.as_ref(),
                    events: true,
                    options,
                    address_lookup_tables: &[],
                    limits: None,
                    scans,
                    extra_mints: &extra_mints,
                },
            )
            .await
            .map(Plan::V3)
            .map_err(v3_plan_error),
        }
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

fn print_items(label: &str, items: &[MigrationItem], lookup_tables: usize) {
    let tables = match lookup_tables {
        0 => String::new(),
        count => format!(" (with {count} lookup tables)"),
    };
    println!("{label}{tables}: {}", items.len());
    items.iter().enumerate().for_each(|(i, item)| {
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

/// One `label: value` line, with the values in one column.
fn print_field(label: &str, value: impl std::fmt::Display) {
    println!("{:<19}{value}", format!("{label}:"));
}

fn print_member_report(report: &MemberSigningReport) {
    let risk = match report.risk {
        MemberRisk::None => "none (every member is a wallet)".green(),
        MemberRisk::Low => "low".yellow(),
        MemberRisk::High => "HIGH".red(),
    };
    print_field(
        "Member signing",
        format!(
            "{} wallet voters, threshold {}, risk {risk}",
            report.on_curve_voters, report.threshold
        ),
    );
    report.off_curve.iter().for_each(|member| {
        let vault = if member.known_vault {
            " (a known vault)"
        } else {
            ""
        };
        println!("    off-curve member {}{vault}", member.key);
    });
}

fn print_plan(plan: &PlanView) {
    let inventory = plan.inventory;
    let lineage = plan.lineage;
    println!();
    print_field(&format!("{lineage} multisig"), plan.source_multisig);
    print_field(&plan.source_label, plan.source_vault);
    print_field("4r successor", plan.successor);
    print_field(&plan.vault_label, plan.vault);
    print_field(
        "Successor",
        match (plan.creates_successor, plan.governance_matches) {
            (true, _) => "not created yet (the first proposal creates it)".yellow(),
            (false, Some(true)) => format!("exists, same governance as {lineage}")
                .as_str()
                .green(),
            _ => "exists, DIFFERENT governance: migrate fails until they agree".red(),
        },
    );
    if let Some(fee) = plan.creation_fee {
        print_field(
            "Creation fee",
            format!("{fee} lamports (the most that the proposal allows)"),
        );
    }
    print_member_report(plan.member_report);
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
    print_items(plan.item_label, plan.items, plan.lookup_tables);
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

/// Show what a v4 vault or a v3 authority holds and how it moves to its 4r successor. Sends nothing.
#[derive(Args)]
#[command(about = "Plan the move of a v4 vault or a v3 authority to its 4r successor (read only)")]
pub struct MigratePlan {
    #[command(flatten)]
    target: MigrateTarget,
}

impl MigratePlan {
    pub async fn execute(self) -> eyre::Result<()> {
        let rpc = self.target.rpc();
        print_plan(&self.target.plan(&rpc).await?.view());
        Ok(())
    }
}

/// Create the proposals of a migration. v4: a vault transaction that creates the successor (if
/// needed) and one batch that moves the assets. v3: one v3 transaction with both. Members then
/// approve and run `migrate-execute`.
#[derive(Args)]
#[command(about = "Propose the move of a v4 vault or a v3 authority to its 4r successor")]
pub struct MigratePropose {
    #[command(flatten)]
    target: MigrateTarget,

    /// Path to the keypair of a member (v4: with Initiate permission; v3: it pays the rent of the v3 accounts)
    #[arg(long)]
    keypair: String,

    /// Path to the Fee Payer Keypair (v4: also pays the rent of the proposal accounts)
    #[arg(long)]
    fee_payer_keypair: Option<String>,

    /// Approve the proposals too (the member needs Vote permission)
    #[arg(long)]
    approve: bool,

    /// v4 only: put the item accounts in new address lookup tables (the member is their authority,
    /// the payer pays the rent): fewer, larger batch entries. Close them with migrate-lookup-tables.
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
        let plan = self.target.plan(&rpc).await?;
        print_plan(&plan.view());
        match plan {
            Plan::V4(plan) => self.propose_v4(&rpc, plan, &signers).await,
            Plan::V3(plan) => self.propose_v3(&rpc, plan, &signers).await,
        }
    }

    async fn propose_v4(
        &self,
        rpc: &RpcClient,
        plan: V4MigrationPlan,
        signers: &Signers,
    ) -> eyre::Result<()> {
        let (member, payer) = (signers.member.pubkey(), signers.payer());
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
                print_items("Batch items", &plan.items, plan.address_lookup_tables.len());
                println!();
                (plan, setup.transactions)
            }
            false => (plan, Vec::new()),
        };
        let proposal = v4_migration_proposal(rpc, &plan, &member, &payer, self.approve).await?;
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
        send_all(rpc, &tables, &signers.all(), &payer, fee, None, &[]).await?;
        send_all(
            rpc,
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

    /// One v3 transaction of the authority: create it, attach every instruction, activate it
    /// (and approve it). The member creates it and pays the rent of the v3 accounts.
    async fn propose_v3(
        &self,
        rpc: &RpcClient,
        plan: V3MigrationPlan,
        signers: &Signers,
    ) -> eyre::Result<()> {
        if plan.governance_matches == Some(false) {
            return Err(eyre!(
                "the successor governance differs from v3; make them equal first"
            ));
        }
        if self.lookup_tables {
            return Err(eyre!(
                "--lookup-tables is for v4 migrations; a v3 migration does not use lookup tables"
            ));
        }
        if plan.create_successor.is_none() && plan.items.is_empty() {
            println!("Nothing to propose.");
            return Ok(());
        }
        let member = signers.member.pubkey();
        let proposal = v3_migration_proposal(rpc, &plan, &member, self.approve).await?;
        let index = proposal.transaction_index;
        print_field("v3 program", LEGACY_V3_PROGRAM_ID);
        print_field(
            "v3 transaction",
            format!(
                "{index} of authority {} with {} instructions{}",
                plan.source.authority_index,
                proposal.instructions.len(),
                match plan.create_successor.is_some() {
                    true => " (the first creates the successor)",
                    false => "",
                }
            ),
        );
        println!("Transactions to send: {}", proposal.transactions.len());
        println!();
        if !self.yes && !confirm("Do you want to proceed?")? {
            println!("OK, aborting.");
            return Ok(());
        }

        send_all(
            rpc,
            &proposal.transactions,
            &signers.all(),
            &signers.payer(),
            self.priority_fee_lamports,
            None,
            &[],
        )
        .await?;
        println!("✅ Proposed. After the v3 approvals, run migrate-execute with:");
        println!("  --transaction-index {index}");
        Ok(())
    }
}

/// Run an approved v4 vault transaction (successor creation) or the remaining entries of an
/// approved v4 batch, or the remaining instructions of an approved v3 transaction, in order.
/// Stops at the first one that fails.
#[derive(Args)]
#[command(about = "Execute an approved v4 or v3 migration proposal")]
pub struct MigrateExecute {
    /// The v4 or v3 multisig
    #[arg(long)]
    multisig_pubkey: String,

    /// The v4 transaction index of the vault transaction or batch, or the v3 transaction index
    #[arg(long)]
    transaction_index: u64,

    /// RPC URL
    #[arg(long)]
    rpc_url: Option<String>,

    /// Path to the keypair of a member (v4: with Execute permission)
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
        let (executes, tables) = match fetch_lineage(&rpc, &multisig).await? {
            Lineage::V4 => self.v4_executes(&rpc, &multisig, &signers).await?,
            Lineage::V3 => (
                self.v3_executes(&rpc, &multisig, &signers).await?,
                Vec::new(),
            ),
        };
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

    /// The executions of a v4 vault transaction or batch, and the lookup tables they read.
    async fn v4_executes(
        &self,
        rpc: &RpcClient,
        multisig: &Pubkey,
        signers: &Signers,
    ) -> eyre::Result<(Vec<Instruction>, Vec<VaultLookupTable>)> {
        let (multisig, member) = (*multisig, signers.member.pubkey());
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
                    v4_vault_transaction_execute_instruction(rpc, &multisig, index, &member, &[])
                        .await?,
                ],
                Vec::new(),
            ),
            Some(d) if d == BATCH => {
                // The entries read their item accounts from the lookup tables in their messages.
                let tables = v4_batch_lookup_tables(rpc, &multisig, index).await?;
                let executes =
                    v4_batch_execute_instructions(rpc, &multisig, index, &member, &tables).await?;
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
        Ok((executes, tables))
    }

    /// The `execute_instruction` calls of a v3 transaction, from the first one that has not run.
    async fn v3_executes(
        &self,
        rpc: &RpcClient,
        multisig: &Pubkey,
        signers: &Signers,
    ) -> eyre::Result<Vec<Instruction>> {
        let index = u32::try_from(self.transaction_index)
            .map_err(|_| eyre!("a v3 transaction index is at most {}", u32::MAX))?;
        let transaction = fetch_v3_transaction(rpc, multisig, index).await?;
        println!();
        println!("v3 multisig:          {multisig}");
        println!("Transaction index:    {index}");
        println!(
            "Instructions run:     {} of {}",
            transaction.executed_index, transaction.instruction_index
        );
        match transaction.status {
            MsTransactionStatus::ExecuteReady => {
                Ok(v3_execute_instructions(rpc, multisig, index, &signers.member.pubkey()).await?)
            }
            MsTransactionStatus::Executed => Ok(Vec::new()),
            status => Err(eyre!(
                "v3 transaction {index} is {status:?}: it runs only after the v3 approvals"
            )),
        }
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
    use squads_multisig_4r::v3::LEGACY_V3_PROGRAM_ID;
    use squads_multisig_4r::LEGACY_V4_PROGRAM_ID;

    use super::{lineage_of, source_index, Lineage, SourceIndex};

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

    #[test]
    fn the_owner_program_sets_the_lineage() {
        // Act
        let lineages = [LEGACY_V4_PROGRAM_ID, LEGACY_V3_PROGRAM_ID, key(1)].map(|o| lineage_of(&o));

        // Assert
        assert_eq!(lineages, [Some(Lineage::V4), Some(Lineage::V3), None]);
    }

    #[test]
    fn each_lineage_takes_only_its_own_index_flag() {
        // Act
        let defaults = (
            source_index(Lineage::V4, None, None).ok(),
            source_index(Lineage::V3, None, None).ok(),
        );
        let given = (
            source_index(Lineage::V4, Some(3), None).ok(),
            source_index(Lineage::V3, None, Some(7)).ok(),
        );
        let refused = (
            source_index(Lineage::V4, None, Some(1)).is_err(),
            source_index(Lineage::V3, Some(0), None).is_err(),
        );

        // Assert
        assert_eq!(
            defaults,
            (
                Some(SourceIndex::V4Vault(0)),
                Some(SourceIndex::V3Authority(1))
            )
        );
        assert_eq!(
            given,
            (
                Some(SourceIndex::V4Vault(3)),
                Some(SourceIndex::V3Authority(7))
            )
        );
        assert_eq!(refused, (true, true));
    }
}
