//! Migration planner for v4 -> 4r: lists what a v4 vault holds, groups it by asset class, and
//! splits each group into batch items that fit a v4 batch transaction. The same rules as
//! `planner.ts` in `@sqds/multisig-4r`. The RPC part (feature `fetch`) reads the chain and sends
//! nothing.

use solana_address::Address;
use solana_instruction::Instruction;
use squads_multisig_4r_program::builders::{
    self, MigrationAccounts, MultisigMigratePrograms, MultisigMigrateSol, MultisigMigrateStakes,
    MultisigMigrateTokenAuthorities, MultisigMigrateTokens, MultisigMigrateVoteAccounts,
};
use squads_multisig_4r_program::instructions::{
    MigrateAuthoritiesArgs, MigrateSolArgs, MigrateTokenAuthoritiesArgs, MigrateTokensArgs,
    TokenAuthorityKind,
};
use squads_multisig_4r_program::message::{
    compile_transaction_message, transaction_message_bytes, AddressLookupTableAccount,
};
use squads_multisig_4r_program::migration::{
    get_associated_token_address, TokenItem, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID,
};
use squads_multisig_4r_program::pda::get_vault_pda;
use squads_multisig_4r_program::LEGACY_V4_PROGRAM_ID;

use crate::error::{ClientError, ClientResult};
use crate::lookup_tables::lookup_table_addresses;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InventoryToken {
    pub account: Address,
    pub mint: Address,
    pub token_program: Address,
    pub amount: u64,
    pub frozen: bool,
    /// The owner's associated token account for this mint.
    pub associated: bool,
}

/// A token account where the vault is the close authority or the delegate. The owner may be anyone.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InventoryTokenRole {
    pub account: Address,
    pub token_program: Address,
    pub mint: Address,
    pub owner: Address,
    pub frozen: bool,
    /// The vault is the close authority.
    pub close_authority: bool,
    /// The amount that the vault can spend as the delegate, if it is the delegate.
    pub delegated_amount: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InventoryStake {
    pub stake: Address,
    pub staker: bool,
    pub withdrawer: bool,
    /// The vault is the lockup custodian.
    pub custodian: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InventoryMint {
    pub mint: Address,
    pub token_program: Address,
    /// The authorities that the vault holds: mint, freeze, Token-2022 extension and metadata.
    pub authorities: Vec<TokenAuthorityKind>,
}

/// What one v4 vault holds or controls.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V4VaultInventory {
    pub vault_index: u8,
    pub vault: Address,
    pub lamports: u64,
    pub tokens: Vec<InventoryToken>,
    /// Token accounts where the vault is the close authority or the delegate.
    pub token_roles: Vec<InventoryTokenRole>,
    pub stakes: Vec<InventoryStake>,
    /// Vote accounts whose withdrawer is the vault.
    pub vote_accounts: Vec<Address>,
    /// Program data accounts whose upgrade authority is the vault.
    pub program_data: Vec<Address>,
    pub mints: Vec<InventoryMint>,
    /// Scans that failed, for example on an RPC that refuses `getProgramAccounts`.
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct MigrationOptions {
    /// Keep the v4 token accounts open (default: close them; the rent goes to the successor vault).
    pub keep_token_accounts: bool,
    /// Move token accounts that are not associated token accounts by owner change, so they keep
    /// their address.
    pub preserve_token_account_addresses: bool,
    /// Leave the SOL of the vault in place.
    pub skip_sol: bool,
}

/// Limits for one batch item.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrationLimits {
    /// Bytes of the vault transaction message (the data of `batch_add_transaction`).
    pub max_message_bytes: usize,
    /// Accounts of the vault transaction message. The execute transaction adds about 8 more.
    pub max_message_accounts: usize,
    /// Instructions of the execute transaction, CPIs included (the runtime allows 64).
    pub max_instruction_trace: usize,
}

impl MigrationLimits {
    /// Fits a v4 batch without address lookup tables.
    pub const DEFAULT: Self = Self {
        max_message_bytes: 800,
        max_message_accounts: 30,
        max_instruction_trace: 64,
    };
    /// With lookup tables: the 64 account locks of the execute transaction bind first.
    pub const LOOKUP_TABLES: Self = Self {
        max_message_bytes: 800,
        max_message_accounts: 52,
        max_instruction_trace: 64,
    };
}

// Compute unit price and limit, the v4 execute, the migrate instruction.
const TRACE_PER_EXECUTE: usize = 4;

/// The worst-case instruction trace of the execute transaction of one batch item. A token: ATA
/// creation (up to 7 CPIs when someone pre-funds the address), the transfer and the close. A
/// stake: two `Authorize` and `SetLockup`.
pub fn migration_instruction_trace(group: &MigrationGroup, events: bool) -> usize {
    let per_item = match group {
        MigrationGroup::Tokens { .. } => 9,
        MigrationGroup::Stakes(_) => 3,
        _ => 1,
    };
    TRACE_PER_EXECUTE + usize::from(events) + group.len() * per_item
}

impl Default for MigrationLimits {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// Rent of one new associated token account, with margin for Token-2022 account extensions.
pub const ATA_RENT_ESTIMATE: u64 = 2_200_000;

/// The index of the v4 vault `address` of `source_multisig`. Checks all 256 indexes.
pub fn find_v4_vault_index(source_multisig: &Address, address: &Address) -> Option<u8> {
    (0..=u8::MAX).find(|index| {
        get_vault_pda(source_multisig, *index, Some(&LEGACY_V4_PROGRAM_ID)).0 == *address
    })
}

/// One item of `multisig_migrate_token_authorities`: the token account or mint, and the authority.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TokenAuthorityItem {
    pub account: Address,
    pub kind: TokenAuthorityKind,
}

/// The assets of one `multisig_migrate_*` instruction, before the split into batch items.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum MigrationGroup {
    Tokens {
        token_program: Address,
        close_source: bool,
        items: Vec<TokenItem>,
    },
    TokenAuthorities {
        token_program: Address,
        items: Vec<TokenAuthorityItem>,
    },
    Stakes(Vec<Address>),
    VoteAccounts(Vec<Address>),
    Programs(Vec<Address>),
    Sol {
        keep: u64,
    },
}

