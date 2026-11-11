//! Migration from v3 (Squads MPL). The successor of a v3 multisig is the 4r multisig whose
//! `create_key` is the v3 multisig address; only a v3 authority, after v3 consensus, creates it.
//! v3 has no permissions, time lock, config authority or rent collector, so every successor member
//! gets every permission and the successor has none of the others. Authority `N` moves to vault `N - 1`.

use solana_address::Address;

use super::MirroredConfig;
use crate::errors::MultisigError;
use crate::state::{Member, Multisig, Permissions};

pub const LEGACY_V3_PROGRAM_ID: Address =
    Address::from_str_const("SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu");

/// `sha256("account:Ms")[..8]`: the Anchor discriminator of the v3 `Ms` account.
pub const MS_DISCRIMINATOR: [u8; 8] = [70, 118, 9, 108, 254, 215, 31, 120];

pub const SEED_SQUAD: &[u8] = b"squad";
pub const SEED_MULTISIG: &[u8] = b"multisig";
pub const SEED_AUTHORITY: &[u8] = b"authority";

/// The highest v3 authority index with a successor vault: `N - 1` must fit a `u8`.
pub const MAX_AUTHORITY_INDEX: u32 = 256;

/// The v3 `Ms` layout: discriminator (8), threshold (u16), authority index (u16), transaction
/// index (u32), change index (u32), bump (u8), create key (32), allow external execute (bool),
/// then the keys (u32 length, 32 bytes each).
const THRESHOLD_OFFSET: usize = 8;
const KEYS_LENGTH_OFFSET: usize = 54;
const KEYS_OFFSET: usize = 58;

/// Initiate, Vote and Execute: the permissions of every v3 member.
const ALL_PERMISSIONS: Permissions = Permissions { mask: 0b111 };

/// The v3 multisig PDA of `create_key`.
pub fn get_v3_multisig_pda(create_key: &Address) -> (Address, u8) {
    Address::find_program_address(
        &[SEED_SQUAD, create_key.as_ref(), SEED_MULTISIG],
        &LEGACY_V3_PROGRAM_ID,
    )
}

/// The v3 authority (vault) `authority_index` of `multisig`. v3 signs for it in
/// `execute_transaction` and `execute_instruction`, after the v3 approvals.
pub fn get_v3_authority_pda(multisig: &Address, authority_index: u32) -> (Address, u8) {
    Address::find_program_address(
        &[
            SEED_SQUAD,
            multisig.as_ref(),
            &authority_index.to_le_bytes(),
            SEED_AUTHORITY,
        ],
        &LEGACY_V3_PROGRAM_ID,
    )
}

/// The successor vault index of v3 authority `authority_index`: `authority_index - 1`. Fails
/// outside 1 to 256: authority 0 is the v3 multisig itself, and higher indexes have no vault.
pub fn v3_vault_index(authority_index: u32) -> Result<u8, MultisigError> {
    authority_index
        .checked_sub(1)
        .and_then(|index| u8::try_from(index).ok())
        .ok_or(MultisigError::MigrationInvalidAuthorityIndex)
}

/// The seed byte of the successor vault of `authority_index` in `MigrationAccountsV3`. Valid only
/// after the range check (1 to 256); there it equals `v3_vault_index` (a Kani proof checks it).
pub fn v3_vault_seed(authority_index: u32) -> [u8; 1] {
    [authority_index.wrapping_sub(1) as u8]
}

/// The governance of a v3 multisig.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct V3Multisig {
    pub threshold: u16,
    pub keys: Vec<Address>,
}

/// The member count of v3 `Ms` account data, read without decoding the keys. `None` without the
/// `Ms` discriminator.
pub fn v3_member_count(data: &[u8]) -> Option<usize> {
    if !data.starts_with(&MS_DISCRIMINATOR) {
        return None;
    }
    let length = data.get(KEYS_LENGTH_OFFSET..KEYS_OFFSET)?;
    usize::try_from(u32::from_le_bytes(length.try_into().ok()?)).ok()
}

/// Decodes the governance of a v3 `Ms` account owned by `owner`. `None` for another owner, another
/// discriminator, or data that is too short. Bytes after the keys (realloc headroom) are ignored.
pub fn decode_v3_multisig(owner: &Address, data: &[u8]) -> Option<V3Multisig> {
    if *owner != LEGACY_V3_PROGRAM_ID {
        return None;
    }
    let count = v3_member_count(data)?;
    let threshold = data.get(THRESHOLD_OFFSET..THRESHOLD_OFFSET + 2)?;
    let end = count.checked_mul(32)?.checked_add(KEYS_OFFSET)?;
    let keys = data
        .get(KEYS_OFFSET..end)?
        .as_chunks::<32>()
        .0
        .iter()
        .map(|key| Address::new_from_array(*key))
        .collect();
    Some(V3Multisig {
        threshold: u16::from_le_bytes(threshold.try_into().ok()?),
        keys,
    })
}

/// The successor config of a v3 multisig: its keys with every permission, sorted by key (v3 keeps
/// them sorted), its threshold, and no time lock, config authority or rent collector.
pub fn mirror_v3(source: &V3Multisig) -> MirroredConfig {
    let mut members: Vec<Member> = source
        .keys
        .iter()
        .map(|key| Member {
            key: *key,
            permissions: ALL_PERMISSIONS,
        })
        .collect();
    members.sort_by_key(|member| member.key);
    MirroredConfig {
        config_authority: Address::default(),
        threshold: source.threshold,
        time_lock: 0,
        rent_collector: None,
        members,
    }
}

/// Fails unless `successor` has the governance that `mirror_v3` gives `source`: the same members
/// with every permission, the same threshold, no time lock and no config authority.
pub fn check_same_governance_v3(
    source: &V3Multisig,
    successor: &Multisig,
) -> Result<(), MultisigError> {
    let mirror = mirror_v3(source);
    let same = successor.members == mirror.members
        && successor.threshold == mirror.threshold
        && successor.time_lock == mirror.time_lock
        && successor.config_authority == mirror.config_authority;
    same.then_some(())
        .ok_or(MultisigError::MigrationGovernanceMismatch)
}

#[cfg(feature = "program")]
pub use onchain::*;

#[cfg(feature = "program")]
mod onchain {
    use anchor_lang::prelude::*;

    use super::V3Multisig;
    use crate::errors::MultisigError;
    use crate::state::Multisig;

    /// Decodes a v3 `Ms` account after the owner and discriminator checks.
    pub fn load_v3_multisig(info: &AccountInfo) -> Result<V3Multisig> {
        super::decode_v3_multisig(info.owner, &info.try_borrow_data()?)
            .ok_or_else(|| error!(MultisigError::InvalidAccount))
    }

    /// The account size of the successor of the v3 multisig `info`.
    pub fn successor_size_v3(info: &AccountInfo) -> Result<usize> {
        super::v3_member_count(&info.try_borrow_data()?)
            .map(Multisig::size)
            .ok_or_else(|| error!(MultisigError::InvalidAccount))
    }
}
