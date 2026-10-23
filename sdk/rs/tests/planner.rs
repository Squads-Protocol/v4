//! The pure migration planner: account parsing, groups, and chunking. The chunk sizes are shared
//! with `sdk/multisig-4r/test/unit/planner.test.ts`, so both planners agree.

use solana_address::Address;
use squads_multisig_4r::instructions::TokenAuthorityKind;
use squads_multisig_4r::lookup_tables::{
    create_lookup_tables, lookup_table_addresses, parse_lookup_table,
    LOOKUP_TABLE_ADDRESSES_PER_EXTEND,
};
use squads_multisig_4r::message::AddressLookupTableAccount;
use squads_multisig_4r::migration::{TokenItem, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID};
use squads_multisig_4r::planner::*;

fn key(byte: u8) -> Address {
    Address::new_from_array([byte; 32])
}

fn token(byte: u8, amount: u64) -> InventoryToken {
    InventoryToken {
        account: key(byte),
        mint: key(byte + 100),
        token_program: TOKEN_PROGRAM_ID,
        amount,
        frozen: false,
        associated: true,
    }
}

fn inventory() -> V4VaultInventory {
    V4VaultInventory {
        vault_index: 0,
        vault: key(1),
        lamports: 5_000_000_000,
        tokens: vec![],
        token_roles: vec![],
        stakes: vec![],
        vote_accounts: vec![],
        program_data: vec![],
        mints: vec![],
        warnings: vec![],
    }
}

fn token_groups(count: u8) -> Vec<MigrationGroup> {
    let tokens = (0..count).map(|i| token(10 + i, 1)).collect();
    let options = MigrationOptions {
        skip_sol: true,
        ..MigrationOptions::default()
    };
    let vault = V4VaultInventory {
        tokens,
        ..inventory()
    };
    inventory_groups(&vault, options).0
}

fn chunk_input(tables: &[AddressLookupTableAccount], limits: MigrationLimits) -> ChunkInput<'_> {
    ChunkInput {
        source: MigrationSource {
            source_multisig: key(2),
            vault_index: 0,
            config_authority_vault_index: None,
            program_id: None,
        },
        events: true,
        address_lookup_tables: tables,
        limits,
    }
}

fn item_counts(items: &[MigrationItem]) -> Vec<usize> {
    items.iter().map(|item| item.group.len()).collect()
}

#[test]
fn parses_token_accounts_stakes_and_vote_accounts() {
    // Arrange
    let vault = key(1);
    let account = [
        &key(7).to_bytes()[..],
        &vault.to_bytes(),
        &5u64.to_le_bytes(),
        &[0; 36],
        &[2],
        &[0; 56],
    ]
    .concat();
    let stake = [
        &2u32.to_le_bytes()[..],
        &[0; 8],
        &vault.to_bytes(),
        &key(9).to_bytes(),
        &[0; 16],
        &vault.to_bytes(),
        &[0; 32],
    ]
    .concat();
    let vote = [
        &3u32.to_le_bytes()[..],
        &key(8).to_bytes(),
        &vault.to_bytes(),
        &[0; 100],
    ]
    .concat();

    // Act
    let parsed_account = parse_token_account(key(3), TOKEN_PROGRAM_ID, &account);
    let parsed_stake = parse_stake(key(5), &vault, &stake);
    let withdrawer = parse_vote_withdrawer(&vote);

    // Assert
    assert_eq!(account.len(), 165);
    assert_eq!(
        parsed_account,
        Some(InventoryToken {
            account: key(3),
            mint: key(7),
            token_program: TOKEN_PROGRAM_ID,
            amount: 5,
            frozen: true,
            associated: false,
        })
    );
    assert_eq!(
        parsed_stake,
        Some(InventoryStake {
            stake: key(5),
            staker: true,
            withdrawer: false,
            custodian: true,
        })
    );
    assert_eq!(withdrawer, Some(vault));
    assert_eq!(parse_vote_withdrawer(&[0; 100]), None);
}