impl MigrationGroup {
    /// The number of items (SOL counts as one).
    pub fn len(&self) -> usize {
        match self {
            Self::Tokens { items, .. } => items.len(),
            Self::TokenAuthorities { items, .. } => items.len(),
            Self::Stakes(items) | Self::VoteAccounts(items) | Self::Programs(items) => items.len(),
            Self::Sol { .. } => 1,
        }
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// The same group with only the items in `range` (SOL stays whole).
    pub fn slice(&self, range: std::ops::Range<usize>) -> Self {
        match self {
            Self::Tokens {
                token_program,
                close_source,
                items,
            } => Self::Tokens {
                token_program: *token_program,
                close_source: *close_source,
                items: items[range].to_vec(),
            },
            Self::TokenAuthorities {
                token_program,
                items,
            } => Self::TokenAuthorities {
                token_program: *token_program,
                items: items[range].to_vec(),
            },
            Self::Stakes(items) => Self::Stakes(items[range].to_vec()),
            Self::VoteAccounts(items) => Self::VoteAccounts(items[range].to_vec()),
            Self::Programs(items) => Self::Programs(items[range].to_vec()),
            Self::Sol { keep } => Self::Sol { keep: *keep },
        }
    }

    /// The `multisig_migrate_*` instruction of this group (without the event account).
    pub fn instruction(&self, source: &MigrationSource) -> ClientResult<Instruction> {
        let migration = MigrationAccounts::new(
            source.source_multisig,
            source.vault_index,
            source.program_id.as_ref(),
        );
        let program_id = source.program_id.as_ref();
        let authorities = MigrateAuthoritiesArgs {
            vault_index: source.vault_index,
            config_authority_vault_index: source.config_authority_vault_index,
            memo: None,
        };
        Ok(match self {
            Self::Tokens {
                token_program,
                close_source,
                items,
            } => MultisigMigrateTokens::new(migration, *token_program).instruction(
                MigrateTokensArgs {
                    vault_index: source.vault_index,
                    config_authority_vault_index: source.config_authority_vault_index,
                    close_source: *close_source,
                    memo: None,
                },
                items,
                program_id,
            )?,
            Self::TokenAuthorities {
                token_program,
                items,
            } => {
                let accounts: Vec<Address> = items.iter().map(|item| item.account).collect();
                MultisigMigrateTokenAuthorities::new(migration, *token_program).instruction(
                    MigrateTokenAuthoritiesArgs {
                        vault_index: source.vault_index,
                        config_authority_vault_index: source.config_authority_vault_index,
                        items: items.iter().map(|item| item.kind).collect(),
                        memo: None,
                    },
                    &accounts,
                    program_id,
                )?
            }
            Self::Stakes(stakes) => MultisigMigrateStakes::new(migration).instruction(
                authorities,
                stakes,
                program_id,
            )?,
            Self::VoteAccounts(votes) => MultisigMigrateVoteAccounts::new(migration).instruction(
                authorities,
                votes,
                program_id,
            )?,
            Self::Programs(program_data) => MultisigMigratePrograms::new(migration).instruction(
                authorities,
                program_data,
                program_id,
            )?,
            Self::Sol { keep } => MultisigMigrateSol::new(migration).instruction(
                MigrateSolArgs {
                    vault_index: source.vault_index,
                    config_authority_vault_index: source.config_authority_vault_index,
                    keep: *keep,
                    memo: None,
                },
                program_id,
            )?,
        })
    }
}

/// The v4 multisig and vault that the migrate instructions move from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrationSource {
    pub source_multisig: Address,
    pub vault_index: u8,
    /// Set when the v4 config authority is the v4 vault with this index.
    pub config_authority_vault_index: Option<u8>,
    /// The 4r program; default the mainnet ID.
    pub program_id: Option<Address>,
}

/// The groups of an inventory, in the order that a migration moves them: tokens, token
/// authorities, stakes, vote accounts, programs, then SOL last (the vault pays the new token
/// accounts first). Also returns notes about what cannot move.
pub fn inventory_groups(
    inventory: &V4VaultInventory,
    options: MigrationOptions,
) -> (Vec<MigrationGroup>, Vec<String>) {
    let close = !options.keep_token_accounts;
    let movable = || inventory.tokens.iter().filter(|token| !token.frozen);
    let keeps_address =
        |token: &InventoryToken| options.preserve_token_account_addresses && !token.associated;
    let notes = inventory
        .tokens
        .iter()
        .filter(|token| token.frozen)
        .map(|token| format!("token account {} is frozen; it cannot move", token.account))
        .chain(token_role_notes(inventory))
        .collect();
    let owner_changes: Vec<Address> = movable()
        .filter(|token| keeps_address(token))
        .map(|token| token.account)
        .collect();
    let token_programs = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID];
    let tokens = token_programs.map(|token_program| MigrationGroup::Tokens {
        token_program,
        close_source: close,
        items: movable()
            .filter(|token| token.token_program == token_program && !keeps_address(token))
            .filter(|token| token.amount > 0 || close)
            .map(|token| TokenItem {
                source_token_account: token.account,
                mint: token.mint,
            })
            .collect(),
    });
    let token_authorities = token_programs.map(|token_program| {
        let owners = movable()
            .filter(|token| token.token_program == token_program && keeps_address(token))
            .map(|token| TokenAuthorityItem {
                account: token.account,
                kind: TokenAuthorityKind::AccountOwner,
            });
        let close_authorities = close_authority_items(inventory, token_program, &owner_changes);
        let mints = inventory
            .mints
            .iter()
            .filter(|mint| mint.token_program == token_program)
            .flat_map(|mint| {
                mint.authorities.iter().map(|kind| TokenAuthorityItem {
                    account: mint.mint,
                    kind: *kind,
                })
            });
        MigrationGroup::TokenAuthorities {
            token_program,
            items: owners.chain(close_authorities).chain(mints).collect(),
        }
    });
    let others = [
        MigrationGroup::Stakes(inventory.stakes.iter().map(|stake| stake.stake).collect()),
        MigrationGroup::VoteAccounts(inventory.vote_accounts.clone()),
        MigrationGroup::Programs(inventory.program_data.clone()),
    ];
    let sol =
        (!options.skip_sol && inventory.lamports > 0).then_some(MigrationGroup::Sol { keep: 0 });
    let groups = tokens
        .into_iter()
        .chain(token_authorities)
        .chain(others)
        .filter(|group| !group.is_empty())
        .chain(sol)
        .collect();
    (groups, notes)
}

