//! Migration from v4: the successor PDA, the mirrored config, the governance check, the asset
//! accounts, and the builders against the IDL. Runs with and without the `program` feature.

mod common;

use std::str::FromStr;

use common::{fixtures, flags, idl_account_flags, idl_discriminator, ACCOUNTS};
use solana_address::Address;
use squads_multisig_4r_program::account::ProgramAccount;
use squads_multisig_4r_program::discriminator::{account, instruction};
use squads_multisig_4r_program::errors::MultisigError;
use squads_multisig_4r_program::instructions::*;
use squads_multisig_4r_program::migration::*;
use squads_multisig_4r_program::pda::{get_multisig_pda, get_vault_pda};
use squads_multisig_4r_program::state::{Member, Multisig, Permission, Permissions};
use squads_multisig_4r_program::{builders, ID, LEGACY_V4_PROGRAM_ID};

fn key(byte: u8) -> Address {
    Address::new_from_array([byte; 32])
}

/// The mainnet v4 multisig fixture, with its address.
fn v4_multisig() -> (Address, Multisig) {
    fixtures(ACCOUNTS)
        .find(|(label, _, _)| *label == "Multisig")
        .map(|(_, id, data)| {
            let address = Address::from_str(id).expect("address");
            let multisig = Multisig::try_from_account_data(&address, &data).expect("decodes");
            (address, multisig)
        })
        .expect("multisig fixture")
}

fn v4_vault(multisig: &Address, index: u8) -> Address {
    get_vault_pda(multisig, index, Some(&LEGACY_V4_PROGRAM_ID)).0
}

fn vault(multisig: &Address, index: u8) -> Address {
    get_vault_pda(multisig, index, None).0
}

/// The account data of `multisig`, with spare bytes at the end as on chain.
fn account_data(multisig: &Multisig) -> Vec<u8> {
    [
        account::MULTISIG.as_slice(),
        &borsh::to_vec(multisig).expect("encode"),
        &[0; 64],
    ]
    .concat()
}

