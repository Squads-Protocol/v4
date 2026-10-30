//! Kani proofs of the migration rules in `migration.rs` and `migration/v3.rs`. They compile only under `cargo kani`, so
//! the program, its types and its account layouts do not change. Run:
//! `cargo kani -p squads-multisig-4r-program --no-default-features`.

use solana_address::Address;

use super::v3::{
    check_same_governance_v3, decode_v3_multisig, mirror_v3, v3_member_count, v3_vault_index,
    v3_vault_seed, V3Multisig, LEGACY_V3_PROGRAM_ID, MAX_AUTHORITY_INDEX, MS_DISCRIMINATOR,
};
use super::{
    check_same_governance, map_vault, migrate_item_count, mirror, v4_member_count, VaultHints,
    MAX_MIGRATE_ITEMS,
};
use crate::errors::MultisigError;
use crate::state::{Member, Multisig, Permissions};
use crate::LEGACY_V4_PROGRAM_ID;

/// Members of each symbolic multisig. Two members already cover the empty, one and many cases of
/// the vector comparisons. The address comparison (`memcmp`, 32 bytes) gets its own loop bound of
/// 33 (`[workspace.metadata.kani]` in the root `Cargo.toml`).
const MAX_MEMBERS: usize = 2;

/// Replaces the PDA derivation, which hashes with SHA-256 out of reach of the solver. It is
/// deterministic and gives a different address for each index, program and multisig byte.
fn stub_vault_pda(multisig: &Address, index: u8, program_id: Option<&Address>) -> (Address, u8) {
    let program = program_id.unwrap_or(&crate::ID).to_bytes();
    let mut bytes = multisig.to_bytes();
    bytes[0] ^= index;
    bytes[1] ^= program[0];
    (Address::new_from_array(bytes), 255)
}

/// An address with two symbolic bytes. The code under proof only compares addresses, and the stub
/// reads bytes 0 and 1, so two bytes give every equality pattern that the proofs can observe.
fn any_address() -> Address {
    let mut bytes = [0u8; 32];
    bytes[0] = kani::any();
    bytes[1] = kani::any();
    Address::new_from_array(bytes)
}

fn any_option_address() -> Option<Address> {
    kani::any::<bool>().then(any_address)
}

/// `len` members with symbolic values. A constant `len` gives an allocation of constant size.
fn members_of(len: usize) -> Vec<Member> {
    (0..len)
        .map(|_| Member {
            key: any_address(),
            permissions: Permissions { mask: kani::any() },
        })
        .collect()
}

fn any_multisig() -> Multisig {
    multisig_with(kani::any_where(|len| *len <= MAX_MEMBERS))
}

fn multisig_with(member_count: usize) -> Multisig {
    Multisig {
        create_key: any_address(),
        config_authority: any_address(),
        threshold: kani::any(),
        time_lock: kani::any(),
        transaction_index: kani::any(),
        stale_transaction_index: kani::any(),
        rent_collector: any_option_address(),
        bump: kani::any(),
        members: members_of(member_count),
    }
}

// `Vec::clone` of a symbolic length needs more than 30 GB in CBMC, so harnesses that clone the
// members (`mirror`) run once for each member count, each with a constant length.
macro_rules! for_each_member_count {
    ($check:ident) => {
        mod $check {
            #[kani::proof]
            #[kani::unwind(3)]
            #[kani::stub(crate::pda::get_vault_pda, super::stub_vault_pda)]
            fn no_members() {
                super::$check(0);
            }

            #[kani::proof]
            #[kani::unwind(3)]
            #[kani::stub(crate::pda::get_vault_pda, super::stub_vault_pda)]
            fn one_member() {
                super::$check(1);
            }

            #[kani::proof]
            #[kani::unwind(3)]
            #[kani::stub(crate::pda::get_vault_pda, super::stub_vault_pda)]
            fn two_members() {
                super::$check(super::MAX_MEMBERS);
            }
        }
    };
}

fn any_hints() -> VaultHints {
    VaultHints {
        config_authority: kani::any(),
        rent_collector: kani::any(),
    }
}

/// The successor that `multisig_create_from` writes, with symbolic values in the other fields.
fn successor_from(
    source: &Multisig,
    hints: VaultHints,
    keys: (&Address, &Address),
) -> Option<Multisig> {
    let config = mirror(source, keys.0, keys.1, hints, None).ok()?;
    Some(Multisig {
        create_key: *keys.0,
        config_authority: config.config_authority,
        threshold: config.threshold,
        time_lock: config.time_lock,
        transaction_index: kani::any(),
        stale_transaction_index: kani::any(),
        rent_collector: config.rent_collector,
        bump: kani::any(),
        members: config.members,
    })
}

