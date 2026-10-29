//! `vote <op>`: propose vote account operations signed by a vault that is the
//! vote account's authorized withdrawer. One operation per proposal, like the solana CLI.

use clap::{ArgGroup, Args, Subcommand, ValueEnum};
use solana_sdk::instruction::{AccountMeta, Instruction};
use solana_sdk::pubkey::Pubkey;
use solana_vote_interface::instruction as vote_instruction;
use solana_vote_interface::state::VoteAuthorize;

use crate::command::transfer_common::parse_pubkey;
use crate::command::vault_proposal::{
    format_sol, parse_sol, Proposal, ProposalArgs, ProposalContext,
};

#[derive(Subcommand)]
pub enum VoteCommand {
    /// Withdraw SOL (rewards) from a vote account
    Withdraw(VoteWithdraw),
    /// Change a vote account's commission (percent)
    UpdateCommission(VoteUpdateCommission),
    /// Change a vote account's authorized voter or withdrawer
    Authorize(VoteAuthorizeCommand),
    /// Change a vote account's validator identity (the new identity co-signs at execution)
    UpdateIdentity(VoteUpdateIdentity),
    /// Change where inflation rewards or block revenue commission is paid (SIMD-0232)
    UpdateCommissionCollector(VoteUpdateCommissionCollector),
}

impl VoteCommand {
    pub async fn execute(self) -> eyre::Result<()> {
        match self {
            VoteCommand::Withdraw(command) => command.execute().await,
            VoteCommand::UpdateCommission(command) => command.execute().await,
            VoteCommand::Authorize(command) => command.execute().await,
            VoteCommand::UpdateIdentity(command) => command.execute().await,
            VoteCommand::UpdateCommissionCollector(command) => command.execute().await,
        }
    }
}

#[derive(Args)]
#[command(group(ArgGroup::new("withdraw_amount").required(true).args(["amount", "all", "close"])))]
pub struct VoteWithdraw {
    #[command(flatten)]
    proposal: ProposalArgs,

    /// The vote account to withdraw from
    #[arg(long)]
    vote_account: String,

    /// Where the SOL goes
    #[arg(long)]
    recipient: String,

    /// Amount in SOL
    #[arg(long)]
    amount: Option<String>,

    /// Withdraw everything above the rent-exempt minimum
    #[arg(long)]
    all: bool,

    /// Withdraw the full balance, closing the vote account
    #[arg(long)]
    close: bool,
}

impl VoteWithdraw {
    async fn execute(self) -> eyre::Result<()> {
        let ctx = self.proposal.into_context().await?;
        let vote_account = parse_pubkey("vote account", &self.vote_account)?;
        let recipient = parse_pubkey("recipient", &self.recipient)?;
        let account = fetch_vote_account(&ctx, &vote_account).await?;

        let rent = ctx
            .rpc_client
            .get_minimum_balance_for_rent_exemption(account.data_len)
            .await?;
        let lamports = if let Some(amount) = &self.amount {
            parse_sol(amount)?
        } else if self.all {
            account.lamports.saturating_sub(rent)
        } else {
            account.lamports
        };
        if lamports == 0 {
            return Err(eyre::eyre!("Nothing to withdraw from {}", vote_account));
        }
        check_withdraw_amount(lamports, account.lamports, rent)?;

        let mut details = vec![
            ("Vote Account".to_string(), vote_account.to_string()),
            ("Recipient".to_string(), ctx.vaults.label(&recipient)),
            ("Amount".to_string(), format_sol(lamports)),
            (
                "Vote Account Balance".to_string(),
                format_sol(account.lamports),
            ),
        ];
        if lamports == account.lamports {
            details.push(("Closes Vote Account".to_string(), "yes".to_string()));
        }

        ctx.propose(Proposal {
            action: "withdraw from a vote account".to_string(),
            details,
            instructions: vec![vote_instruction::withdraw(
                &vote_account,
                &ctx.vault,
                lamports,
                &recipient,
            )],
            ephemeral_signers: 0,
            warnings: vec![],
            next_steps: None,
        })
        .await
    }
}