/// A successor with exactly the config that `multisig_create_from` gives it.
fn mirrored_successor(source_key: &Address, source: &Multisig, hints: VaultHints) -> Multisig {
    let successor_key = get_successor_pda(source_key, None).0;
    let config = mirror(source, source_key, &successor_key, hints, None).expect("mirror");
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
fn successor_is_the_multisig_pda_of_the_v4_address() {
    // Arrange
    let (source_key, _) = v4_multisig();

    // Act
    let successor = get_successor_pda(&source_key, None);

    // Assert
    assert_eq!(successor, get_multisig_pda(&source_key, None));
    assert_ne!(
        successor.0,
        get_multisig_pda(&source_key, Some(&LEGACY_V4_PROGRAM_ID)).0
    );
}

#[test]
fn v4_member_count_reads_both_rent_collector_layouts() {
    // Arrange
    let (_, fixture) = v4_multisig();
    let cases = [None, Some(key(9))].map(|rent_collector| Multisig {
        rent_collector,
        ..fixture.clone()
    });

    // Act
    let counts: Vec<Option<usize>> = cases
        .iter()
        .map(|multisig| v4_member_count(&account_data(multisig)))
        .collect();

    // Assert
    assert!(fixture.members.len() > 1);
    assert_eq!(counts, vec![Some(fixture.members.len()); 2]);
}

#[test]
fn v4_member_count_rejects_other_data() {
    // Arrange
    let (_, fixture) = v4_multisig();
    let data = account_data(&fixture);
    let wrong_discriminator = [account::PROPOSAL.as_slice(), &data[8..]].concat();
    let bad_option_tag = [&data[..94], &[2], &data[95..]].concat();

    // Act
    let results = [
        v4_member_count(&wrong_discriminator),
        v4_member_count(&bad_option_tag),
        v4_member_count(&data[..96]),
    ];

    // Assert
    assert_eq!(results, [None, None, None]);
}

#[test]
fn mirror_copies_the_config_and_maps_hinted_vaults() {
    // Arrange
    let (source_key, fixture) = v4_multisig();
    let successor_key = get_successor_pda(&source_key, None).0;
    let source = Multisig {
        config_authority: v4_vault(&source_key, 2),
        rent_collector: Some(v4_vault(&source_key, 0)),
        ..fixture
    };
    let hints = VaultHints {
        config_authority: Some(2),
        rent_collector: Some(0),
    };

    // Act
    let mapped = mirror(&source, &source_key, &successor_key, hints, None).expect("mirror");
    let unmapped = mirror(
        &source,
        &source_key,
        &successor_key,
        VaultHints::default(),
        None,
    )
    .expect("mirror");

    // Assert
    assert_eq!(mapped.config_authority, vault(&successor_key, 2));
    assert_eq!(mapped.rent_collector, Some(vault(&successor_key, 0)));
    assert_eq!(mapped.members, source.members);
    assert_eq!(mapped.threshold, source.threshold);
    assert_eq!(mapped.time_lock, source.time_lock);
    assert_eq!(unmapped.config_authority, source.config_authority);
    assert_eq!(unmapped.rent_collector, source.rent_collector);
}

#[test]
fn mirror_rejects_a_hint_that_does_not_name_the_field() {
    // Arrange
    let (source_key, fixture) = v4_multisig();
    let successor_key = get_successor_pda(&source_key, None).0;
    let source = Multisig {
        config_authority: v4_vault(&source_key, 2),
        rent_collector: None,
        ..fixture
    };
    let cases = [
        VaultHints {
            config_authority: Some(1),
            rent_collector: None,
        },
        VaultHints {
            config_authority: None,
            rent_collector: Some(0),
        },
    ];

    // Act
    let results: Vec<_> = cases
        .iter()
        .map(|hints| mirror(&source, &source_key, &successor_key, *hints, None))
        .collect();

    // Assert
    assert!(results
        .iter()
        .all(|result| *result == Err(MultisigError::MigrationInvalidVaultHint)));
}

#[test]
fn same_governance_accepts_the_mirror_and_rejects_any_drift() {
    // Arrange
    let (source_key, source) = v4_multisig();
    let successor_key = get_successor_pda(&source_key, None).0;
    let mirrored = mirrored_successor(&source_key, &source, VaultHints::default());
    let first = source.members[0].clone();
    let toggled = Permissions {
        mask: first.permissions.mask ^ Permission::Initiate as u8,
    };
    let drifts: Vec<(&str, Multisig)> = vec![
        (
            "extra member",
            Multisig {
                members: [
                    source.members.clone(),
                    vec![Member {
                        key: key(255),
                        permissions: first.permissions,
                    }],
                ]
                .concat(),
                ..mirrored.clone()
            },
        ),
        (
            "removed member",
            Multisig {
                members: source.members[1..].to_vec(),
                ..mirrored.clone()
            },
        ),
        (
            "changed permissions",
            Multisig {
                members: [
                    vec![Member {
                        key: first.key,
                        permissions: toggled,
                    }],
                    source.members[1..].to_vec(),
                ]
                .concat(),
                ..mirrored.clone()
            },
        ),
        (
            "threshold",
            Multisig {
                threshold: source.threshold + 1,
                ..mirrored.clone()
            },
        ),
        (
            "time lock",
            Multisig {
                time_lock: source.time_lock + 1,
                ..mirrored.clone()
            },
        ),
        (
            "config authority",
            Multisig {
                config_authority: key(7),
                ..mirrored.clone()
            },
        ),
    ];
    let check = |successor: &Multisig| {
        check_same_governance(&source, successor, &source_key, &successor_key, None, None)
    };

    // Act
    let mirror_result = check(&mirrored);
    let rent_collector_result = check(&Multisig {
        rent_collector: Some(key(8)),
        ..mirrored.clone()
    });

    // Assert
    assert_eq!(mirror_result, Ok(()));
    assert_eq!(
        rent_collector_result,
        Ok(()),
        "rent collector is not governance"
    );
    drifts.iter().for_each(|(name, successor)| {
        assert_eq!(
            check(successor),
            Err(MultisigError::MigrationGovernanceMismatch),
            "{name}"
        )
    });
}

#[test]
fn same_governance_maps_a_vault_config_authority_with_the_hint() {
    // Arrange
    let (source_key, fixture) = v4_multisig();
    let successor_key = get_successor_pda(&source_key, None).0;
    let source = Multisig {
        config_authority: v4_vault(&source_key, 1),
        ..fixture
    };
    let hints = VaultHints {
        config_authority: Some(1),
        rent_collector: None,
    };
    let successor = mirrored_successor(&source_key, &source, hints);

    // Act
    let with_hint = check_same_governance(
        &source,
        &successor,
        &source_key,
        &successor_key,
        Some(1),
        None,
    );
    let without_hint =
        check_same_governance(&source, &successor, &source_key, &successor_key, None, None);

    // Assert
    assert_eq!(successor.config_authority, vault(&successor_key, 1));
    assert_eq!(with_hint, Ok(()));
    assert_eq!(
        without_hint,
        Err(MultisigError::MigrationGovernanceMismatch)
    );
}

#[test]
fn create_from_builder_matches_the_idl() {
    // Arrange
    let (source_key, _) = v4_multisig();
    let args = MultisigCreateFromArgs {
        vault_index: 3,
        config_authority_vault_index: None,
        rent_collector_vault_index: Some(0),
        max_creation_fee: 1_000_000,
        memo: Some("move".into()),
    };
    let data = [
        instruction::MULTISIG_CREATE_FROM.as_slice(),
        &borsh::to_vec(&args).expect("encode"),
    ]
    .concat();

    // Act
    let builder = builders::MultisigCreateFrom::new(source_key, 3, key(9), None);
    let ix = builder.instruction(args, None).expect("builder");

    // Assert
    assert_eq!(
        idl_discriminator("multisig_create_from"),
        instruction::MULTISIG_CREATE_FROM
    );
    assert_eq!(flags(&ix), idl_account_flags("multisig_create_from"));
    assert_eq!(ix.data, data);
    assert_eq!(ix.program_id, ID);
    assert_eq!(builder.source_vault, v4_vault(&source_key, 3));
    assert_eq!(builder.multisig, get_successor_pda(&source_key, None).0);
}

/// Each `multisig_migrate_*` builder, with its items, and the expected item account count.
fn migrate_instructions(
    source: Address,
) -> Vec<(
    &'static str,
    [u8; 8],
    solana_instruction::Instruction,
    usize,
)> {
    let migration = builders::MigrationAccounts::new(source, 1, None);
    let prefix = |memo: Option<String>| MigrateAuthoritiesArgs {
        vault_index: 1,
        config_authority_vault_index: None,
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
    vec![
        (
            "multisig_migrate_sol",
            instruction::MULTISIG_MIGRATE_SOL,
            builders::MultisigMigrateSol::new(migration)
                .instruction(
                    MigrateSolArgs {
                        vault_index: 1,
                        config_authority_vault_index: None,
                        keep: 0,
                        memo: None,
                    },
                    None,
                )
                .expect("builder"),
            0,
        ),
        (
            "multisig_migrate_tokens",
            instruction::MULTISIG_MIGRATE_TOKENS,
            builders::MultisigMigrateTokens::new(migration, TOKEN_2022_PROGRAM_ID)
                .instruction(
                    MigrateTokensArgs {
                        vault_index: 1,
                        config_authority_vault_index: None,
                        close_source: true,
                        memo: None,
                    },
                    &tokens,
                    None,
                )
                .expect("builder"),
            6,
        ),
        (
            "multisig_migrate_token_authorities",
            instruction::MULTISIG_MIGRATE_TOKEN_AUTHORITIES,
            builders::MultisigMigrateTokenAuthorities::new(migration, TOKEN_PROGRAM_ID)
                .instruction(
                    MigrateTokenAuthoritiesArgs {
                        vault_index: 1,
                        config_authority_vault_index: None,
                        items: vec![TokenAuthorityKind::MintTokens, TokenAuthorityKind::Pause],
                        memo: None,
                    },
                    &[key(30), key(30)],
                    None,
                )
                .expect("builder"),
            2,
        ),
        (
            "multisig_migrate_stakes",
            instruction::MULTISIG_MIGRATE_STAKES,
            builders::MultisigMigrateStakes::new(migration)
                .instruction(prefix(None), &[key(40)], None)
                .expect("builder"),
            1,
        ),
        (
            "multisig_migrate_vote_accounts",
            instruction::MULTISIG_MIGRATE_VOTE_ACCOUNTS,
            builders::MultisigMigrateVoteAccounts::new(migration)
                .instruction(prefix(Some("vote".into())), &[key(50), key(51)], None)
                .expect("builder"),
            2,
        ),
        (
            "multisig_migrate_programs",
            instruction::MULTISIG_MIGRATE_PROGRAMS,
            builders::MultisigMigratePrograms::new(migration)
                .instruction(prefix(None), &[key(60)], None)
                .expect("builder"),
            1,
        ),
    ]
}

#[test]
fn migrate_builders_match_the_idl_and_append_item_accounts() {
    // Arrange
    let (source_key, _) = v4_multisig();

    // Act
    let instructions = migrate_instructions(source_key);

    // Assert
    assert_eq!(instructions.len(), 6);
    instructions
        .iter()
        .for_each(|(name, discriminator, ix, items)| {
            let expected = idl_account_flags(name);
            assert_eq!(idl_discriminator(name), discriminator, "{name}");
            assert_eq!(ix.data[..8], discriminator[..], "{name}");
            assert_eq!(ix.accounts.len(), expected.len() + items, "{name}");
            assert_eq!(flags(ix)[..expected.len()], expected[..], "{name}");
            assert!(
                ix.accounts[expected.len()..]
                    .iter()
                    .all(|meta| !meta.is_signer),
                "{name}: item accounts never sign"
            );
        });
}

#[test]
fn migration_accounts_derive_the_lineage() {
    // Arrange
    let (source_key, _) = v4_multisig();

    // Act
    let accounts = builders::MigrationAccounts::new(source_key, 2, None);

    // Assert
    assert_eq!(accounts.source_vault, v4_vault(&source_key, 2));
    assert_eq!(accounts.multisig, get_successor_pda(&source_key, None).0);
    assert_eq!(accounts.vault, vault(&accounts.multisig, 2));
}

#[test]
fn token_items_target_the_successor_vault_token_account() {
    // Arrange
    let item = TokenItem {
        source_token_account: key(3),
        mint: key(4),
    };

    // Act
    let metas = item.metas(&key(1), &TOKEN_2022_PROGRAM_ID);

    // Assert
    assert_eq!(
        metas.map(|meta| (meta.pubkey, meta.is_writable, meta.is_signer)),
        [
            (key(3), true, false),
            (key(4), false, false),
            (
                get_associated_token_address(&key(1), &key(4), &TOKEN_2022_PROGRAM_ID),
                true,
                false
            ),
        ]
    );
}
