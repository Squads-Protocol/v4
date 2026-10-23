//! Events. The program emits each one as the data of a self-CPI to `log_event`, signed by the
//! `Multisig` (or `ProgramConfig`) PDA. Events are opt-in: the client appends the program ID as a
//! trailing read-only account ([`crate::builders::with_events`]). Decode with [`decode_log_event`].

use std::borrow::Cow;

use solana_address::Address;

use crate::discriminator::{account, instruction::LOG_EVENT};
use crate::error::{CoreError, CoreResult};
use crate::instructions::TokenAuthorityKind;
use crate::prelude::*;
use crate::state::{
    Batch, ConfigAction, ConfigTransaction, Multisig, ProgramConfig, Proposal, SpendingLimit,
    VaultBatchTransaction, VaultTransaction,
};

/// The CPI instruction-data limit of the runtime. Longer events drop their snapshots.
pub const MAX_LOG_EVENT_DATA_LEN: usize = 10 * 1024;

/// The account discriminators that `log_event` accepts for its signer.
pub const LOG_AUTHORITY_DISCRIMINATORS: [[u8; 8]; 2] = [account::MULTISIG, account::PROGRAM_CONFIG];

/// Variants are append-only: the borsh tag is the variant index. Snapshots and contents are
/// `Cow`: the program borrows the accounts (no copy, no heap), decoding gives owned values.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum MultisigEvent<'a> {
    ProgramConfig(ProgramConfigEvent<'a>),
    MultisigCreate(MultisigCreateEvent<'a>),
    MultisigConfig(MultisigConfigEvent<'a>),
    ConfigAuthorityChange(ConfigAuthorityChangeEvent<'a>),
    SpendingLimit(SpendingLimitEvent<'a>),
    SpendingLimitUse(SpendingLimitUseEvent<'a>),
    Transaction(TransactionEvent<'a>),
    BatchTransaction(BatchTransactionEvent<'a>),
    Proposal(ProposalEvent<'a>),
    Migration(MigrationEvent<'a>),
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProgramConfigEventKind {
    Init,
    SetAuthority,
    SetMultisigCreationFee,
    SetTreasury,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProgramConfigEvent<'a> {
    pub kind: ProgramConfigEventKind,
    pub program_config: Address,
    pub authority: Address,
    pub snapshot: Cow<'a, ProgramConfig>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct MultisigCreateEvent<'a> {
    pub multisig: Address,
    pub create_key: Address,
    pub creator: Address,
    pub memo: Option<String>,
    pub snapshot: Option<Cow<'a, Multisig>>,
}

/// Who made a config change: the `config_authority` directly, or an executed config transaction.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum ConfigSource {
    ConfigAuthority {
        authority: Address,
    },
    ConfigTransaction {
        transaction: Address,
        transaction_index: u64,
    },
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct MultisigConfigEvent<'a> {
    pub multisig: Address,
    pub source: ConfigSource,
    pub actions: Cow<'a, [ConfigAction]>,
    pub memo: Option<String>,
    pub snapshot: Option<Cow<'a, Multisig>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ConfigAuthorityChangeEvent<'a> {
    pub multisig: Address,
    pub authority: Address,
    pub new_config_authority: Address,
    pub memo: Option<String>,
    pub snapshot: Option<Cow<'a, Multisig>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpendingLimitEventKind {
    Add,
    Remove,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SpendingLimitEvent<'a> {
    pub kind: SpendingLimitEventKind,
    pub multisig: Address,
    pub spending_limit: Address,
    pub source: ConfigSource,
    pub memo: Option<String>,
    pub snapshot: Option<Cow<'a, SpendingLimit>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct SpendingLimitUseEvent<'a> {
    pub multisig: Address,
    pub spending_limit: Address,
    pub member: Address,
    pub vault: Address,
    pub destination: Address,
    /// `None` for SOL.
    pub mint: Option<Address>,
    pub decimals: u8,
    pub amount: u64,
    pub memo: Option<String>,
    pub snapshot: Option<Cow<'a, SpendingLimit>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum TransactionEventKind {
    Create,
    Execute,
    Close,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum TransactionContent<'a> {
    Vault(Cow<'a, VaultTransaction>),
    Config(Cow<'a, ConfigTransaction>),
    Batch(Cow<'a, Batch>),
}

/// A vault transaction, config transaction or batch.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct TransactionEvent<'a> {
    pub kind: TransactionEventKind,
    pub multisig: Address,
    pub transaction: Address,
    pub transaction_index: u64,
    pub member: Option<Address>,
    pub memo: Option<String>,
    pub content: Option<TransactionContent<'a>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum BatchTransactionEventKind {
    Add,
    Execute,
    Close,
}

/// A transaction inside a batch.
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct BatchTransactionEvent<'a> {
    pub kind: BatchTransactionEventKind,
    pub multisig: Address,
    pub batch: Address,
    pub transaction: Address,
    pub batch_index: u64,
    pub transaction_index: u32,
    pub member: Option<Address>,
    pub snapshot: Option<Cow<'a, VaultBatchTransaction>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ProposalEventKind {
    Create,
    Activate,
    Approve,
    Reject,
    Cancel,
    Execute,
    Close,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct ProposalEvent<'a> {
    pub kind: ProposalEventKind,
    pub multisig: Address,
    pub proposal: Address,
    pub transaction_index: u64,
    pub member: Option<Address>,
    pub memo: Option<String>,
    pub snapshot: Option<Cow<'a, Proposal>>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MigrationAssetKind {
    Sol,
    Token,
    TokenAuthority(TokenAuthorityKind),
    StakeStaker,
    StakeWithdrawer,
    VoteWithdrawer,
    UpgradeAuthority,
    StakeCustodian,
}

/// The `multisig_migrate_*` instruction that emitted a `Migration` event.
#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MigrationScope {
    Sol,
    Tokens,
    TokenAuthorities,
    Stakes,
    VoteAccounts,
    Programs,
}

/// Why a `multisig_migrate_*` instruction moved nothing for an asset. A skip is not an error.
#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MigrationSkipReason {
    /// Zero balance (or zero after `keep`).
    Empty,
    /// The account does not exist, or has another owner program or layout.
    Missing,
    /// The v4 vault does not hold the authority (for example, it moved already).
    NotAuthority,
    /// The source or destination token account is frozen.
    Frozen,
    /// A stake lockup is in force, so the withdrawer cannot change.
    Locked,
    /// The asset cannot move through a CPI (transfer hook, non-transferable or paused mint).
    Unsupported,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum MigrationResult {
    /// `amount` is 0 for authorities. `closed`: the source token account was closed.
    Moved {
        amount: u64,
        closed: bool,
    },
    Skipped(MigrationSkipReason),
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct MigrationOutcome {
    pub kind: MigrationAssetKind,
    /// The source token account, mint, stake, vote or program data account; the v4 vault for SOL.
    pub account: Address,
    pub result: MigrationResult,
}

/// One `multisig_migrate_*` call from the v4 `source_vault` to the successor `vault`, one outcome
/// per asset (two for stake: staker and withdrawer).
#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct MigrationEvent<'a> {
    pub scope: MigrationScope,
    pub multisig: Address,
    pub source_multisig: Address,
    pub vault_index: u8,
    pub source_vault: Address,
    pub vault: Address,
    pub outcomes: Cow<'a, [MigrationOutcome]>,
    pub memo: Option<String>,
}

impl MultisigEvent<'_> {
    /// The account that signs this event's `log_event`: the program config for
    /// `ProgramConfig` events, the multisig for all others.
    pub fn authority(&self) -> Address {
        match self {
            Self::ProgramConfig(event) => event.program_config,
            Self::MultisigCreate(event) => event.multisig,
            Self::MultisigConfig(event) => event.multisig,
            Self::ConfigAuthorityChange(event) => event.multisig,
            Self::SpendingLimit(event) => event.multisig,
            Self::SpendingLimitUse(event) => event.multisig,
            Self::Transaction(event) => event.multisig,
            Self::BatchTransaction(event) => event.multisig,
            Self::Proposal(event) => event.multisig,
            Self::Migration(event) => event.multisig,
        }
    }

    /// The same event with every snapshot and transaction content set to `None`. It copies only
    /// the small fields, so an oversized event is not copied a second time.
    pub fn without_snapshots(&self) -> Self {
        match self {
            Self::ProgramConfig(event) => Self::ProgramConfig(event.clone()),
            Self::MultisigCreate(event) => Self::MultisigCreate(MultisigCreateEvent {
                multisig: event.multisig,
                create_key: event.create_key,
                creator: event.creator,
                memo: event.memo.clone(),
                snapshot: None,
            }),
            Self::MultisigConfig(event) => Self::MultisigConfig(MultisigConfigEvent {
                multisig: event.multisig,
                source: event.source.clone(),
                actions: event.actions.clone(),
                memo: event.memo.clone(),
                snapshot: None,
            }),
            Self::ConfigAuthorityChange(event) => {
                Self::ConfigAuthorityChange(ConfigAuthorityChangeEvent {
                    multisig: event.multisig,
                    authority: event.authority,
                    new_config_authority: event.new_config_authority,
                    memo: event.memo.clone(),
                    snapshot: None,
                })
            }
            Self::SpendingLimit(event) => Self::SpendingLimit(SpendingLimitEvent {
                kind: event.kind,
                multisig: event.multisig,
                spending_limit: event.spending_limit,
                source: event.source.clone(),
                memo: event.memo.clone(),
                snapshot: None,
            }),
            Self::SpendingLimitUse(event) => Self::SpendingLimitUse(SpendingLimitUseEvent {
                multisig: event.multisig,
                spending_limit: event.spending_limit,
                member: event.member,
                vault: event.vault,
                destination: event.destination,
                mint: event.mint,
                decimals: event.decimals,
                amount: event.amount,
                memo: event.memo.clone(),
                snapshot: None,
            }),
            Self::Transaction(event) => Self::Transaction(TransactionEvent {
                kind: event.kind,
                multisig: event.multisig,
                transaction: event.transaction,
                transaction_index: event.transaction_index,
                member: event.member,
                memo: event.memo.clone(),
                content: None,
            }),
            Self::BatchTransaction(event) => Self::BatchTransaction(BatchTransactionEvent {
                kind: event.kind,
                multisig: event.multisig,
                batch: event.batch,
                transaction: event.transaction,
                batch_index: event.batch_index,
                transaction_index: event.transaction_index,
                member: event.member,
                snapshot: None,
            }),
            Self::Proposal(event) => Self::Proposal(ProposalEvent {
                kind: event.kind,
                multisig: event.multisig,
                proposal: event.proposal,
                transaction_index: event.transaction_index,
                member: event.member,
                memo: event.memo.clone(),
                snapshot: None,
            }),
            Self::Migration(event) => Self::Migration(event.clone()),
        }
    }
}

/// The `log_event` instruction data for `event`. If it is longer than
/// [`MAX_LOG_EVENT_DATA_LEN`], the snapshots are dropped so that the CPI does not fail.
pub fn log_event_data(event: &MultisigEvent<'_>) -> CoreResult<Vec<u8>> {
    let length = event_length(event)?;
    match LOG_EVENT_HEADER_LEN + length <= MAX_LOG_EVENT_DATA_LEN {
        true => encode_log_event(event, length),
        false => {
            let event = event.without_snapshots();
            encode_log_event(&event, event_length(&event)?)
        }
    }
}

/// Decodes `log_event` instruction data. Returns `None` for other instructions. The caller
/// checks that the inner instruction's program ID is the multisig program.
pub fn decode_log_event(data: &[u8]) -> CoreResult<Option<MultisigEvent<'static>>> {
    let Some(args) = data.strip_prefix(LOG_EVENT.as_slice()) else {
        return Ok(None);
    };
    crate::instructions::LogEventArgs::try_from_slice(args)
        .and_then(|args| MultisigEvent::try_from_slice(&args.event))
        .map(Some)
        .map_err(|_| CoreError::InvalidEventData)
}

/// Decodes an inner instruction for indexers. Returns `None` unless it is `log_event` of
/// `program_id`. Fails if its signer (`accounts[0]`) is not the event's [`MultisigEvent::authority`].
pub fn decode_verified_log_event(
    program_id: &Address,
    instruction_program_id: &Address,
    accounts: &[Address],
    data: &[u8],
) -> CoreResult<Option<MultisigEvent<'static>>> {
    if instruction_program_id != program_id {
        return Ok(None);
    }
    decode_log_event(data)?
        .map(|event| match accounts.first() == Some(&event.authority()) {
            true => Ok(event),
            false => Err(CoreError::EventAuthorityMismatch),
        })
        .transpose()
}

/// True if `data` starts with a discriminator of an account that may sign `log_event`.
pub fn is_log_authority_data(data: &[u8]) -> bool {
    data.get(..8).is_some_and(|discriminator| {
        LOG_AUTHORITY_DISCRIMINATORS
            .iter()
            .any(|d| d == discriminator)
    })
}

/// True if an instruction calls `log_event` of `program_id`. Vault execution rejects such calls.
pub fn is_log_event_call(
    instruction_program_id: &Address,
    data: &[u8],
    program_id: &Address,
) -> bool {
    instruction_program_id == program_id && data.starts_with(&LOG_EVENT)
}

/// Splits off the event account of `vault_transaction_execute` and `batch_execute_transaction`:
/// one extra trailing account with the key `program_id`. Returns the other accounts and whether
/// events are enabled (the program ID is among the instruction's accounts).
pub fn split_event_account<'a, T>(
    accounts: &'a [T],
    expected: usize,
    program_id: &Address,
    key: impl Fn(&T) -> &Address,
) -> (&'a [T], bool) {
    match accounts.split_last() {
        Some((last, rest)) if rest.len() == expected && key(last) == program_id => (rest, true),
        _ => (
            accounts,
            accounts.iter().any(|account| key(account) == program_id),
        ),
    }
}

/// Discriminator and `u32` length prefix of the `event` bytes.
const LOG_EVENT_HEADER_LEN: usize = 8 + 4;

fn serialization(error: borsh::io::Error) -> CoreError {
    CoreError::Serialization(error.kind())
}

fn event_length(event: &MultisigEvent<'_>) -> CoreResult<usize> {
    borsh::object_length(event).map_err(serialization)
}

// One allocation of the exact size: the program heap is a bump allocator that never frees.
fn encode_log_event(event: &MultisigEvent<'_>, length: usize) -> CoreResult<Vec<u8>> {
    let prefix = u32::try_from(length)
        .map_err(|_| CoreError::Serialization(borsh::io::ErrorKind::InvalidData))?;
    let mut data = Vec::with_capacity(LOG_EVENT_HEADER_LEN + length);
    data.extend_from_slice(&LOG_EVENT);
    data.extend_from_slice(&prefix.to_le_bytes());
    event.serialize(&mut data).map_err(serialization)?;
    Ok(data)
}

#[cfg(feature = "program")]
pub use emit::*;

#[cfg(feature = "program")]
mod emit {
    use std::borrow::Cow;

    use anchor_lang::prelude::*;
    use anchor_lang::solana_program::instruction::Instruction;
    use anchor_lang::solana_program::program::invoke_signed;

    use super::{log_event_data, MultisigEvent, ProposalEvent, ProposalEventKind};
    use crate::state::{
        Multisig, ProgramConfig, Proposal, SEED_MULTISIG, SEED_PREFIX, SEED_PROGRAM_CONFIG,
    };

    /// True if the 4r program ID is among the instruction's extra accounts.
    pub fn enabled(remaining_accounts: &[AccountInfo]) -> bool {
        remaining_accounts
            .iter()
            .any(|account| account.key == &crate::ID)
    }

    /// The PDA that signs `log_event`.
    pub enum LogAuthority<'info> {
        Multisig {
            info: AccountInfo<'info>,
            create_key: Pubkey,
            bump: u8,
        },
        ProgramConfig {
            info: AccountInfo<'info>,
            bump: u8,
        },
    }

    impl<'info> LogAuthority<'info> {
        pub fn multisig(multisig: &Account<'info, Multisig>) -> Self {
            Self::Multisig {
                info: multisig.to_account_info(),
                create_key: multisig.create_key,
                bump: multisig.bump,
            }
        }

        pub fn program_config(program_config: &Account<'info, ProgramConfig>, bump: u8) -> Self {
            Self::ProgramConfig {
                info: program_config.to_account_info(),
                bump,
            }
        }

        fn log(&self, event: &MultisigEvent<'_>) -> Result<()> {
            let data =
                log_event_data(event).map_err(|_| error!(ErrorCode::InstructionDidNotSerialize))?;
            let (info, seeds): (_, &[&[u8]]) = match self {
                Self::Multisig {
                    info,
                    create_key,
                    bump,
                } => (
                    info,
                    &[SEED_PREFIX, SEED_MULTISIG, create_key.as_ref(), &[*bump]],
                ),
                Self::ProgramConfig { info, bump } => {
                    (info, &[SEED_PREFIX, SEED_PROGRAM_CONFIG, &[*bump]])
                }
            };
            let instruction = Instruction {
                program_id: crate::ID,
                accounts: vec![AccountMeta::new_readonly(*info.key, true)],
                data,
            };
            invoke_signed(&instruction, std::slice::from_ref(info), &[seeds]).map_err(Into::into)
        }
    }

    /// A proposal event with the proposal's current state as the snapshot.
    pub fn proposal_event<'a>(
        kind: ProposalEventKind,
        proposal: &'a Account<'_, Proposal>,
        member: Option<Pubkey>,
        memo: Option<String>,
    ) -> MultisigEvent<'a> {
        MultisigEvent::Proposal(ProposalEvent {
            kind,
            multisig: proposal.multisig,
            proposal: proposal.key(),
            transaction_index: proposal.transaction_index,
            member,
            memo,
            snapshot: Some(Cow::Borrowed(proposal)),
        })
    }

    /// Emits `events` in order through `authority`, but only if events are `enabled`. Both
    /// closures run only then, so a disabled call costs nothing.
    pub fn emit<'info, 'a>(
        enabled: bool,
        authority: impl FnOnce() -> LogAuthority<'info>,
        events: impl FnOnce() -> Vec<MultisigEvent<'a>>,
    ) -> Result<()> {
        if !enabled {
            return Ok(());
        }
        let authority = authority();
        events().iter().try_for_each(|event| authority.log(event))
    }
}