#[derive(Args)]
pub struct VoteUpdateCommission {
    #[command(flatten)]
    proposal: ProposalArgs,

    /// The vote account to update
    #[arg(long)]
    vote_account: String,

    /// New commission, in percent (0-100)
    #[arg(long, value_parser = clap::value_parser!(u8).range(0..=100))]
    commission: u8,
}

impl VoteUpdateCommission {
    async fn execute(self) -> eyre::Result<()> {
        let ctx = self.proposal.into_context().await?;
        let vote_account = parse_pubkey("vote account", &self.vote_account)?;
        fetch_vote_account(&ctx, &vote_account).await?;

        ctx.propose(Proposal {
            action: "update a vote account's commission".to_string(),
            details: vec![
                ("Vote Account".to_string(), vote_account.to_string()),
                (
                    "New Commission".to_string(),
                    format!("{}%", self.commission),
                ),
            ],
            instructions: vec![vote_instruction::update_commission(
                &vote_account,
                &ctx.vault,
                self.commission,
            )],
            ephemeral_signers: 0,
            warnings: vec![],
            next_steps: None,
        })
        .await
    }
}

#[derive(Clone, Copy, ValueEnum)]
pub enum VoteAuthorityType {
    Voter,
    Withdrawer,
}

#[derive(Args)]
pub struct VoteAuthorizeCommand {
    #[command(flatten)]
    proposal: ProposalArgs,

    /// The vote account to update
    #[arg(long)]
    vote_account: String,

    /// Which authority to change
    #[arg(long, value_enum)]
    authority_type: VoteAuthorityType,

    /// The new authority
    #[arg(long)]
    new_authority: String,
}

impl VoteAuthorizeCommand {
    async fn execute(self) -> eyre::Result<()> {
        let ctx = self.proposal.into_context().await?;
        let vote_account = parse_pubkey("vote account", &self.vote_account)?;
        let new_authority = parse_pubkey("new authority", &self.new_authority)?;
        let account = fetch_vote_account(&ctx, &vote_account).await?;

        if matches!(self.authority_type, VoteAuthorityType::Voter) && account.has_bls_pubkey {
            return Err(eyre::eyre!(
                "Vote account {} has a BLS public key, so the vote program rejects a plain voter \
                 change (SIMD-0387): the new voter's BLS key and proof of possession are required, \
                 which this command does not support yet. The current voter can rotate itself with \
                 `solana vote-authorize-voter-checked {} <CURRENT_VOTER_KEYPAIR> <NEW_VOTER_KEYPAIR>`.",
                vote_account,
                vote_account
            ));
        }

        let (vote_authorize, role) = match self.authority_type {
            VoteAuthorityType::Voter => (VoteAuthorize::Voter, "voter"),
            VoteAuthorityType::Withdrawer => (VoteAuthorize::Withdrawer, "withdrawer"),
        };

        let mut warnings = vec![];
        if matches!(self.authority_type, VoteAuthorityType::Withdrawer)
            && ctx.vaults.index_of(&new_authority).is_none()
        {
            warnings.push(format!(
                "The new withdrawer {} is not a vault of this multisig. Once executed, the multisig \
                 can no longer withdraw from, or change, this vote account.",
                new_authority
            ));
        }

        ctx.propose(Proposal {
            action: format!("change a vote account's {}", role),
            details: vec![
                ("Vote Account".to_string(), vote_account.to_string()),
                ("Authority Type".to_string(), role.to_string()),
                (
                    "New Authority".to_string(),
                    ctx.vaults.label(&new_authority),
                ),
            ],
            instructions: vec![vote_instruction::authorize(
                &vote_account,
                &ctx.vault,
                &new_authority,
                vote_authorize,
            )],
            ephemeral_signers: 0,
            warnings,
            next_steps: None,
        })
        .await
    }
}

#[derive(Args)]
pub struct VoteUpdateIdentity {
    #[command(flatten)]
    proposal: ProposalArgs,