/// `CloseAccount` items: accounts of other owners, and the vault's own accounts that move by owner
/// change. The token step closes or keeps the other accounts of the vault. Frozen accounts reject it.
fn close_authority_items<'a>(
    inventory: &'a V4VaultInventory,
    token_program: Address,
    owner_changes: &'a [Address],
) -> impl Iterator<Item = TokenAuthorityItem> + 'a {
    inventory
        .token_roles
        .iter()
        .filter(move |role| role.token_program == token_program)
        .filter(|role| role.close_authority && !role.frozen)
        .filter(|role| role.owner != inventory.vault || owner_changes.contains(&role.account))
        .map(|role| TokenAuthorityItem {
            account: role.account,
            kind: TokenAuthorityKind::CloseAccount,
        })
}

/// Notes about the roles on accounts of other owners that cannot move.
fn token_role_notes(inventory: &V4VaultInventory) -> impl Iterator<Item = String> + '_ {
    inventory
        .token_roles
        .iter()
        .filter(|role| role.owner != inventory.vault)
        .flat_map(|role| {
            let frozen = (role.close_authority && role.frozen).then(|| {
                format!(
                    "token account {} is frozen; its close authority cannot move",
                    role.account
                )
            });
            let delegate = role.delegated_amount.map(|amount| {
                format!(
                    "the vault is the delegate of token account {} (owner {}) for {amount} tokens; \
                     this role cannot move, only the owner can change it",
                    role.account, role.owner
                )
            });
            frozen.into_iter().chain(delegate)
        })
}

/// One batch item: one `multisig_migrate_*` instruction for a part of one group, with its
/// measured size.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MigrationItem {
    pub group: MigrationGroup,
    pub instruction: Instruction,
    pub message_bytes: usize,
    pub message_accounts: usize,
    pub instruction_trace: usize,
}

/// What [`chunk_migration_groups`] needs to build and measure each instruction.
#[derive(Debug, Clone, Copy)]
pub struct ChunkInput<'a> {
    pub source: MigrationSource,
    pub events: bool,
    pub address_lookup_tables: &'a [AddressLookupTableAccount],
    pub limits: MigrationLimits,
}

fn migration_item(input: &ChunkInput, group: MigrationGroup) -> ClientResult<MigrationItem> {
    let source = &input.source;
    let source_vault = get_vault_pda(
        &source.source_multisig,
        source.vault_index,
        Some(&LEGACY_V4_PROGRAM_ID),
    )
    .0;
    let migrate = group.instruction(source)?;
    let instruction = match input.events {
        true => builders::with_events(migrate),
        false => migrate,
    };
    let instructions = std::slice::from_ref(&instruction);
    let tables = input.address_lookup_tables;
    let message = compile_transaction_message(&source_vault, instructions, tables)?;
    let lookups: Vec<_> = message.address_table_lookups.into();
    let loaded: usize = lookups
        .iter()
        .map(|lookup| lookup.writable_indexes.len() + lookup.readonly_indexes.len())
        .sum();
    Ok(MigrationItem {
        instruction_trace: migration_instruction_trace(&group, input.events),
        group,
        message_bytes: transaction_message_bytes(&source_vault, instructions, tables)?.len(),
        message_accounts: message.account_keys.len() + loaded,
        instruction,
    })
}

/// Splits each group into batch items. Each item is the longest run of the group's items whose
/// compiled vault message stays within the limits. The order does not change.
pub fn chunk_migration_groups(
    groups: &[MigrationGroup],
    input: &ChunkInput,
) -> ClientResult<Vec<MigrationItem>> {
    let fits = |item: &MigrationItem| {
        item.message_bytes <= input.limits.max_message_bytes
            && item.message_accounts <= input.limits.max_message_accounts
            && item.instruction_trace <= input.limits.max_instruction_trace
    };
    let fitting = |group: MigrationGroup| {
        let item = migration_item(input, group)?;
        match fits(&item) {
            true => Ok(item),
            false => Err(ClientError::Plan(
                "one asset does not fit in a batch item; raise the limits or use lookup tables"
                    .into(),
            )),
        }
    };
    groups.iter().try_fold(Vec::new(), |mut items, group| {
        if let MigrationGroup::Sol { .. } = group {
            items.push(fitting(group.clone())?);
            return Ok(items);
        }
        let (mut start, mut current) = (0, None::<MigrationItem>);
        for end in 1..=group.len() {
            let grown = migration_item(input, group.slice(start..end))?;
            if fits(&grown) {
                current = Some(grown);
                continue;
            }
            items.extend(current.take());
            start = end - 1;
            current = Some(fitting(group.slice(start..end))?);
        }
        items.extend(current);
        Ok(items)
    })
}

/// A migration plan for one v4 vault.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V4MigrationPlan {
    pub source: MigrationSource,
    pub source_vault: Address,
    pub successor: Address,
    pub vault: Address,
    pub events: bool,
    /// `multisig_create_from`, when the successor does not exist yet.
    pub create_successor: Option<Instruction>,
    /// The 4r creation fee in lamports, also the `max_creation_fee` of `create_successor`.
    pub creation_fee: Option<u64>,
    /// `None` until the successor exists. `Some(false)`: every migrate instruction fails.
    pub governance_matches: Option<bool>,
    pub inventory: V4VaultInventory,
    pub groups: Vec<MigrationGroup>,
    pub items: Vec<MigrationItem>,
    /// The lookup tables that the vault messages use (empty: none).
    pub address_lookup_tables: Vec<AddressLookupTableAccount>,
    pub warnings: Vec<String>,
}

