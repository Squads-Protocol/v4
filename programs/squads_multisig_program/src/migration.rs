//! Migration from v4. The successor of a v4 multisig is the 4r multisig whose `create_key` is the
//! v4 multisig address. v4 never signs as a multisig PDA, so only `multisig_create_from`, signed
//! by a v4 vault after v4 consensus, can create it. The `multisig_migrate_*` instructions move one
//! asset class each from a v4 vault to the successor vault with the same index, while both
//! multisigs have the same governance.

use solana_address::Address;
use solana_instruction::AccountMeta;

use crate::errors::MultisigError;
use crate::pda::{get_multisig_pda, get_vault_pda};
use crate::state::{Member, Multisig};
use crate::LEGACY_V4_PROGRAM_ID;

pub const TOKEN_PROGRAM_ID: Address =
    Address::from_str_const("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
pub const TOKEN_2022_PROGRAM_ID: Address =
    Address::from_str_const("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
pub const ASSOCIATED_TOKEN_PROGRAM_ID: Address =
    Address::from_str_const("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
pub const BPF_LOADER_UPGRADEABLE_ID: Address =
    Address::from_str_const("BPFLoaderUpgradeab1e11111111111111111111111");
pub const STAKE_PROGRAM_ID: Address =
    Address::from_str_const("Stake11111111111111111111111111111111111111");
pub const VOTE_PROGRAM_ID: Address =
    Address::from_str_const("Vote111111111111111111111111111111111111111");
pub const CLOCK_SYSVAR_ID: Address =
    Address::from_str_const("SysvarC1ock11111111111111111111111111111111");

/// The most items in one `multisig_migrate_*` call. It keeps the event under the CPI data limit.
pub const MAX_MIGRATE_ITEMS: usize = 64;

/// The 4r successor of a v4 multisig: the multisig PDA with `create_key = v4_multisig`.
pub fn get_successor_pda(v4_multisig: &Address, program_id: Option<&Address>) -> (Address, u8) {
    get_multisig_pda(v4_multisig, program_id)
}

pub fn get_associated_token_address(
    owner: &Address,
    mint: &Address,
    token_program: &Address,
) -> Address {
    Address::find_program_address(
        &[owner.as_ref(), token_program.as_ref(), mint.as_ref()],
        &ASSOCIATED_TOKEN_PROGRAM_ID,
    )
    .0
}

/// The member count of a v4 `Multisig` account, read without decoding the members. The
/// `rent_collector` option (at byte 94) is 1 byte when `None` and 33 bytes when `Some`.
pub fn v4_member_count(data: &[u8]) -> Option<usize> {
    let rest = data.strip_prefix(&crate::discriminator::account::MULTISIG)?;
    let members_offset = match rest.get(86)? {
        0 => 88,
        1 => 120,
        _ => return None,
    };
    let length = rest.get(members_offset..members_offset + 4)?;
    usize::try_from(u32::from_le_bytes(length.try_into().ok()?)).ok()
}

/// Vault indexes of source fields that hold a v4 vault of the source multisig.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub struct VaultHints {
    pub config_authority: Option<u8>,
    pub rent_collector: Option<u8>,
}

/// Maps `value` from the v4 vault `hint` of `source` to the vault with the same index of
/// `successor`. Without a hint, `value` stays. A hint that does not name `value` fails.
pub fn map_vault(
    value: &Address,
    hint: Option<u8>,
    source: &Address,
    successor: &Address,
    program_id: Option<&Address>,
) -> Result<Address, MultisigError> {
    let Some(index) = hint else {
        return Ok(*value);
    };
    match get_vault_pda(source, index, Some(&LEGACY_V4_PROGRAM_ID)).0 == *value {
        true => Ok(get_vault_pda(successor, index, program_id).0),
        false => Err(MultisigError::MigrationInvalidVaultHint),
    }
}

/// The successor config: the source config, with the hinted vault fields mapped.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MirroredConfig {
    pub config_authority: Address,
    pub threshold: u16,
    pub time_lock: u32,
    pub rent_collector: Option<Address>,
    pub members: Vec<Member>,
}

pub fn mirror(
    source: &Multisig,
    source_key: &Address,
    successor_key: &Address,
    hints: VaultHints,
    program_id: Option<&Address>,
) -> Result<MirroredConfig, MultisigError> {
    let map = |value: &Address, hint| map_vault(value, hint, source_key, successor_key, program_id);
    let rent_collector = match (source.rent_collector, hints.rent_collector) {
        (Some(rent_collector), hint) => Some(map(&rent_collector, hint)?),
        (None, Some(_)) => return Err(MultisigError::MigrationInvalidVaultHint),
        (None, None) => None,
    };
    Ok(MirroredConfig {
        config_authority: map(&source.config_authority, hints.config_authority)?,
        threshold: source.threshold,
        time_lock: source.time_lock,
        rent_collector,
        members: source.members.clone(),
    })
}

/// Fails unless `successor` has the governance of `source`: the same members and permissions,
/// threshold, time lock and config authority (mapped with the hint). Both programs keep
/// `members` sorted by key, so the vectors compare directly.
pub fn check_same_governance(
    source: &Multisig,
    successor: &Multisig,
    source_key: &Address,
    successor_key: &Address,
    config_authority_hint: Option<u8>,
    program_id: Option<&Address>,
) -> Result<(), MultisigError> {
    let config_authority = map_vault(
        &source.config_authority,
        config_authority_hint,
        source_key,
        successor_key,
        program_id,
    )?;
    let same = successor.members == source.members
        && successor.threshold == source.threshold
        && successor.time_lock == source.time_lock
        && successor.config_authority == config_authority;
    same.then_some(())
        .ok_or(MultisigError::MigrationGovernanceMismatch)
}

/// One token of `multisig_migrate_tokens`: a token account of the v4 vault and its mint.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TokenItem {
    pub source_token_account: Address,
    pub mint: Address,
}