    /// The vote account to update
    #[arg(long)]
    vote_account: String,

    /// The new validator identity. It must co-sign when the proposal is executed.
    #[arg(long)]
    new_identity: String,
}

impl VoteUpdateIdentity {
    async fn execute(self) -> eyre::Result<()> {
        let ctx = self.proposal.into_context().await?;
        let vote_account = parse_pubkey("vote account", &self.vote_account)?;
        let new_identity = parse_pubkey("new identity", &self.new_identity)?;
        let account = fetch_vote_account(&ctx, &vote_account).await?;

        ctx.propose(Proposal {
            action: "change a vote account's validator identity".to_string(),
            details: vec![
                ("Vote Account".to_string(), vote_account.to_string()),
                (
                    "Current Identity".to_string(),
                    account.node_pubkey.to_string(),
                ),
                ("New Identity".to_string(), new_identity.to_string()),
            ],
            instructions: vec![vote_instruction::update_validator_identity(
                &vote_account,
                &ctx.vault,
                &new_identity,
            )],
            ephemeral_signers: 0,
            warnings: vec![],
            next_steps: Some(format!(
                "The new identity {} must co-sign the execution: run vault-transaction-execute \
                 with --extra-keypair <path to the new identity keypair>.",
                new_identity
            )),
        })
        .await
    }
}

#[derive(Clone, Copy, ValueEnum)]
pub enum CommissionKind {
    InflationRewards,
    BlockRevenue,
}

impl CommissionKind {
    fn label(self) -> &'static str {
        match self {
            CommissionKind::InflationRewards => "inflation rewards",
            CommissionKind::BlockRevenue => "block revenue",
        }
    }
}

#[derive(Args)]
pub struct VoteUpdateCommissionCollector {
    #[command(flatten)]
    proposal: ProposalArgs,

    /// The vote account to update
    #[arg(long)]
    vote_account: String,

    /// Which commission collector to change
    #[arg(long, value_enum)]
    kind: CommissionKind,

    /// The new collector: the vote account itself, or an existing rent-exempt system account
    #[arg(long)]
    collector: String,
}

impl VoteUpdateCommissionCollector {
    async fn execute(self) -> eyre::Result<()> {
        let ctx = self.proposal.into_context().await?;
        let vote_account = parse_pubkey("vote account", &self.vote_account)?;
        let collector = parse_pubkey("collector", &self.collector)?;
        fetch_vote_account(&ctx, &vote_account).await?;

        if collector != vote_account {
            let account = ctx.get_account(&collector).await?.ok_or_else(|| {
                eyre::eyre!(
                    "Collector {} does not exist. It must be the vote account itself or an \
                         existing rent-exempt system account.",
                    collector
                )
            })?;
            let rent = ctx
                .rpc_client
                .get_minimum_balance_for_rent_exemption(account.data.len())
                .await?;
            if account.owner != solana_sdk::system_program::id() || account.lamports < rent {
                return Err(eyre::eyre!(
                    "Collector {} must be the vote account itself or a rent-exempt account owned \
                     by the system program (owner: {}, balance: {}).",
                    collector,
                    account.owner,
                    format_sol(account.lamports)
                ));
            }
        }

        let mut warnings = vec![];
        if collector != vote_account && ctx.vaults.index_of(&collector).is_none() {
            warnings.push(format!(
                "The new {} collector {} is neither the vote account nor a vault of this \
                 multisig. Once executed, that commission is paid outside the multisig.",
                self.kind.label(),
                collector
            ));
        }

        ctx.propose(Proposal {
            action: format!("change a vote account's {} collector", self.kind.label()),
            details: vec![
                ("Vote Account".to_string(), vote_account.to_string()),
                ("Commission Kind".to_string(), self.kind.label().to_string()),
                ("New Collector".to_string(), ctx.vaults.label(&collector)),
            ],
            instructions: vec![update_commission_collector(
                &vote_account,
                &ctx.vault,
                &collector,
                self.kind,
            )],
            ephemeral_signers: 0,
            warnings,
            next_steps: None,
        })
        .await
    }
}