/// The accounts of a plan's items that lookup tables can hold (no signers, no programs).
pub fn migration_lookup_table_addresses(plan: &V4MigrationPlan) -> Vec<Address> {
    let instructions: Vec<Instruction> = plan
        .items
        .iter()
        .map(|item| item.instruction.clone())
        .collect();
    lookup_table_addresses(&instructions)
}

/// The same plan, split again for `address_lookup_tables`. Fewer, larger items.
pub fn with_migration_lookup_tables(
    plan: V4MigrationPlan,
    address_lookup_tables: Vec<AddressLookupTableAccount>,
    limits: MigrationLimits,
) -> ClientResult<V4MigrationPlan> {
    let items = chunk_migration_groups(
        &plan.groups,
        &ChunkInput {
            source: plan.source,
            events: plan.events,
            address_lookup_tables: &address_lookup_tables,
            limits,
        },
    )?;
    Ok(V4MigrationPlan {
        items,
        address_lookup_tables,
        ..plan
    })
}

// Layouts: token account (165 bytes, or Token-2022 type 2 at byte 165), mint (82 bytes, or type 1
// at byte 165 with extensions from 166), stake `Meta`, vote state, loader-v3 `ProgramData`.

fn address_at(data: &[u8], offset: usize) -> Option<Address> {
    data.get(offset..offset + 32)
        .and_then(|bytes| <[u8; 32]>::try_from(bytes).ok())
        .map(Address::new_from_array)
}

fn u16_at(data: &[u8], offset: usize) -> Option<usize> {
    data.get(offset..offset + 2)
        .and_then(|bytes| bytes.try_into().ok())
        .map(|bytes| u16::from_le_bytes(bytes) as usize)
}

fn u32_at(data: &[u8], offset: usize) -> Option<u32> {
    data.get(offset..offset + 4)
        .and_then(|bytes| bytes.try_into().ok())
        .map(u32::from_le_bytes)
}

fn u64_at(data: &[u8], offset: usize) -> Option<u64> {
    data.get(offset..offset + 8)
        .and_then(|bytes| bytes.try_into().ok())
        .map(u64::from_le_bytes)
}

fn is_token_account(data: &[u8]) -> bool {
    data.len() == 165 || data.get(165) == Some(&2)
}

/// A token account, or `None` for other data (a Token-2022 mint has the same owner program).
pub fn parse_token_account(
    account: Address,
    token_program: Address,
    data: &[u8],
) -> Option<InventoryToken> {
    is_token_account(data).then_some(())?;
    let mint = address_at(data, 0)?;
    let owner = address_at(data, 32)?;
    Some(InventoryToken {
        account,
        token_program,
        mint,
        amount: u64_at(data, 64)?,
        frozen: *data.get(108)? == 2,
        associated: get_associated_token_address(&owner, &mint, &token_program) == account,
    })
}

/// The roles of `vault` in a token account: close authority (`COption` at 129) and delegate
/// (`COption` at 72, amount at 121). `None` if `data` is not a token account or `vault` has neither.
pub fn parse_token_role(
    account: Address,
    token_program: Address,
    vault: &Address,
    data: &[u8],
) -> Option<InventoryTokenRole> {
    is_token_account(data).then_some(())?;
    let holds =
        |tag: usize| u32_at(data, tag) == Some(1) && address_at(data, tag + 4) == Some(*vault);
    let close_authority = holds(129);
    let delegated_amount = holds(72).then(|| u64_at(data, 121)).flatten();
    (close_authority || delegated_amount.is_some()).then_some(())?;
    Some(InventoryTokenRole {
        account,
        token_program,
        mint: address_at(data, 0)?,
        owner: address_at(data, 32)?,
        frozen: *data.get(108)? == 2,
        close_authority,
        delegated_amount,
    })
}

/// The authorities in a Token-2022 extension value, with their offsets in the value.
fn extension_authorities(extension_type: usize) -> &'static [(TokenAuthorityKind, usize)] {
    use TokenAuthorityKind as K;
    match extension_type {
        1 => &[(K::TransferFeeConfig, 0), (K::WithheldWithdraw, 32)],
        3 => &[(K::CloseMint, 0)],
        4 => &[(K::ConfidentialTransferMint, 0)],
        10 => &[(K::InterestRate, 0)],
        12 => &[(K::PermanentDelegate, 0)],
        14 => &[(K::TransferHookProgramId, 0)],
        16 => &[(K::ConfidentialTransferFeeConfig, 0)],
        18 => &[(K::MetadataPointer, 0)],
        19 => &[(K::MetadataUpdate, 0)],
        20 => &[(K::GroupPointer, 0)],
        22 => &[(K::GroupMemberPointer, 0)],
        25 => &[(K::ScaledUiAmount, 0)],
        26 => &[(K::Pause, 0)],
        28 => &[(K::PermissionedBurn, 0)],
        _ => &[],
    }
}

/// The authorities that `vault` holds on a mint, or `None` if `data` is not a mint. Base fields
/// first, then the Token-2022 extensions in their order.
pub fn parse_mint_authorities(data: &[u8], vault: &Address) -> Option<Vec<TokenAuthorityKind>> {
    let extended = data.len() > 166 && data[165] == 1;
    (data.len() == 82 || extended).then_some(())?;
    let holds = |offset: usize| address_at(data, offset) == Some(*vault);
    let base = [
        (TokenAuthorityKind::MintTokens, 0),
        (TokenAuthorityKind::FreezeAccount, 46),
    ]
    .into_iter()
    .filter(|(_, tag)| u32_at(data, *tag) == Some(1) && holds(tag + 4))
    .map(|(kind, _)| kind);
    let entries = std::iter::successors(extended.then_some(166), |offset| {
        Some(offset + 4 + u16_at(data, offset + 2)?)
    })
    .map_while(|offset| match u16_at(data, offset) {
        Some(0) | None => None,
        Some(extension_type) => Some((extension_type, offset + 4)),
    });
    let extensions = entries.flat_map(|(extension_type, value)| {
        extension_authorities(extension_type)
            .iter()
            .filter(move |(_, at)| holds(value + at))
            .map(|(kind, _)| *kind)
    });
    Some(base.chain(extensions).collect())
}