#[kani::proof]
#[kani::stub(crate::pda::get_vault_pda, stub_vault_pda)]
fn map_vault_without_a_hint_keeps_the_value() {
    // Arrange
    let (value, source, successor) = (any_address(), any_address(), any_address());

    // Act
    let mapped = map_vault(&value, None, &source, &successor, None);

    // Assert
    assert_eq!(mapped, Ok(value));
}

#[kani::proof]
#[kani::stub(crate::pda::get_vault_pda, stub_vault_pda)]
fn map_vault_maps_only_the_named_v4_vault() {
    // Arrange
    let (value, source, successor) = (any_address(), any_address(), any_address());
    let index: u8 = kani::any();
    let program_id = any_option_address();

    // Act
    let mapped = map_vault(
        &value,
        Some(index),
        &source,
        &successor,
        program_id.as_ref(),
    );

    // Assert: the hint must name the v4 vault; then the result is the successor vault.
    let named = stub_vault_pda(&source, index, Some(&LEGACY_V4_PROGRAM_ID)).0 == value;
    let expected = stub_vault_pda(&successor, index, program_id.as_ref()).0;
    match named {
        true => assert_eq!(mapped, Ok(expected)),
        false => assert_eq!(mapped, Err(MultisigError::MigrationInvalidVaultHint)),
    }
    kani::cover!(named, "the hint names the v4 vault");
}

for_each_member_count!(mirror_copies_the_governance);

fn mirror_copies_the_governance(member_count: usize) {
    // Arrange
    let source = multisig_with(member_count);
    let (source_key, successor_key) = (any_address(), any_address());
    let hints = any_hints();

    // Act
    let mirrored = mirror(&source, &source_key, &successor_key, hints, None);

    // Assert: a rent collector hint without a v4 rent collector fails; else the fields are copied.
    let Ok(config) = mirrored else {
        return;
    };
    assert!(source.rent_collector.is_some() || hints.rent_collector.is_none());
    assert_eq!(config.members, source.members);
    assert_eq!(config.threshold, source.threshold);
    assert_eq!(config.time_lock, source.time_lock);
    assert_eq!(
        config.rent_collector.is_some(),
        source.rent_collector.is_some()
    );
    let authority = map_vault(
        &source.config_authority,
        hints.config_authority,
        &source_key,
        &successor_key,
        None,
    );
    assert_eq!(authority, Ok(config.config_authority));
    kani::cover!(
        hints.rent_collector.is_some(),
        "a hinted rent collector is mapped"
    );
}

for_each_member_count!(a_mirrored_successor_passes_the_governance_check);

fn a_mirrored_successor_passes_the_governance_check(member_count: usize) {
    // Arrange
    let source = multisig_with(member_count);
    let (source_key, successor_key) = (any_address(), any_address());
    let hints = any_hints();
    let Some(successor) = successor_from(&source, hints, (&source_key, &successor_key)) else {
        return;
    };

    // Act
    let checked = check_same_governance(
        &source,
        &successor,
        &source_key,
        &successor_key,
        hints.config_authority,
        None,
    );

    // Assert
    assert_eq!(checked, Ok(()));
    kani::cover!(
        hints.config_authority.is_some(),
        "a hinted successor exists"
    );
}

#[kani::proof]
#[kani::unwind(3)]
#[kani::stub(crate::pda::get_vault_pda, stub_vault_pda)]
fn the_check_passes_exactly_for_equal_governance() {
    // Arrange: any two multisigs, so every change of every field is a case.
    let (source, successor) = (any_multisig(), any_multisig());
    let (source_key, successor_key) = (any_address(), any_address());
    let hint: Option<u8> = kani::any();

    // Act
    let checked =
        check_same_governance(&source, &successor, &source_key, &successor_key, hint, None);

    // Assert: a bad hint fails (6047); else the check passes if and only if each field is equal.
    let Ok(authority) = map_vault(
        &source.config_authority,
        hint,
        &source_key,
        &successor_key,
        None,
    ) else {
        assert_eq!(checked, Err(MultisigError::MigrationInvalidVaultHint));
        return;
    };
    let same = successor.members == source.members
        && successor.threshold == source.threshold
        && successor.time_lock == source.time_lock
        && successor.config_authority == authority;
    match same {
        true => assert_eq!(checked, Ok(())),
        false => assert_eq!(checked, Err(MultisigError::MigrationGovernanceMismatch)),
    }
    kani::cover!(same && hint.is_some(), "a hinted config authority can pass");
    kani::cover!(
        !same && successor.members.len() == source.members.len(),
        "same member count, other members"
    );
}