/// Vote instruction 17, `UpdateCommissionCollector(CommissionKind)` (SIMD-0232).
/// Not in solana-vote-interface 2.x; same data and metas as `update_commission_collector` in
/// solana-vote-interface 6 (variant 17, `CommissionKind` InflationRewards = 0, BlockRevenue = 1).
pub fn update_commission_collector(
    vote_account: &Pubkey,
    authorized_withdrawer: &Pubkey,
    collector: &Pubkey,
    kind: CommissionKind,
) -> Instruction {
    let kind = match kind {
        CommissionKind::InflationRewards => 0u8,
        CommissionKind::BlockRevenue => 1u8,
    };
    Instruction {
        program_id: solana_vote_interface::program::id(),
        accounts: vec![
            AccountMeta::new(*vote_account, false),
            AccountMeta::new(*collector, false),
            AccountMeta::new_readonly(*authorized_withdrawer, true),
        ],
        data: vec![17, 0, 0, 0, kind, 0, 0, 0],
    }
}

struct VoteAccountInfo {
    node_pubkey: Pubkey,
    has_bls_pubkey: bool,
    lamports: u64,
    data_len: usize,
}

/// The fields of a vote account the commands need.
#[derive(Debug, PartialEq)]
pub struct VoteAccountState {
    pub node_pubkey: Pubkey,
    pub authorized_withdrawer: Pubkey,
    /// Set on `VoteStateV4` accounts that registered a BLS key (SIMD-0387).
    pub has_bls_pubkey: bool,
}

/// Reads a vote account by offset, because solana-vote-interface 2.x cannot deserialize
/// `VoteStateV4`. The prefix (u32 version, node_pubkey, authorized_withdrawer) is the same
/// in V1_14_11 (1), V3 (2) and V4 (3). V4 then has the inflation rewards and block revenue
/// collectors, two u16 commissions and a u64, so its `Option` BLS key tag is at byte 144.
pub fn parse_vote_account(data: &[u8]) -> eyre::Result<VoteAccountState> {
    if data.len() < 68 {
        return Err(eyre::eyre!("Vote account data is too short"));
    }
    let version = u32::from_le_bytes(data[0..4].try_into().unwrap());
    if !(1..=3).contains(&version) {
        return Err(eyre::eyre!("Unsupported vote account version {}", version));
    }
    let has_bls_pubkey = match version {
        3 => {
            *data
                .get(144)
                .ok_or_else(|| eyre::eyre!("Vote account data is too short"))?
                == 1
        }
        _ => false,
    };
    Ok(VoteAccountState {
        node_pubkey: Pubkey::try_from(&data[4..36]).unwrap(),
        authorized_withdrawer: Pubkey::try_from(&data[36..68]).unwrap(),
        has_bls_pubkey,
    })
}

/// Fetches a vote account and checks that the vault is its authorized withdrawer.
async fn fetch_vote_account(
    ctx: &ProposalContext,
    vote_account: &Pubkey,
) -> eyre::Result<VoteAccountInfo> {
    let account = ctx
        .get_account(vote_account)
        .await?
        .ok_or_else(|| eyre::eyre!("Vote account {} not found", vote_account))?;
    let state = check_vote_account(
        vote_account,
        &account.owner,
        &account.data,
        &ctx.vault,
        ctx.vault_index,
    )?;
    Ok(VoteAccountInfo {
        node_pubkey: state.node_pubkey,
        has_bls_pubkey: state.has_bls_pubkey,
        lamports: account.lamports,
        data_len: account.data.len(),
    })
}

