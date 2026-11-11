//! Migration from v3: the v3 account reader against mainnet accounts, the authority index map, the
//! mirrored config and the governance check. Runs with and without the `program` feature.

mod common;

use std::str::FromStr;

use common::{fixtures, flags, idl_account_flags, idl_discriminator, V3_ACCOUNTS};
use solana_address::Address;
use squads_multisig_4r_program::discriminator::instruction;
use squads_multisig_4r_program::errors::MultisigError;
use squads_multisig_4r_program::instructions::*;
use squads_multisig_4r_program::migration::v3::*;
use squads_multisig_4r_program::migration::{
    get_successor_pda, TokenItem, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID,
};
use squads_multisig_4r_program::pda::{get_multisig_pda, get_vault_pda};
use squads_multisig_4r_program::state::{Member, Multisig, Permission, Permissions};
use squads_multisig_4r_program::{builders, ID};

fn key(byte: u8) -> Address {
    Address::new_from_array([byte; 32])
}

/// The mainnet v3 `Ms` fixtures: address and account data.
fn v3_accounts() -> Vec<(Address, Vec<u8>)> {
    fixtures(V3_ACCOUNTS)
        .map(|(label, id, data)| {
            assert_eq!(label, "Ms");
            (Address::from_str(id).expect("address"), data)
        })
        .collect()
}

/// `Ms` account data with these keys and threshold, and `headroom` spare bytes.
fn ms_data(threshold: u16, keys: &[Address], headroom: usize) -> Vec<u8> {
    let count = u32::try_from(keys.len()).expect("count");
    [
        MS_DISCRIMINATOR.as_slice(),
        &threshold.to_le_bytes(),
        &[0; 44],
        &count.to_le_bytes(),
        &keys
            .iter()
            .flat_map(|key| key.to_bytes())
            .collect::<Vec<_>>(),
        &vec![0; headroom],
    ]
    .concat()
}

/// A successor with exactly the config that `multisig_create_from_v3` gives it.
fn mirrored_successor(source_key: &Address, source: &V3Multisig) -> Multisig {
    let config = mirror_v3(source);
    Multisig {
        create_key: *source_key,
        config_authority: config.config_authority,
        threshold: config.threshold,
        time_lock: config.time_lock,
        transaction_index: 0,
        stale_transaction_index: 0,
        rent_collector: config.rent_collector,
        bump: 255,
        members: config.members,
    }
}

#[test]
fn mainnet_v3_multisigs_decode_and_match_their_pda() {
    // Arrange
    let accounts = v3_accounts();

    // Act
    let decoded: Vec<_> = accounts
        .iter()
        .map(|(_, data)| decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, data).expect("decodes"))
        .collect();

    // Assert: threshold and keys, sorted as v3 keeps them; the address is the PDA of the stored
    // create key (bytes 21..53) with the stored bump (byte 20).
    let shape: Vec<_> = decoded
        .iter()
        .map(|ms| (ms.threshold, ms.keys.len()))
        .collect();
    assert_eq!(shape, [(3, 6), (2, 2)]);
    assert!(decoded
        .iter()
        .all(|ms| ms.keys.windows(2).all(|pair| pair[0] < pair[1])));
    accounts.iter().for_each(|(address, data)| {
        let create_key = Address::try_from(&data[21..53]).expect("create key");
        assert_eq!(get_v3_multisig_pda(&create_key), (*address, data[20]));
    });
}

#[test]
fn the_authority_pda_matches_a_mainnet_signer() {
    // Arrange: authority 1 of EXkcJ... signs in mainnet transactions.
    let (multisig, _) = v3_accounts()[0];
    let signer = Address::from_str("MmHsqX4LxTfifxoH8BVRLUKrwDn1LPCac6YcCZTHhwt").expect("address");

    // Act
    let (authority, _) = get_v3_authority_pda(&multisig, 1);

    // Assert
    assert_eq!(authority, signer);
}

#[test]
fn the_reader_ignores_headroom_and_refuses_other_data() {
    // Arrange
    let keys = [key(1), key(2), key(3)];
    let expected = V3Multisig {
        threshold: 2,
        keys: keys.to_vec(),
    };
    let exact = ms_data(2, &keys, 0);
    let headroom = ms_data(2, &keys, 320);
    let mut other_discriminator = exact.clone();
    other_discriminator[0] ^= 1;
    let mut huge_count = exact.clone();
    huge_count[54..58].copy_from_slice(&u32::MAX.to_le_bytes());

    // Act + Assert
    assert_eq!(
        decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &exact),
        Some(expected.clone())
    );
    assert_eq!(
        decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &headroom),
        Some(expected)
    );
    assert_eq!(v3_member_count(&headroom), Some(3));
    assert_eq!(decode_v3_multisig(&key(9), &exact), None);
    assert_eq!(
        decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &other_discriminator),
        None
    );
    assert_eq!(v3_member_count(&other_discriminator), None);
    assert_eq!(
        decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &exact[..exact.len() - 1]),
        None
    );
    assert_eq!(decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &huge_count), None);
    assert_eq!(
        decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &exact[..40]),
        None
    );
}