impl TokenItem {
    /// The remaining accounts of this token: the source, the mint and the destination (the
    /// associated token account of the successor `vault`).
    pub fn metas(&self, vault: &Address, token_program: &Address) -> [AccountMeta; 3] {
        let meta = |pubkey: Address, is_writable: bool| AccountMeta {
            pubkey,
            is_signer: false,
            is_writable,
        };
        [
            meta(self.source_token_account, true),
            meta(self.mint, false),
            meta(
                get_associated_token_address(vault, &self.mint, token_program),
                true,
            ),
        ]
    }
}

/// The remaining accounts of the instructions with one writable account for each item (token
/// authorities, stakes, vote accounts, program data).
pub fn item_metas(accounts: &[Address]) -> Vec<AccountMeta> {
    accounts
        .iter()
        .map(|pubkey| AccountMeta {
            pubkey: *pubkey,
            is_signer: false,
            is_writable: true,
        })
        .collect()
}

#[cfg(feature = "program")]
pub use onchain::*;

#[cfg(feature = "program")]
mod onchain {
    use anchor_lang::prelude::*;

    use crate::errors::MultisigError;
    use crate::state::Multisig;
    use crate::LEGACY_V4_PROGRAM_ID;

    /// Decodes a v4 `Multisig` after the owner and discriminator checks.
    pub fn load_v4_multisig(info: &AccountInfo) -> Result<Multisig> {
        let data = info.try_borrow_data()?;
        crate::account::decode_checked::<Multisig>(
            info.key,
            info.owner,
            &data,
            Some(&LEGACY_V4_PROGRAM_ID),
        )
        .map_err(|_| error!(MultisigError::InvalidAccount))
    }

    /// The account size of the successor of the v4 multisig `info`.
    pub fn successor_size(info: &AccountInfo) -> Result<usize> {
        super::v4_member_count(&info.try_borrow_data()?)
            .map(Multisig::size)
            .ok_or_else(|| error!(MultisigError::InvalidAccount))
    }
}

// Last in the file: a declaration above other code would move its line numbers in the binary.
#[cfg(kani)]
mod proofs;