/// The vote program only allows a withdrawal that leaves the account rent-exempt or empty.
fn check_withdraw_amount(lamports: u64, balance: u64, rent: u64) -> eyre::Result<()> {
    if lamports > balance {
        return Err(eyre::eyre!(
            "Cannot withdraw {}: the vote account holds {}",
            format_sol(lamports),
            format_sol(balance)
        ));
    }
    let remaining = balance - lamports;
    if remaining > 0 && remaining < rent {
        return Err(eyre::eyre!(
            "Withdrawing {} would leave {}, below the rent-exempt minimum of {}. Use --all to \
             keep the minimum, or --close to withdraw everything.",
            format_sol(lamports),
            format_sol(remaining),
            format_sol(rent)
        ));
    }
    Ok(())
}

/// Parses a vote account and checks that the vault is its authorized withdrawer.
fn check_vote_account(
    vote_account: &Pubkey,
    owner: &Pubkey,
    data: &[u8],
    vault: &Pubkey,
    vault_index: u8,
) -> eyre::Result<VoteAccountState> {
    if *owner != solana_vote_interface::program::id() {
        return Err(eyre::eyre!(
            "{} is not a vote account (owner: {})",
            vote_account,
            owner
        ));
    }
    let state = parse_vote_account(data)?;
    if state.authorized_withdrawer != *vault {
        return Err(eyre::eyre!(
            "Vault {} (index {}) is not the authorized withdrawer of vote account {}; the \
             withdrawer is {}.",
            vault,
            vault_index,
            vote_account,
            state.authorized_withdrawer
        ));
    }
    Ok(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn update_commission_collector_matches_simd_0232() {
        let vote = Pubkey::new_unique();
        let withdrawer = Pubkey::new_unique();
        let collector = Pubkey::new_unique();

        let ix = update_commission_collector(
            &vote,
            &withdrawer,
            &collector,
            CommissionKind::BlockRevenue,
        );
        assert_eq!(ix.program_id, solana_vote_interface::program::id());
        assert_eq!(ix.data, vec![17, 0, 0, 0, 1, 0, 0, 0]);
        assert_eq!(
            ix.accounts,
            vec![
                AccountMeta::new(vote, false),
                AccountMeta::new(collector, false),
                AccountMeta::new_readonly(withdrawer, true),
            ]
        );

        let ix = update_commission_collector(
            &vote,
            &withdrawer,
            &collector,
            CommissionKind::InflationRewards,
        );
        assert_eq!(ix.data, vec![17, 0, 0, 0, 0, 0, 0, 0]);
    }

    fn vote_account_data(version: u32, node: &Pubkey, withdrawer: &Pubkey) -> Vec<u8> {
        let mut data = version.to_le_bytes().to_vec();
        data.extend_from_slice(node.as_ref());
        data.extend_from_slice(withdrawer.as_ref());
        data.resize(3762, 0);
        data
    }

    #[test]
    fn parse_vote_account_reads_v1_v3_and_v4() {
        let node = Pubkey::new_unique();
        let withdrawer = Pubkey::new_unique();
        for version in 1..=3 {
            let data = vote_account_data(version, &node, &withdrawer);
            assert_eq!(
                parse_vote_account(&data).unwrap(),
                VoteAccountState {
                    node_pubkey: node,
                    authorized_withdrawer: withdrawer,
                    has_bls_pubkey: false,
                }
            );
        }
    }

    /// The first 193 bytes of a real `VoteStateV4` account (created by solana CLI 4.3 on
    /// solana-test-validator, so it carries a BLS key), after an identity change and with the
    /// block revenue collector set to a vault.
    const V4_ACCOUNT_PREFIX: &str = "03000000d05f8abd03b59764f3c4d964a67f0987336e94646be9901890017cd9fa0fcb4a9f9401d408389f43f0aa8bd41aa555bc77575d793f6d5b51062d45af2b7b6f79f4e04af402fc8fd0b9baff4be886724bbd85b7a275431efe1e6e9a59406024239f9401d408389f43f0aa8bd41aa555bc77575d793f6d5b51062d45af2b7b6f792c011027000000000000000001b46aeaea3f9ce88ad316bd6da7e94bb6ebb2445592895d65569404d6587515e3baf09ac287a0772d4b07e677fda5558c";

    fn hex(s: &str) -> Vec<u8> {
        (0..s.len())
            .step_by(2)
            .map(|i| u8::from_str_radix(&s[i..i + 2], 16).unwrap())
            .collect()
    }

    #[test]
    fn parse_vote_account_reads_a_real_v4_account() {
        let state = parse_vote_account(&hex(V4_ACCOUNT_PREFIX)).unwrap();
        assert_eq!(
            state.node_pubkey.to_string(),
            "F2QJLZ9tBKT1vAs8pRs6WupW5As9uuzpknk3Au7dpZ9b"
        );
        assert_eq!(
            state.authorized_withdrawer.to_string(),
            "BjvitWuqmZCcpmVKnoeWWvtCEPevfL4dqwqEaZ4RsKQC"
        );
        assert!(state.has_bls_pubkey);
    }

    #[test]
    fn parse_vote_account_detects_v4_bls_pubkey() {
        let node = Pubkey::new_unique();
        let withdrawer = Pubkey::new_unique();
        let mut data = vote_account_data(3, &node, &withdrawer);
        assert!(!parse_vote_account(&data).unwrap().has_bls_pubkey);
        data[144] = 1;
        assert!(parse_vote_account(&data).unwrap().has_bls_pubkey);

        // Byte 144 of a V3 account is vote history, not a BLS tag.
        let mut data = vote_account_data(2, &node, &withdrawer);
        data[144] = 1;
        assert!(!parse_vote_account(&data).unwrap().has_bls_pubkey);
    }

    #[test]
    fn parse_vote_account_matches_serialized_v3_state() {
        use solana_vote_interface::state::{VoteInit, VoteState, VoteStateVersions};

        let node = Pubkey::new_unique();
        let withdrawer = Pubkey::new_unique();
        let state = VoteState::new(
            &VoteInit {
                node_pubkey: node,
                authorized_voter: Pubkey::new_unique(),
                authorized_withdrawer: withdrawer,
                commission: 5,
            },
            &Default::default(),
        );
        let data = bincode::serialize(&VoteStateVersions::new_current(state)).unwrap();
        let parsed = parse_vote_account(&data).unwrap();
        assert_eq!(parsed.node_pubkey, node);
        assert_eq!(parsed.authorized_withdrawer, withdrawer);
    }

    #[test]
    fn parse_vote_account_rejects_old_or_short_data() {
        let node = Pubkey::new_unique();
        let withdrawer = Pubkey::new_unique();
        assert!(parse_vote_account(&vote_account_data(0, &node, &withdrawer)).is_err());
        assert!(parse_vote_account(&vote_account_data(4, &node, &withdrawer)).is_err());
        assert!(parse_vote_account(&[1, 0, 0, 0]).is_err());
    }

    #[test]
    fn check_vote_account_requires_the_vault_as_withdrawer() {
        let vote = Pubkey::new_unique();
        let vault = Pubkey::new_unique();
        let vote_program = solana_vote_interface::program::id();
        let data = vote_account_data(3, &Pubkey::new_unique(), &vault);

        assert!(check_vote_account(&vote, &vote_program, &data, &vault, 0).is_ok());

        let other_vault = Pubkey::new_unique();
        let err = check_vote_account(&vote, &vote_program, &data, &other_vault, 1).unwrap_err();
        assert!(err.to_string().contains("is not the authorized withdrawer"));

        let err = check_vote_account(&vote, &solana_sdk::system_program::id(), &data, &vault, 0)
            .unwrap_err();
        assert!(err.to_string().contains("is not a vote account"));
    }

    #[test]
    fn check_withdraw_amount_keeps_the_account_rent_exempt_or_empty() {
        let (balance, rent) = (10_000_000, 2_000_000);
        assert!(check_withdraw_amount(8_000_000, balance, rent).is_ok());
        assert!(check_withdraw_amount(10_000_000, balance, rent).is_ok());
        assert!(check_withdraw_amount(8_000_001, balance, rent).is_err());
        assert!(check_withdraw_amount(10_000_001, balance, rent).is_err());
    }
}