/// A mint where `vault` holds at least one authority, or `None`.
pub fn parse_mint(
    mint: Address,
    token_program: Address,
    vault: &Address,
    data: &[u8],
) -> Option<InventoryMint> {
    let authorities = parse_mint_authorities(data, vault)?;
    (!authorities.is_empty()).then_some(InventoryMint {
        mint,
        token_program,
        authorities,
    })
}

/// The roles that `vault` holds in an `Initialized` (1) or `Stake` (2) stake account: staker at
/// 12, withdrawer at 44, lockup custodian at 92.
pub fn parse_stake(stake: Address, vault: &Address, data: &[u8]) -> Option<InventoryStake> {
    matches!(u32_at(data, 0)?, 1 | 2).then_some(())?;
    Some(InventoryStake {
        stake,
        staker: address_at(data, 12)? == *vault,
        withdrawer: address_at(data, 44)? == *vault,
        custodian: address_at(data, 92)? == *vault,
    })
}

/// The withdrawer of a vote account: state versions 1..=3 keep it at bytes 36..68.
pub fn parse_vote_withdrawer(data: &[u8]) -> Option<Address> {
    matches!(u32_at(data, 0)?, 1..=3).then_some(())?;
    address_at(data, 36)
}

#[cfg(feature = "fetch")]
pub use fetch::*;

#[cfg(feature = "fetch")]
mod fetch {
    use solana_address::Address;
    use solana_instruction::Instruction;
    use solana_rpc_client::nonblocking::rpc_client::RpcClient;
    use solana_rpc_client_api::config::{
        RpcAccountInfoConfig, RpcProgramAccountsConfig, UiAccountEncoding, UiDataSliceConfig,
    };
    use solana_rpc_client_api::filter::{Memcmp, RpcFilterType};
    use squads_multisig_4r_program::builders::{
        self, BatchAddTransaction, BatchCreate, BatchExecuteTransaction, MultisigCreateFrom,
        ProposalActivate, ProposalApprove, ProposalCreate, VaultTransactionCreate,
        VaultTransactionExecute, SYSTEM_PROGRAM_ID,
    };
    use squads_multisig_4r_program::instructions::{
        BatchAddTransactionArgs, BatchCreateArgs, MultisigCreateFromArgs, ProposalCreateArgs,
        ProposalVoteArgs, VaultTransactionCreateArgs,
    };
    use squads_multisig_4r_program::message::{
        accounts_for_execute, transaction_message_bytes, vault_transaction_execute,
        AddressLookupTableAccount,
    };
    use squads_multisig_4r_program::migration::{
        check_same_governance, get_associated_token_address, get_successor_pda,
        BPF_LOADER_UPGRADEABLE_ID, STAKE_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID,
        VOTE_PROGRAM_ID,
    };
    use squads_multisig_4r_program::pda::{
        get_batch_transaction_pda, get_program_config_pda, get_proposal_pda, get_transaction_pda,
        get_vault_pda,
    };
    use squads_multisig_4r_program::state::{
        Batch, ProgramConfig, VaultBatchTransaction, VaultTransaction,
    };
    use squads_multisig_4r_program::LEGACY_V4_PROGRAM_ID;

    use super::*;
    use crate::lookup_tables::parse_lookup_table;
    use crate::rpc::{fetch, fetch_multisig};

    const V4: Option<&Address> = Some(&LEGACY_V4_PROGRAM_ID);

    /// The `getProgramAccounts` scans to run. Some RPC providers refuse them.
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct InventoryScans {
        /// Token accounts where the vault is the close authority or the delegate.
        pub token_roles: bool,
        pub stakes: bool,
        pub vote_accounts: bool,
        pub programs: bool,
        pub mints: bool,
    }

    impl Default for InventoryScans {
        fn default() -> Self {
            Self {
                token_roles: true,
                stakes: true,
                vote_accounts: true,
                programs: true,
                mints: true,
            }
        }
    }

    async fn program_accounts(
        rpc: &RpcClient,
        program: &Address,
        filters: Vec<RpcFilterType>,
        data_slice: Option<UiDataSliceConfig>,
    ) -> ClientResult<Vec<(Address, Vec<u8>)>> {
        let config = RpcProgramAccountsConfig {
            filters: Some(filters),
            account_config: RpcAccountInfoConfig {
                encoding: Some(UiAccountEncoding::Base64),
                data_slice,
                ..RpcAccountInfoConfig::default()
            },
            ..RpcProgramAccountsConfig::default()
        };
        Ok(rpc
            .get_program_ui_accounts_with_config(program, config)
            .await?
            .into_iter()
            .filter_map(|(key, account)| account.data.decode().map(|data| (key, data)))
            .collect())
    }

    fn memcmp(offset: usize, bytes: &[u8]) -> RpcFilterType {
        RpcFilterType::Memcmp(Memcmp::new_raw_bytes(offset, bytes.to_vec()))
    }

    fn push_new<T, K: PartialEq>(found: &mut Vec<T>, item: T, key: impl Fn(&T) -> K) {
        if !found.iter().any(|known| key(known) == key(&item)) {
            found.push(item);
        }
    }