/// A mint with `mint`/`freeze` authorities and Token-2022 `extensions` (type, value).
fn mint_data(
    mint: Option<Address>,
    freeze: Option<Address>,
    extensions: &[(u16, Vec<u8>)],
) -> Vec<u8> {
    let authority = |holder: Option<Address>| match holder {
        Some(holder) => [&[1, 0, 0, 0][..], &holder.to_bytes()].concat(),
        None => vec![0; 36],
    };
    let base = [authority(mint), vec![0; 10], authority(freeze)].concat();
    if extensions.is_empty() {
        return base;
    }
    let entries = extensions.iter().flat_map(|(extension_type, value)| {
        [
            &extension_type.to_le_bytes()[..],
            &(value.len() as u16).to_le_bytes(),
            value,
        ]
        .concat()
    });
    [base, vec![0; 165 - 82], vec![1], entries.collect()].concat()
}

#[test]
fn parses_the_mint_and_extension_authorities_like_the_ts_planner() {
    // Arrange: transfer fee (the vault withdraws withheld fees only), close mint, metadata, pausable.
    let (vault, other) = (key(1), key(2));
    let transfer_fee = [&other.to_bytes()[..], &vault.to_bytes(), &[0; 44]].concat();
    let metadata = [&vault.to_bytes()[..], &key(9).to_bytes(), &[0; 16]].concat();
    let pausable = [&other.to_bytes()[..], &[0]].concat();
    let plain = mint_data(Some(vault), Some(other), &[]);
    let extended = mint_data(
        None,
        Some(vault),
        &[
            (1, transfer_fee),
            (3, vault.to_bytes().to_vec()),
            (19, metadata),
            (26, pausable),
        ],
    );

    // Act
    let parsed = (
        parse_mint_authorities(&plain, &vault),
        parse_mint_authorities(&extended, &vault),
        parse_mint_authorities(&[0; 165], &vault),
    );

    // Assert
    use TokenAuthorityKind as K;
    assert_eq!(plain.len(), 82);
    assert_eq!(
        parsed,
        (
            Some(vec![K::MintTokens]),
            Some(vec![
                K::FreezeAccount,
                K::WithheldWithdraw,
                K::CloseMint,
                K::MetadataUpdate
            ]),
            None
        )
    );
    assert_eq!(parse_mint(key(4), TOKEN_PROGRAM_ID, &key(5), &plain), None);
}

#[test]
fn orders_the_classes_and_puts_sol_last() {
    // Arrange
    let vault = V4VaultInventory {
        tokens: vec![
            token(10, 5),
            InventoryToken {
                token_program: TOKEN_2022_PROGRAM_ID,
                ..token(11, 5)
            },
            InventoryToken {
                frozen: true,
                ..token(12, 3)
            },
        ],
        mints: vec![InventoryMint {
            mint: key(20),
            token_program: TOKEN_PROGRAM_ID,
            authorities: vec![
                TokenAuthorityKind::MintTokens,
                TokenAuthorityKind::FreezeAccount,
            ],
        }],
        stakes: vec![InventoryStake {
            stake: key(40),
            staker: true,
            withdrawer: true,
            custodian: false,
        }],
        vote_accounts: vec![key(50)],
        program_data: vec![key(30)],
        ..inventory()
    };

    // Act
    let (groups, notes) = inventory_groups(&vault, MigrationOptions::default());

    // Assert
    let classes: Vec<(&str, usize)> = groups
        .iter()
        .map(|group| {
            let class = match group {
                MigrationGroup::Tokens { .. } => "tokens",
                MigrationGroup::TokenAuthorities { .. } => "tokenAuthorities",
                MigrationGroup::Stakes(_) => "stakes",
                MigrationGroup::VoteAccounts(_) => "voteAccounts",
                MigrationGroup::Programs(_) => "programs",
                MigrationGroup::Sol { .. } => "sol",
            };
            (class, group.len())
        })
        .collect();
    assert_eq!(
        classes,
        [
            ("tokens", 1),
            ("tokens", 1),
            ("tokenAuthorities", 2),
            ("stakes", 1),
            ("voteAccounts", 1),
            ("programs", 1),
            ("sol", 1)
        ]
    );
    assert_eq!(
        notes,
        vec![format!(
            "token account {} is frozen; it cannot move",
            key(12)
        )]
    );
}