#[kani::proof]
#[kani::unwind(3)]
#[kani::stub(crate::pda::get_vault_pda, stub_vault_pda)]
fn the_rent_collector_does_not_affect_the_check() {
    // Arrange
    let source = any_multisig();
    let (source_key, successor_key) = (any_address(), any_address());
    let mut successor = any_multisig();
    let hint: Option<u8> = kani::any();
    let check = |successor: &Multisig| {
        check_same_governance(&source, successor, &source_key, &successor_key, hint, None)
    };
    let before = check(&successor);

    // Act
    successor.rent_collector = any_option_address();

    // Assert
    assert_eq!(check(&successor), before);
}

/// Bytes of a v4 `Multisig` up to the member count with a `Some` rent collector: 8 + 120 + 4.
const V4_PREFIX_LEN: usize = 132;

#[kani::proof]
#[kani::unwind(10)]
fn v4_member_count_reads_only_the_layout() {
    // Arrange: any bytes, of any length up to the member count and a little more.
    let bytes: [u8; V4_PREFIX_LEN + 2] = kani::any();
    let len: usize = kani::any_where(|len| *len <= bytes.len());
    let data = &bytes[..len];

    // Act: it must not panic for any input.
    let count = v4_member_count(data);

    // Assert: a count comes only from the v4 layout, at the offset that the rent collector sets.
    let Some(count) = count else {
        return;
    };
    assert!(data.starts_with(&crate::discriminator::account::MULTISIG));
    let offset = match data[8 + 86] {
        0 => 8 + 88,
        1 => 8 + 120,
        _ => unreachable!("only None (0) or Some (1) gives a count"),
    };
    let length: [u8; 4] = data[offset..offset + 4].try_into().expect("in bounds");
    assert_eq!(count, u32::from_le_bytes(length) as usize);
    kani::cover!(data[8 + 86] == 1, "a v4 multisig with a rent collector");
}

// v3 (`migration/v3.rs`). The keys have two symbolic bytes, as above.

/// A v3 multisig with `key_count` keys and a symbolic threshold.
fn v3_multisig_with(key_count: usize) -> V3Multisig {
    V3Multisig {
        threshold: kani::any(),
        keys: (0..key_count).map(|_| any_address()).collect(),
    }
}

/// The successor members of `keys`, written without `mirror_v3`: each key with Initiate, Vote and
/// Execute (mask 7), in key order. At most two keys, so one compare sorts them.
fn expected_v3_members(keys: &[Address]) -> Vec<Member> {
    let member = |key: &Address| Member {
        key: *key,
        permissions: Permissions { mask: 7 },
    };
    match keys {
        [a, b] if b < a => vec![member(b), member(a)],
        _ => keys.iter().map(member).collect(),
    }
}

macro_rules! for_each_v3_key_count {
    ($check:ident) => {
        mod $check {
            #[kani::proof]
            #[kani::unwind(3)]
            fn no_keys() {
                super::$check(0);
            }

            #[kani::proof]
            #[kani::unwind(3)]
            fn one_key() {
                super::$check(1);
            }

            #[kani::proof]
            #[kani::unwind(3)]
            fn two_keys() {
                super::$check(super::MAX_MEMBERS);
            }
        }
    };
}

#[kani::proof]
fn v3_vault_index_maps_exactly_1_to_256_one_to_one() {
    // Arrange
    let (a, b): (u32, u32) = (kani::any(), kani::any());

    // Act
    let (vault_a, vault_b) = (v3_vault_index(a), v3_vault_index(b));

    // Assert: authority N gives vault N - 1 for N in 1..=256, an error otherwise, and two
    // authorities never share a vault.
    match (1..=MAX_AUTHORITY_INDEX).contains(&a) {
        true => assert_eq!(vault_a, Ok((a - 1) as u8)),
        false => assert_eq!(vault_a, Err(MultisigError::MigrationInvalidAuthorityIndex)),
    }
    if let (Ok(x), Ok(y)) = (vault_a, vault_b) {
        assert_eq!(x == y, a == b);
    }
}

fn mirror_v3_copies_the_governance(key_count: usize) {
    // Arrange
    let source = v3_multisig_with(key_count);

    // Act
    let config = mirror_v3(&source);

    // Assert
    assert!(config.members == expected_v3_members(&source.keys));
    assert_eq!(config.threshold, source.threshold);
    assert_eq!(config.time_lock, 0);
    assert!(config.config_authority == Address::default());
    assert!(config.rent_collector.is_none());
}
for_each_v3_key_count!(mirror_v3_copies_the_governance);

fn a_mirrored_v3_successor_passes_the_check(key_count: usize) {
    // Arrange
    let source = v3_multisig_with(key_count);
    let config = mirror_v3(&source);
    let mut successor = multisig_with(0);
    successor.members = config.members;
    successor.threshold = config.threshold;
    successor.time_lock = config.time_lock;
    successor.config_authority = config.config_authority;
    successor.rent_collector = config.rent_collector;

    // Act + Assert
    assert_eq!(check_same_governance_v3(&source, &successor), Ok(()));
}
for_each_v3_key_count!(a_mirrored_v3_successor_passes_the_check);