    /// Every token account, stake, vote account, program and mint that the v4 vault holds or
    /// controls. `extra_mints`: mints that the scan cannot find (only extension authorities).
    pub async fn fetch_v4_vault_inventory(
        rpc: &RpcClient,
        source_multisig: &Address,
        vault_index: u8,
        scans: InventoryScans,
        extra_mints: &[Address],
    ) -> ClientResult<V4VaultInventory> {
        let vault = get_vault_pda(source_multisig, vault_index, V4).0;
        let key = vault.to_bytes();
        let mut warnings = Vec::new();
        let mut scan = |name: &str, result: ClientResult<Vec<(Address, Vec<u8>)>>| {
            result.unwrap_or_else(|error| {
                warnings.push(format!("{name} scan failed: {error}"));
                Vec::new()
            })
        };

        let lamports = rpc.get_balance(&vault).await?;
        let mut tokens = Vec::new();
        for token_program in [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID] {
            let found = program_accounts(rpc, &token_program, vec![memcmp(32, &key)], None).await;
            tokens.extend(
                scan("token account", found)
                    .into_iter()
                    .filter_map(|(account, data)| {
                        parse_token_account(account, token_program, &data)
                    }),
            );
        }
        let mut token_roles: Vec<InventoryTokenRole> = Vec::new();
        if scans.token_roles {
            let tagged_key = [[1, 0, 0, 0].as_slice(), &key].concat();
            for token_program in [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID] {
                // The delegate and the close authority: `COption` tag 1, then the key.
                for offset in [72, 129] {
                    let found = program_accounts(
                        rpc,
                        &token_program,
                        vec![memcmp(offset, &tagged_key)],
                        None,
                    )
                    .await;
                    scan("token role", found)
                        .into_iter()
                        .filter_map(|(account, data)| {
                            parse_token_role(account, token_program, &vault, &data)
                        })
                        .for_each(|role| push_new(&mut token_roles, role, |r| r.account));
                }
            }
        }
        let mut stakes: Vec<InventoryStake> = Vec::new();
        if scans.stakes {
            for offset in [12, 44, 92] {
                let found =
                    program_accounts(rpc, &STAKE_PROGRAM_ID, vec![memcmp(offset, &key)], None)
                        .await;
                scan("stake", found)
                    .into_iter()
                    .filter_map(|(stake, data)| parse_stake(stake, &vault, &data))
                    .for_each(|stake| push_new(&mut stakes, stake, |s| s.stake));
            }
        }
        let vote_accounts = match scans.vote_accounts {
            true => {
                let found =
                    program_accounts(rpc, &VOTE_PROGRAM_ID, vec![memcmp(36, &key)], None).await;
                scan("vote", found)
                    .into_iter()
                    .filter(|(_, data)| parse_vote_withdrawer(data) == Some(vault))
                    .map(|(vote, _)| vote)
                    .collect()
            }
            false => Vec::new(),
        };
        let program_data = match scans.programs {
            true => {
                let filters = vec![
                    memcmp(0, &[3, 0, 0, 0]),
                    memcmp(12, &[[1].as_slice(), &key].concat()),
                ];
                let slice = Some(UiDataSliceConfig {
                    offset: 0,
                    length: 0,
                });
                let found = program_accounts(rpc, &BPF_LOADER_UPGRADEABLE_ID, filters, slice).await;
                scan("program", found)
                    .into_iter()
                    .map(|(key, _)| key)
                    .collect()
            }
            false => Vec::new(),
        };
        let mut mints: Vec<InventoryMint> = Vec::new();
        if scans.mints {
            for token_program in [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID] {
                // The RPC reads a filter at offset 0 of a token program as a 32-byte mint, so match the key only.
                for offset in [4, 50] {
                    let found =
                        program_accounts(rpc, &token_program, vec![memcmp(offset, &key)], None)
                            .await;
                    scan("mint", found)
                        .into_iter()
                        .filter_map(|(mint, data)| parse_mint(mint, token_program, &vault, &data))
                        .for_each(|mint| push_new(&mut mints, mint, |m| m.mint));
                }
            }
        }
        if !extra_mints.is_empty() {
            let accounts = rpc.get_multiple_accounts(extra_mints).await?;
            extra_mints
                .iter()
                .zip(accounts)
                .filter_map(|(mint, account)| {
                    let account = account?;
                    parse_mint(*mint, account.owner, &vault, &account.data)
                })
                .for_each(|mint| push_new(&mut mints, mint, |m| m.mint));
        }
        Ok(V4VaultInventory {
            vault_index,
            vault,
            lamports,
            tokens,
            token_roles,
            stakes,
            vote_accounts,
            program_data,
            mints,
            warnings,
        })
    }