#[test]
fn moves_non_associated_accounts_by_owner_change_when_they_keep_their_address() {
    // Arrange
    let vault = V4VaultInventory {
        tokens: vec![
            token(10, 5),
            InventoryToken {
                associated: false,
                ..token(11, 5)
            },
        ],
        lamports: 0,
        ..inventory()
    };
    let options = MigrationOptions {
        preserve_token_account_addresses: true,
        ..MigrationOptions::default()
    };

    // Act
    let (groups, _) = inventory_groups(&vault, options);

    // Assert
    assert_eq!(
        groups,
        vec![
            MigrationGroup::Tokens {
                token_program: TOKEN_PROGRAM_ID,
                close_source: true,
                items: vec![TokenItem {
                    source_token_account: key(10),
                    mint: key(110)
                }],
            },
            MigrationGroup::TokenAuthorities {
                token_program: TOKEN_PROGRAM_ID,
                items: vec![TokenAuthorityItem {
                    account: key(11),
                    kind: TokenAuthorityKind::AccountOwner
                }],
            },
        ]
    );
}

fn role(byte: u8, owner: Address) -> InventoryTokenRole {
    InventoryTokenRole {
        account: key(byte),
        token_program: TOKEN_PROGRAM_ID,
        mint: key(byte + 100),
        owner,
        frozen: false,
        close_authority: true,
        delegated_amount: None,
    }
}

#[test]
fn moves_close_authorities_that_the_token_step_leaves_behind() {
    // Arrange: the vault (key 1) holds the close authority of accounts 30-33 and delegates on 34.
    let vault = V4VaultInventory {
        tokens: vec![
            InventoryToken {
                associated: false,
                ..token(32, 5)
            },
            token(33, 5),
        ],
        token_roles: vec![
            role(30, key(9)),
            InventoryTokenRole {
                frozen: true,
                ..role(31, key(9))
            },
            role(32, key(1)),
            role(33, key(1)),
            InventoryTokenRole {
                close_authority: false,
                delegated_amount: Some(7),
                ..role(34, key(9))
            },
        ],
        lamports: 0,
        ..inventory()
    };
    let options = MigrationOptions {
        preserve_token_account_addresses: true,
        ..MigrationOptions::default()
    };

    // Act
    let (groups, notes) = inventory_groups(&vault, options);

    // Assert: 30 (other owner) and 32 (moves by owner change); not 31 (frozen) or 33 (closed by the token step).
    let authorities = groups.iter().find_map(|group| match group {
        MigrationGroup::TokenAuthorities { items, .. } => Some(items.clone()),
        _ => None,
    });
    let item = |byte, kind| TokenAuthorityItem {
        account: key(byte),
        kind,
    };
    assert_eq!(
        authorities,
        Some(vec![
            item(32, TokenAuthorityKind::AccountOwner),
            item(30, TokenAuthorityKind::CloseAccount),
            item(32, TokenAuthorityKind::CloseAccount),
        ])
    );
    assert_eq!(
        notes,
        vec![
            format!(
                "token account {} is frozen; its close authority cannot move",
                key(31)
            ),
            format!(
                "the vault is the delegate of token account {} (owner {}) for 7 tokens; this role \
                 cannot move, only the owner can change it",
                key(34),
                key(9)
            ),
        ]
    );
}

#[test]
fn chunks_within_the_limits_like_the_ts_planner() {
    // Arrange
    let groups = token_groups(12);

    // Act
    let items = chunk_migration_groups(&groups, &chunk_input(&[], MigrationLimits::DEFAULT))
        .expect("chunks");

    // Assert: the same item sizes as the TS planner test.
    assert_eq!(item_counts(&items), vec![5, 5, 2]);
    assert_eq!(items[0].message_bytes, 781);
    assert!(items
        .iter()
        .all(|item| item.message_bytes <= 800 && item.message_accounts <= 30));
}

#[test]
fn chunks_more_per_item_with_a_lookup_table() {
    // Arrange
    let groups = token_groups(24);
    let without = chunk_migration_groups(&groups, &chunk_input(&[], MigrationLimits::DEFAULT))
        .expect("chunks");
    let instructions: Vec<_> = without
        .iter()
        .map(|item| item.instruction.clone())
        .collect();
    let table = AddressLookupTableAccount {
        key: key(3),
        addresses: lookup_table_addresses(&instructions),
    };

    // Act
    let with_table = chunk_migration_groups(
        &groups,
        &chunk_input(std::slice::from_ref(&table), MigrationLimits::LOOKUP_TABLES),
    )
    .expect("chunks");

    // Assert: the same counts as the TS planner test; the instruction trace binds the tokens.
    assert_eq!(item_counts(&without), vec![5, 5, 5, 5, 4]);
    assert_eq!(item_counts(&with_table), vec![6, 6, 6, 6]);
    assert!(with_table.iter().all(|item| item.instruction_trace <= 64));
}