#[test]
fn authority_n_maps_to_vault_n_minus_1_from_1_to_256_only() {
    // Arrange
    let indexes = [0, 1, 2, 256, 257, u32::MAX];

    // Act
    let mapped = indexes.map(v3_vault_index);

    // Assert
    let invalid = Err(MultisigError::MigrationInvalidAuthorityIndex);
    assert_eq!(mapped, [invalid, Ok(0), Ok(1), Ok(255), invalid, invalid]);
}

#[test]
fn the_successor_of_a_v3_multisig_is_the_multisig_pda_of_its_address() {
    // Arrange
    let (source_key, _) = v3_accounts()[0];

    // Act
    let successor = get_successor_pda(&source_key, None);

    // Assert
    assert_eq!(successor, get_multisig_pda(&source_key, None));
}

#[test]
fn mirror_gives_every_member_every_permission_and_nothing_else() {
    // Arrange: unsorted keys, so the mirror must sort them.
    let source = V3Multisig {
        threshold: 2,
        keys: vec![key(3), key(1), key(2)],
    };

    // Act
    let config = mirror_v3(&source);

    // Assert
    let all = Permissions::from_vec(&[Permission::Initiate, Permission::Vote, Permission::Execute]);
    let members: Vec<_> = [1, 2, 3]
        .map(|byte| Member {
            key: key(byte),
            permissions: all,
        })
        .to_vec();
    assert_eq!(config.members, members);
    assert_eq!(config.threshold, 2);
    assert_eq!(config.time_lock, 0);
    assert_eq!(config.config_authority, Address::default());
    assert_eq!(config.rent_collector, None);
}

#[test]
fn a_mirrored_successor_passes_the_check_and_every_drift_fails_it() {
    // Arrange
    let accounts = v3_accounts();
    let (source_key, data) = &accounts[0];
    let source = decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, data).expect("decodes");
    let successor = mirrored_successor(source_key, &source);
    let drift = |change: fn(&mut Multisig)| {
        let mut drifted = successor.clone();
        change(&mut drifted);
        check_same_governance_v3(&source, &drifted)
    };

    // Act + Assert
    assert_eq!(check_same_governance_v3(&source, &successor), Ok(()));
    let mismatch = Err(MultisigError::MigrationGovernanceMismatch);
    let drifts: [fn(&mut Multisig); 6] = [
        |m| {
            m.members.push(Member {
                key: key(255),
                permissions: m.members[0].permissions,
            })
        },
        |m| m.members.truncate(m.members.len() - 1),
        |m| m.members[0].permissions = Permissions::from_vec(&[Permission::Vote]),
        |m| m.threshold += 1,
        |m| m.time_lock = 1,
        |m| m.config_authority = key(7),
    ];
    drifts
        .into_iter()
        .for_each(|change| assert_eq!(drift(change), mismatch));
    // The rent collector is not governance (MIGRATION_SAFETY.md 9.6).
    assert_eq!(drift(|m| m.rent_collector = Some(key(8))), Ok(()));
}

#[test]
fn v3_member_drift_fails_the_check() {
    // Arrange: the v3 members change after the successor exists.
    let source = V3Multisig {
        threshold: 1,
        keys: vec![key(1), key(2)],
    };
    let successor = mirrored_successor(&key(9), &source);
    let changed = V3Multisig {
        threshold: 1,
        keys: vec![key(1), key(2), key(3)],
    };

    // Act
    let result = check_same_governance_v3(&changed, &successor);

    // Assert
    assert_eq!(result, Err(MultisigError::MigrationGovernanceMismatch));
}

#[test]
fn migration_accounts_v3_derive_authority_n_and_vault_n_minus_1() {
    // Arrange
    let (source_key, _) = v3_accounts()[0];

    // Act
    let accounts = builders::MigrationAccountsV3::new(source_key, 3, None).expect("1..=256");
    let outside = [0, 257].map(|index| builders::MigrationAccountsV3::new(source_key, index, None));

    // Assert
    let successor = get_successor_pda(&source_key, None).0;
    assert_eq!(
        accounts.source_vault,
        get_v3_authority_pda(&source_key, 3).0
    );
    assert_eq!(accounts.multisig, successor);
    assert_eq!(accounts.vault, get_vault_pda(&successor, 2, None).0);
    assert_eq!(outside, [None, None]);
}

#[test]
fn create_from_v3_builder_matches_the_idl() {
    // Arrange
    let (source_key, _) = v3_accounts()[0];
    let args = MultisigCreateFromV3Args {
        authority_index: 1,
        max_creation_fee: 1_000_000,
        memo: Some("move".into()),
    };
    let data = [
        instruction::MULTISIG_CREATE_FROM_V3.as_slice(),
        &borsh::to_vec(&args).expect("encode"),
    ]
    .concat();

    // Act
    let builder = builders::MultisigCreateFromV3::new(source_key, 1, key(9), None);
    let ix = builder.instruction(args, None).expect("builder");

    // Assert
    assert_eq!(
        idl_discriminator("multisig_create_from_v3"),
        instruction::MULTISIG_CREATE_FROM_V3
    );
    assert_eq!(flags(&ix), idl_account_flags("multisig_create_from_v3"));
    assert_eq!(ix.data, data);
    assert_eq!(ix.program_id, ID);
    assert_eq!(builder.source_vault, get_v3_authority_pda(&source_key, 1).0);
    assert_eq!(builder.multisig, get_successor_pda(&source_key, None).0);
}

