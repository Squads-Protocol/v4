//! Kani proofs of the migration rules in `migration.rs`. They compile only under `cargo kani`, so
//! the program, its types and its account layouts do not change. Run:
//! `cargo kani -p squads-multisig-4r-program --no-default-features`.

use solana_address::Address;

use super::{check_same_governance, map_vault, mirror, v4_member_count, VaultHints};
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

fn any_members() -> Vec<Member> {
    let len: usize = kani::any_where(|len| *len <= MAX_MEMBERS);
    (0..len)
        .map(|_| Member {
            key: any_address(),
            permissions: Permissions { mask: kani::any() },
        })
        .collect()
}

fn any_multisig() -> Multisig {
    Multisig {
        create_key: any_address(),
        config_authority: any_address(),
        threshold: kani::any(),
        time_lock: kani::any(),
        transaction_index: kani::any(),
        stale_transaction_index: kani::any(),
        rent_collector: any_option_address(),
        bump: kani::any(),
        members: any_members(),
    }
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

#[kani::proof]
#[kani::unwind(3)]
#[kani::stub(crate::pda::get_vault_pda, stub_vault_pda)]
fn mirror_copies_the_governance() {
    // Arrange
    let source = any_multisig();
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

#[kani::proof]
#[kani::unwind(3)]
#[kani::stub(crate::pda::get_vault_pda, stub_vault_pda)]
fn a_mirrored_successor_passes_the_governance_check() {
    // Arrange
    let source = any_multisig();
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
    kani::cover!(source.members.len() == MAX_MEMBERS, "a full member list");
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