#[test]
fn counts_the_worst_case_instruction_trace() {
    // Arrange
    let tokens = MigrationGroup::Tokens {
        token_program: TOKEN_PROGRAM_ID,
        close_source: true,
        items: vec![
            TokenItem {
                source_token_account: key(10),
                mint: key(110)
            };
            6
        ],
    };
    let stakes = MigrationGroup::Stakes(vec![key(40); 3]);

    // Act
    let traces = (
        migration_instruction_trace(&tokens, true),
        migration_instruction_trace(&stakes, false),
        migration_instruction_trace(&MigrationGroup::Sol { keep: 0 }, true),
    );

    // Assert: 4 for the execute transaction, 1 for the event, then 9 per token or 3 per stake.
    assert_eq!(traces, (59, 13, 6));
}

#[test]
fn fails_when_one_asset_does_not_fit() {
    // Arrange
    let limits = MigrationLimits {
        max_message_bytes: 100,
        ..MigrationLimits::DEFAULT
    };

    // Act
    let result = chunk_migration_groups(&token_groups(1), &chunk_input(&[], limits));

    // Assert
    assert!(matches!(
        result,
        Err(squads_multisig_4r::error::ClientError::Plan(_))
    ));
}

#[test]
fn finds_the_v4_vault_index() {
    // Arrange
    let source = key(2);
    let vault = squads_multisig_4r::pda::get_vault_pda(
        &source,
        7,
        Some(&squads_multisig_4r::LEGACY_V4_PROGRAM_ID),
    )
    .0;

    // Act
    let found = (
        find_v4_vault_index(&source, &vault),
        find_v4_vault_index(&source, &key(9)),
    );

    // Assert
    assert_eq!(found, (Some(7), None));
}

#[test]
fn lookup_tables_hold_each_account_once_and_no_signers_or_programs() {
    // Arrange
    let items = chunk_migration_groups(
        &token_groups(2),
        &chunk_input(&[], MigrationLimits::DEFAULT),
    )
    .expect("chunks");
    let instructions: Vec<_> = items.iter().map(|item| item.instruction.clone()).collect();

    // Act
    let addresses = lookup_table_addresses(&instructions);

    // Assert
    let mut unique = addresses.clone();
    unique.dedup();
    assert_eq!(unique.len(), addresses.len());
    assert!(!addresses.contains(&TOKEN_PROGRAM_ID));
    assert!(addresses.contains(&key(10)) && addresses.contains(&key(110)));
}

#[test]
fn creates_one_table_for_each_256_addresses_and_extends_in_chunks() {
    // Arrange
    let addresses: Vec<Address> = (0..300u16)
        .map(|i| {
            let mut bytes = [0u8; 32];
            bytes[..2].copy_from_slice(&i.to_le_bytes());
            Address::new_from_array(bytes)
        })
        .collect();

    // Act
    let setup = create_lookup_tables(&addresses, &key(1), &key(2), 1_000);

    // Assert: 256 + 44 addresses; 13 + 3 extend transactions; distinct table addresses.
    let sizes: Vec<usize> = setup
        .tables
        .iter()
        .map(|table| table.addresses.len())
        .collect();
    assert_eq!(sizes, vec![256, 44]);
    assert_ne!(setup.tables[0].key, setup.tables[1].key);
    assert_eq!(
        setup.transactions.len(),
        256usize.div_ceil(LOOKUP_TABLE_ADDRESSES_PER_EXTEND) + 3
    );
    assert_eq!(setup.transactions[0].len(), 2);
}

#[test]
fn parses_a_lookup_table_account() {
    // Arrange: discriminator 1, a 52-byte meta, then the addresses.
    let data = [
        &1u32.to_le_bytes()[..],
        &[0; 52],
        &key(7).to_bytes(),
        &key(8).to_bytes(),
    ]
    .concat();

    // Act
    let table = parse_lookup_table(key(3), &data);

    // Assert
    assert_eq!(
        table,
        Some(AddressLookupTableAccount {
            key: key(3),
            addresses: vec![key(7), key(8)],
        })
    );
    assert_eq!(parse_lookup_table(key(3), &[0; 56]), None);
}