#[test]
fn migrate_v3_builders_match_the_idl_and_append_item_accounts() {
    // Arrange
    let (source_key, _) = v3_accounts()[0];
    let migration = builders::MigrationAccountsV3::new(source_key, 2, None).expect("1..=256");
    let authorities = |memo| MigrateV3AuthoritiesArgs {
        authority_index: 2,
        memo,
    };
    let tokens = [
        TokenItem {
            source_token_account: key(20),
            mint: key(21),
        },
        TokenItem {
            source_token_account: key(22),
            mint: key(23),
        },
    ];

    // Act
    let instructions = [
        (
            "multisig_migrate_v3_sol",
            instruction::MULTISIG_MIGRATE_V3_SOL,
            builders::MultisigMigrateSol::new(migration).instruction(
                MigrateV3SolArgs {
                    authority_index: 2,
                    keep: 0,
                    memo: None,
                },
                None,
            ),
            0,
        ),
        (
            "multisig_migrate_v3_tokens",
            instruction::MULTISIG_MIGRATE_V3_TOKENS,
            builders::MultisigMigrateTokens::new(migration, TOKEN_2022_PROGRAM_ID).instruction(
                MigrateV3TokensArgs {
                    authority_index: 2,
                    close_source: true,
                    memo: None,
                },
                &tokens,
                None,
            ),
            6,
        ),
        (
            "multisig_migrate_v3_token_authorities",
            instruction::MULTISIG_MIGRATE_V3_TOKEN_AUTHORITIES,
            builders::MultisigMigrateTokenAuthorities::new(migration, TOKEN_PROGRAM_ID)
                .instruction(
                    MigrateV3TokenAuthoritiesArgs {
                        authority_index: 2,
                        items: vec![TokenAuthorityKind::MintTokens],
                        memo: None,
                    },
                    &[key(30)],
                    None,
                ),
            1,
        ),
        (
            "multisig_migrate_v3_stakes",
            instruction::MULTISIG_MIGRATE_V3_STAKES,
            builders::MultisigMigrateStakes::new(migration).instruction(
                authorities(None),
                &[key(40)],
                None,
            ),
            1,
        ),
        (
            "multisig_migrate_v3_vote_accounts",
            instruction::MULTISIG_MIGRATE_V3_VOTE_ACCOUNTS,
            builders::MultisigMigrateVoteAccounts::new(migration).instruction(
                authorities(Some("vote".into())),
                &[key(50), key(51)],
                None,
            ),
            2,
        ),
        (
            "multisig_migrate_v3_programs",
            instruction::MULTISIG_MIGRATE_V3_PROGRAMS,
            builders::MultisigMigratePrograms::new(migration).instruction(
                authorities(None),
                &[key(60)],
                None,
            ),
            1,
        ),
    ]
    .map(|(name, discriminator, ix, items)| (name, discriminator, ix.expect("builder"), items));

    // Assert
    instructions
        .iter()
        .for_each(|(name, discriminator, ix, items)| {
            let expected = idl_account_flags(name);
            assert_eq!(idl_discriminator(name), discriminator, "{name}");
            assert_eq!(ix.data[..8], discriminator[..], "{name}");
            assert_eq!(ix.accounts.len(), expected.len() + items, "{name}");
            assert_eq!(flags(ix)[..expected.len()], expected[..], "{name}");
            assert_eq!(
                ix.accounts[3].pubkey, migration.vault,
                "{name}: the successor vault"
            );
            assert!(
                ix.accounts[expected.len()..]
                    .iter()
                    .all(|meta| !meta.is_signer),
                "{name}: item accounts never sign"
            );
        });
}

mod properties {
    use proptest::prelude::*;

    use super::*;

    proptest! {
        #[test]
        fn the_reader_accepts_any_bytes(data in prop::collection::vec(any::<u8>(), 0..200)) {
            let _ = v3_member_count(&data);
            let _ = decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &data);
        }

        #[test]
        fn the_reader_round_trips_any_ms_with_headroom(
            threshold in any::<u16>(),
            keys in prop::collection::vec(any::<[u8; 32]>(), 0..12),
            headroom in 0usize..400,
        ) {
            // Arrange
            let keys: Vec<Address> = keys.into_iter().map(Address::new_from_array).collect();
            let data = ms_data(threshold, &keys, headroom);

            // Act
            let decoded = decode_v3_multisig(&LEGACY_V3_PROGRAM_ID, &data);

            // Assert
            prop_assert_eq!(decoded, Some(V3Multisig { threshold, keys }));
        }
    }
}