fn the_v3_check_passes_exactly_for_equal_governance(key_count: usize) {
    // Arrange: any v3 multisig and any successor (any rent collector and counters).
    let source = v3_multisig_with(key_count);
    let successor = multisig_with(kani::any_where(|len| *len <= MAX_MEMBERS));

    // Act
    let result = check_same_governance_v3(&source, &successor);

    // Assert
    let equal = successor.members == expected_v3_members(&source.keys)
        && successor.threshold == source.threshold
        && successor.time_lock == 0
        && successor.config_authority == Address::default();
    match equal {
        true => assert_eq!(result, Ok(())),
        false => assert_eq!(result, Err(MultisigError::MigrationGovernanceMismatch)),
    }
}
for_each_v3_key_count!(the_v3_check_passes_exactly_for_equal_governance);

/// Bytes of a v3 `Ms` with two keys: 58 + 2 * 32.
const V3_TWO_KEYS_LEN: usize = 122;

#[kani::proof]
#[kani::unwind(10)]
fn v3_member_count_reads_only_the_layout() {
    // Arrange: any bytes, up to the key count and a little more.
    let bytes: [u8; 60] = kani::any();
    let len: usize = kani::any_where(|len| *len <= bytes.len());
    let data = &bytes[..len];

    // Act: it must not panic for any input.
    let count = v3_member_count(data);

    // Assert: a count comes only from the `Ms` layout, at byte 54.
    let Some(count) = count else {
        return;
    };
    assert!(data.starts_with(&MS_DISCRIMINATOR));
    let length: [u8; 4] = data[54..58].try_into().expect("in bounds");
    assert_eq!(count, u32::from_le_bytes(length) as usize);
}

#[kani::proof]
#[kani::unwind(10)]
fn decode_v3_multisig_reads_only_owned_complete_ms_data() {
    // Arrange: any owner and any bytes up to two keys and a little more.
    let owner = match kani::any() {
        true => LEGACY_V3_PROGRAM_ID,
        false => any_address(),
    };
    let bytes: [u8; V3_TWO_KEYS_LEN + 2] = kani::any();
    let len: usize = kani::any_where(|len| *len <= bytes.len());
    let data = &bytes[..len];

    // Act: it must not panic for any input.
    let decoded = decode_v3_multisig(&owner, data);

    // Assert: a result needs the v3 owner, the discriminator, and every key in the data; the
    // threshold and the keys are the bytes at their offsets.
    let Some(ms) = decoded else {
        return;
    };
    assert!(owner == LEGACY_V3_PROGRAM_ID);
    assert_eq!(Some(ms.keys.len()), v3_member_count(data));
    assert!(58 + 32 * ms.keys.len() <= len);
    assert_eq!(ms.threshold, u16::from_le_bytes([data[8], data[9]]));
    ms.keys.iter().enumerate().for_each(|(i, key)| {
        assert!(key.as_ref() == &data[58 + 32 * i..90 + 32 * i]);
    });
    kani::cover!(ms.keys.len() == 2, "two keys");
}

#[kani::proof]
fn v3_vault_seed_is_the_vault_index_in_range() {
    // Arrange
    let authority_index: u32 = kani::any();

    // Act
    let seed = v3_vault_seed(authority_index);

    // Assert: in the range that the accounts allow, the seed of the `vault` account is the vault
    // index that the event and `MigrationCall` use, so the two can never name different vaults.
    if let Ok(index) = v3_vault_index(authority_index) {
        assert_eq!(seed, [index]);
    }
    kani::cover!(authority_index == 256, "the last authority");
}

#[kani::proof]
fn migrate_item_count_accepts_only_whole_items_up_to_the_limit() {
    // Arrange: any account count, and the per-item counts of every migrate instruction (0 for SOL,
    // 1 for authorities, 3 for tokens).
    let accounts: usize = kani::any();
    let per_item: usize = kani::any_where(|n: &usize| *n <= 3);

    // Act
    let result = migrate_item_count(accounts, per_item);

    // Assert
    let whole = match per_item {
        0 => accounts == 0,
        n => accounts % n == 0,
    };
    let items = if per_item == 0 {
        0
    } else {
        accounts / per_item
    };
    match (whole, items <= MAX_MIGRATE_ITEMS) {
        (false, _) => assert_eq!(result, Err(MultisigError::MigrationInvalidAssetAccounts)),
        (true, false) => assert_eq!(result, Err(MultisigError::InvalidInstructionArgs)),
        (true, true) => assert_eq!(result, Ok(items)),
    }
    kani::cover!(
        per_item == 3 && items == MAX_MIGRATE_ITEMS && whole,
        "64 tokens"
    );
}