    /// The inputs of [`plan_v4_migration`].
    #[derive(Debug, Clone, Copy)]
    pub struct PlanInput<'a> {
        pub source_multisig: Address,
        pub vault_index: u8,
        /// The 4r program; default the mainnet ID.
        pub program_id: Option<&'a Address>,
        pub events: bool,
        pub options: MigrationOptions,
        pub address_lookup_tables: &'a [AddressLookupTableAccount],
        /// Default: [`MigrationLimits::DEFAULT`], or [`MigrationLimits::LOOKUP_TABLES`] with tables.
        pub limits: Option<MigrationLimits>,
        pub scans: InventoryScans,
        pub extra_mints: &'a [Address],
    }

    /// Plans the move of one v4 vault to its successor. Reads the chain and sends nothing.
    pub async fn plan_v4_migration(
        rpc: &RpcClient,
        input: PlanInput<'_>,
    ) -> ClientResult<V4MigrationPlan> {
        let PlanInput {
            source_multisig,
            vault_index,
            ..
        } = input;
        let program_id = *input.program_id.unwrap_or(&squads_multisig_4r_program::ID);
        let r4 = Some(&program_id);
        let source = fetch_multisig(rpc, &source_multisig, V4).await?;
        let successor = get_successor_pda(&source_multisig, r4).0;
        let source_vault = get_vault_pda(&source_multisig, vault_index, V4).0;
        let vault = get_vault_pda(&successor, vault_index, r4).0;
        let config_authority_vault_index =
            find_v4_vault_index(&source_multisig, &source.config_authority);
        let rent_collector_vault_index = source
            .rent_collector
            .and_then(|rent_collector| find_v4_vault_index(&source_multisig, &rent_collector));

        let existing = rpc
            .get_account_with_commitment(&successor, rpc.commitment())
            .await?
            .value;
        let governance_matches = match existing {
            Some(_) => {
                let successor_state = fetch_multisig(rpc, &successor, r4).await?;
                Some(
                    check_same_governance(
                        &source,
                        &successor_state,
                        &source_multisig,
                        &successor,
                        config_authority_vault_index,
                        r4,
                    )
                    .is_ok(),
                )
            }
            None => None,
        };
        let (create_successor, creation_fee) = match governance_matches {
            Some(_) => (None, None),
            None => {
                let program_config = get_program_config_pda(r4).0;
                let config: ProgramConfig = fetch(rpc, &program_config, r4).await?;
                let create =
                    MultisigCreateFrom::new(source_multisig, vault_index, config.treasury, r4)
                        .instruction(
                            MultisigCreateFromArgs {
                                vault_index,
                                config_authority_vault_index,
                                rent_collector_vault_index,
                                // The members approve the fee that the plan sees; a higher fee fails.
                                max_creation_fee: config.multisig_creation_fee,
                                memo: None,
                            },
                            r4,
                        )?;
                let create = match input.events {
                    true => builders::with_events(create),
                    false => create,
                };
                (Some(create), Some(config.multisig_creation_fee))
            }
        };

        let inventory = fetch_v4_vault_inventory(
            rpc,
            &source_multisig,
            vault_index,
            input.scans,
            input.extra_mints,
        )
        .await?;
        let (groups, notes) = inventory_groups(&inventory, input.options);
        let migration_source = MigrationSource {
            source_multisig,
            vault_index,
            config_authority_vault_index,
            program_id: Some(program_id),
        };
        let default_limits = match input.address_lookup_tables.is_empty() {
            true => MigrationLimits::DEFAULT,
            false => MigrationLimits::LOOKUP_TABLES,
        };
        let items = chunk_migration_groups(
            &groups,
            &ChunkInput {
                source: migration_source,
                events: input.events,
                address_lookup_tables: input.address_lookup_tables,
                limits: input.limits.unwrap_or(default_limits),
            },
        )?;
        let destinations = groups
            .iter()
            .flat_map(|group| match group {
                MigrationGroup::Tokens {
                    token_program,
                    items,
                    ..
                } => items
                    .iter()
                    .map(|item| get_associated_token_address(&vault, &item.mint, token_program))
                    .collect(),
                _ => Vec::new(),
            })
            .fold(Vec::new(), |mut found, address| {
                push_new(&mut found, address, |a| *a);
                found
            });
        let new_token_accounts = match destinations.is_empty() {
            true => 0,
            false => rpc
                .get_multiple_accounts(&destinations)
                .await?
                .iter()
                .filter(|account| account.is_none())
                .count() as u64,
        };
        let warnings = inventory
            .warnings
            .iter()
            .cloned()
            .chain(notes)
            .chain((governance_matches == Some(false)).then(|| {
                "the successor governance differs from v4: the migrate instructions fail until they agree".to_string()
            }))
            .chain((inventory.lamports < new_token_accounts * ATA_RENT_ESTIMATE).then(|| {
                format!("the v4 vault has too little SOL for {new_token_accounts} new token accounts of the successor; fund it first")
            }))
            .collect();
        Ok(V4MigrationPlan {
            source: migration_source,
            source_vault,
            successor,
            vault,
            events: input.events,
            create_successor,
            creation_fee,
            governance_matches,
            inventory,
            groups,
            items,
            address_lookup_tables: input.address_lookup_tables.to_vec(),
            warnings,
        })
    }

    /// The v4 proposals of a plan: the transactions to send in order, and the v4 transaction indexes.
    #[derive(Debug, Clone, PartialEq, Eq)]
    pub struct V4MigrationProposal {
        pub transactions: Vec<Vec<Instruction>>,
        /// The v4 vault transaction with `multisig_create_from`, if the plan creates the successor.
        pub create_index: Option<u64>,
        /// The v4 batch with one migrate instruction in each entry, if the plan moves assets.
        pub batch_index: Option<u64>,
    }

    /// Builds the v4 proposals of a plan, from the current v4 `transaction_index`. Sends nothing.
    pub async fn v4_migration_proposal(
        rpc: &RpcClient,
        plan: &V4MigrationPlan,
        member: &Address,
        rent_payer: &Address,
        approve: bool,
    ) -> ClientResult<V4MigrationProposal> {
        let multisig = plan.source.source_multisig;
        let vault_index = plan.source.vault_index;
        let (member, rent_payer) = (*member, *rent_payer);
        let approval = |proposal: Address| -> ClientResult<Vec<Instruction>> {
            match approve {
                true => Ok(vec![ProposalApprove {
                    multisig,
                    member,
                    proposal,
                }
                .instruction(ProposalVoteArgs { memo: None }, V4)?]),
                false => Ok(vec![]),
            }
        };
        let proposal_create = |index: u64, draft: bool| {
            ProposalCreate {
                multisig,
                proposal: get_proposal_pda(&multisig, index, V4).0,
                creator: member,
                rent_payer,
                system_program: SYSTEM_PROGRAM_ID,
            }
            .instruction(
                ProposalCreateArgs {
                    transaction_index: index,
                    draft,
                },
                V4,
            )
        };
        let mut index = fetch_multisig(rpc, &multisig, V4).await?.transaction_index;
        let mut transactions = Vec::new();
        let mut create_index = None;

        if let Some(create) = &plan.create_successor {
            index += 1;
            create_index = Some(index);
            // The creation is small: no lookup tables, so it never waits for them.
            let transaction_message =
                transaction_message_bytes(&plan.source_vault, std::slice::from_ref(create), &[])?;
            transactions.push(vec![VaultTransactionCreate {
                multisig,
                transaction: get_transaction_pda(&multisig, index, V4).0,
                creator: member,
                rent_payer,
                system_program: SYSTEM_PROGRAM_ID,
            }
            .instruction(
                VaultTransactionCreateArgs {
                    vault_index,
                    ephemeral_signers: 0,
                    transaction_message,
                    memo: Some("create the 4r successor".into()),
                },
                V4,
            )?]);
            let proposal = get_proposal_pda(&multisig, index, V4).0;
            transactions.push([vec![proposal_create(index, false)?], approval(proposal)?].concat());
        }
        if plan.items.is_empty() {
            return Ok(V4MigrationProposal {
                transactions,
                create_index,
                batch_index: None,
            });
        }

        index += 1;
        let batch = get_transaction_pda(&multisig, index, V4).0;
        let proposal = get_proposal_pda(&multisig, index, V4).0;
        transactions.push(vec![
            BatchCreate {
                multisig,
                batch,
                creator: member,
                rent_payer,
                system_program: SYSTEM_PROGRAM_ID,
            }
            .instruction(
                BatchCreateArgs {
                    vault_index,
                    memo: Some("migrate to 4r".into()),
                },
                V4,
            )?,
            proposal_create(index, true)?,
        ]);
        for (entry, item) in plan.items.iter().enumerate() {
            let transaction_message = transaction_message_bytes(
                &plan.source_vault,
                std::slice::from_ref(&item.instruction),
                &plan.address_lookup_tables,
            )?;
            transactions.push(vec![BatchAddTransaction {
                multisig,
                proposal,
                batch,
                transaction: get_batch_transaction_pda(&multisig, index, entry as u32 + 1, V4).0,
                member,
                rent_payer,
                system_program: SYSTEM_PROGRAM_ID,
            }
            .instruction(
                BatchAddTransactionArgs {
                    ephemeral_signers: 0,
                    transaction_message,
                },
                V4,
            )?]);
        }
        transactions.push(
            [
                vec![ProposalActivate {
                    multisig,
                    member,
                    proposal,
                }
                .instruction(V4)],
                approval(proposal)?,
            ]
            .concat(),
        );
        Ok(V4MigrationProposal {
            transactions,
            create_index,
            batch_index: Some(index),
        })
    }

    /// The execute instruction of an approved v4 vault transaction.
    pub async fn v4_vault_transaction_execute_instruction(
        rpc: &RpcClient,
        source_multisig: &Address,
        transaction_index: u64,
        member: &Address,
        address_lookup_tables: &[AddressLookupTableAccount],
    ) -> ClientResult<Instruction> {
        let multisig = *source_multisig;
        let transaction = get_transaction_pda(&multisig, transaction_index, V4).0;
        let data: VaultTransaction = fetch(rpc, &transaction, V4).await?;
        Ok(vault_transaction_execute(
            &VaultTransactionExecute {
                multisig,
                proposal: get_proposal_pda(&multisig, transaction_index, V4).0,
                transaction,
                member: *member,
            },
            data.vault_index,
            data.ephemeral_signer_bumps.len() as u8,
            &data.message,
            address_lookup_tables,
            V4,
        )?)
    }

    /// The lookup tables that the pending entries of a v4 batch reference, read from the chain.
    pub async fn v4_batch_lookup_tables(
        rpc: &RpcClient,
        source_multisig: &Address,
        batch_index: u64,
    ) -> ClientResult<Vec<AddressLookupTableAccount>> {
        let multisig = *source_multisig;
        let batch: Batch =
            fetch(rpc, &get_transaction_pda(&multisig, batch_index, V4).0, V4).await?;
        let mut keys: Vec<Address> = Vec::new();
        for entry_index in batch.executed_transaction_index + 1..=batch.size {
            let transaction = get_batch_transaction_pda(&multisig, batch_index, entry_index, V4).0;
            let entry: VaultBatchTransaction = fetch(rpc, &transaction, V4).await?;
            entry
                .message
                .address_table_lookups
                .iter()
                .for_each(|lookup| push_new(&mut keys, lookup.account_key, |k| *k));
        }
        if keys.is_empty() {
            return Ok(Vec::new());
        }
        rpc.get_multiple_accounts(&keys)
            .await?
            .into_iter()
            .zip(&keys)
            .map(|(account, key)| {
                account
                    .and_then(|account| parse_lookup_table(*key, &account.data))
                    .ok_or_else(|| ClientError::Plan(format!("lookup table {key} not found")))
            })
            .collect()
    }

    /// The execute instruction of each entry of an approved v4 batch that is not executed yet.
    /// Send them in order: a failed entry blocks the ones after it. With lookup tables, compile
    /// each execute transaction with the same tables.
    pub async fn v4_batch_execute_instructions(
        rpc: &RpcClient,
        source_multisig: &Address,
        batch_index: u64,
        member: &Address,
        address_lookup_tables: &[AddressLookupTableAccount],
    ) -> ClientResult<Vec<Instruction>> {
        let multisig = *source_multisig;
        let batch = get_transaction_pda(&multisig, batch_index, V4).0;
        let proposal = get_proposal_pda(&multisig, batch_index, V4).0;
        let data: Batch = fetch(rpc, &batch, V4).await?;
        let vault = get_vault_pda(&multisig, data.vault_index, V4).0;
        let mut instructions = Vec::new();
        for entry_index in data.executed_transaction_index + 1..=data.size {
            let transaction = get_batch_transaction_pda(&multisig, batch_index, entry_index, V4).0;
            let entry: VaultBatchTransaction = fetch(rpc, &transaction, V4).await?;
            let mut instruction = BatchExecuteTransaction {
                multisig,
                member: *member,
                proposal,
                batch,
                transaction,
            }
            .instruction(V4);
            instruction.accounts.extend(accounts_for_execute(
                &entry.message,
                &vault,
                &transaction,
                address_lookup_tables,
                entry.ephemeral_signer_bumps.len() as u8,
                V4,
            )?);
            instructions.push(instruction);
        }
        Ok(instructions)
    }
}
