//! The v3 client: account readers against mainnet accounts, PDAs, instruction encoders, and the
//! roles delegate detection. The same cases as `sdk/multisig-4r/test/unit/v3.test.ts`.

use std::str::FromStr;

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use squads_multisig_4r::error::ClientError;
use squads_multisig_4r::v3::*;
use squads_multisig_4r::v3_migration::*;

const V3_ACCOUNTS: &str =
    include_str!("../../../programs/squads_multisig_program/tests/fixtures/golden/v3_accounts.txt");

fn key(byte: u8) -> Address {
    Address::new_from_array([byte; 32])
}

fn hex_decode(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("valid hex"))
        .collect()
}

/// The mainnet v3 `Ms` fixtures: address and account data.
fn v3_accounts() -> Vec<(Address, Vec<u8>)> {
    V3_ACCOUNTS
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| {
            let parts: Vec<&str> = line.split_whitespace().collect();
            assert_eq!(parts[0], "Ms");
            (
                Address::from_str(parts[1]).expect("address"),
                hex_decode(parts[2]),
            )
        })
        .collect()
}

#[test]
fn decodes_the_mainnet_v3_multisigs_each_the_pda_of_its_create_key() {
    // Arrange
    let accounts = v3_accounts();

    // Act
    let decoded: Vec<Ms> = accounts
        .iter()
        .map(|(_, data)| Ms::decode(data).expect("decodes"))
        .collect();

    // Assert: the same values as programs/squads_multisig_program/tests/migration_v3.rs.
    let shape: Vec<_> = decoded
        .iter()
        .map(|ms| (ms.threshold, ms.keys.len()))
        .collect();
    assert_eq!(shape, vec![(3, 6), (2, 2)]);
    decoded
        .iter()
        .zip(&accounts)
        .for_each(|(ms, (address, _))| {
            assert_eq!(get_v3_multisig_pda(&ms.create_key), (*address, ms.bump));
        });
    assert_eq!(decoded[0].governance().keys, decoded[0].keys);
}

#[test]
fn derives_the_authority_that_signs_on_mainnet() {
    // Arrange
    let (multisig, _) = v3_accounts()[0];
    let signer = Address::from_str("MmHsqX4LxTfifxoH8BVRLUKrwDn1LPCac6YcCZTHhwt").expect("address");

    // Act
    let (authority, _) = get_v3_authority_pda(&multisig, 1);

    // Assert
    assert_eq!(authority, signer);
}

#[test]
fn maps_authority_n_to_vault_n_minus_1_from_1_to_256_only() {
    // Act
    let valid: Vec<_> = [1, 2, 256]
        .into_iter()
        .map(|index| v3_vault_index(index).ok())
        .collect();
    let invalid = [0, 257, u32::MAX].map(|index| v3_vault_index(index).is_err());

    // Assert
    assert_eq!(valid, vec![Some(0), Some(1), Some(255)]);
    assert_eq!(invalid, [true; 3]);
}

#[test]
fn encodes_an_incoming_instruction_program_metas_and_data() {
    // Arrange
    let instruction = Instruction {
        program_id: key(1),
        accounts: vec![
            AccountMeta::new(key(2), true),
            AccountMeta::new_readonly(key(3), false),
        ],
        data: vec![9, 8],
    };

    // Act
    let bytes = encode_incoming_instruction(&instruction);

    // Assert
    let expected = [
        &key(1).to_bytes()[..],
        &2u32.to_le_bytes(),
        &key(2).to_bytes(),
        &[1, 1],
        &key(3).to_bytes(),
        &[0, 0],
        &2u32.to_le_bytes(),
        &[9, 8],
    ]
    .concat();
    assert_eq!(bytes, expected);
}

#[test]
fn reads_back_a_stored_instruction_and_executes_it_without_signers() {
    // Arrange: an attached instruction as v3 stores it, with 3 bytes of headroom.
    let instruction = Instruction {
        program_id: key(1),
        accounts: vec![
            AccountMeta::new(key(2), true),
            AccountMeta::new_readonly(key(3), false),
        ],
        data: vec![9, 8],
    };
    let stored = [
        &discriminator::MS_INSTRUCTION[..],
        &encode_incoming_instruction(&instruction),
        &[1, 254, 0],
        &[0; 3],
    ]
    .concat();
    let (multisig, transaction, instruction_account, member) = (key(4), key(5), key(6), key(7));

    // Act
    let decoded = MsInstruction::decode(&stored).expect("decodes");
    let execute = execute_instruction(
        &multisig,
        &transaction,
        &instruction_account,
        &member,
        &decoded,
    );

    // Assert
    let expected = MsInstruction {
        bump: 254,
        ..MsInstruction::attached(&instruction, 1)
    };
    assert_eq!(decoded, expected);
    assert_eq!(execute.program_id, LEGACY_V3_PROGRAM_ID);
    assert_eq!(execute.data, discriminator::EXECUTE_INSTRUCTION);
    assert_eq!(
        execute.accounts,
        vec![
            AccountMeta::new(multisig, false),
            AccountMeta::new(transaction, false),
            AccountMeta::new(instruction_account, false),
            AccountMeta::new(member, true),
            AccountMeta::new_readonly(key(1), false),
            AccountMeta::new(key(2), false),
            AccountMeta::new_readonly(key(3), false),
        ]
    );
}

#[test]
fn reads_a_transaction_and_refuses_other_data() {
    // Arrange: Executed (3), 4 instructions, 1 approval, 2 executed.
    let data = [
        &discriminator::MS_TRANSACTION[..],
        &key(1).to_bytes(),
        &key(2).to_bytes(),
        &7u32.to_le_bytes(),
        &1u32.to_le_bytes(),
        &[253, 3, 4, 252],
        &1u32.to_le_bytes(),
        &key(3).to_bytes(),
        &0u32.to_le_bytes(),
        &0u32.to_le_bytes(),
        &[2],
    ]
    .concat();

    // Act
    let decoded = MsTransaction::decode(&data).expect("decodes");

    // Assert
    assert_eq!(
        (decoded.transaction_index, decoded.status, decoded.approved),
        (7, MsTransactionStatus::Executed, vec![key(3)])
    );
    assert_eq!((decoded.instruction_index, decoded.executed_index), (4, 2));
    assert_eq!(MsTransaction::decode(&data[..data.len() - 1]), None);
    assert_eq!(Ms::decode(&data), None);
}

#[test]
fn encodes_execute_transaction_with_an_account_list() {
    // Arrange: two instructions that share the program and one account.
    let attached = |byte: u8, writable: bool| {
        MsInstruction::attached(
            &Instruction {
                program_id: key(1),
                accounts: vec![AccountMeta {
                    pubkey: key(byte),
                    is_signer: false,
                    is_writable: writable,
                }],
                data: vec![],
            },
            1,
        )
    };
    let instructions = [(key(10), attached(2, false)), (key(11), attached(2, true))];

    // Act
    let execute = execute_transaction(&key(4), &key(5), &key(7), &instructions).expect("builds");

    // Assert: unique accounts in first-seen order; key(2) is writable once any use writes it.
    let remaining: Vec<_> = execute.accounts[3..].to_vec();
    assert_eq!(
        remaining,
        vec![
            AccountMeta::new_readonly(key(10), false),
            AccountMeta::new_readonly(key(1), false),
            AccountMeta::new(key(2), false),
            AccountMeta::new_readonly(key(11), false),
        ]
    );
    let expected = [
        &discriminator::EXECUTE_TRANSACTION[..],
        &6u32.to_le_bytes(),
        &[0, 1, 2, 3, 1, 2],
    ]
    .concat();
    assert_eq!(execute.data, expected);
}

/// Roles `User` account data.
fn roles_user(name: &str, role: u8, origin: Address, ms: Address, index: u32) -> Vec<u8> {
    [
        &discriminator::ROLES_USER[..],
        &(name.len() as u32).to_le_bytes(),
        name.as_bytes(),
        &[role],
        &origin.to_bytes(),
        &[255],
        &ms.to_bytes(),
        &index.to_le_bytes(),
    ]
    .concat()
}

#[test]
fn finds_the_members_that_are_roles_delegates_with_their_wallets() {
    // Arrange: two roles users; only the first one's delegate is a v3 member.
    let ms = key(40);
    let manager = [
        &discriminator::ROLES_MANAGER[..],
        &ms.to_bytes(),
        &2u32.to_le_bytes(),
        &[254],
    ]
    .concat();
    let users = v3_roles_users(&ms, &V3_ROLES_PROGRAM_ID, &manager);
    let delegate = get_v3_delegate_pda(&users[0], &key(41)).0;
    let accounts = [
        (users[0], roles_user("alice", 1, key(41), ms, 1)),
        (users[1], roles_user("alice", 2, key(42), ms, 2)),
    ];

    // Act
    let delegates = v3_delegate_members(
        &ms,
        &[key(43), delegate],
        accounts
            .iter()
            .map(|(user, data)| (*user, &V3_ROLES_PROGRAM_ID, data.as_slice())),
    );
    let error = ClientError::from(V3DelegateMembersError {
        source_multisig: ms,
        delegates: delegates.clone(),
    })
    .to_string();

    // Assert
    assert_eq!(
        users,
        vec![
            get_v3_roles_user_pda(&ms, 1).0,
            get_v3_roles_user_pda(&ms, 2).0
        ]
    );
    assert_eq!(
        delegates,
        vec![V3DelegateMember {
            delegate,
            user: users[0],
            origin_key: key(41),
            role: Role::Vote,
            name: "alice".into(),
        }]
    );
    assert!(error.contains(&format!("{delegate} -> {} (role Vote", key(41))));
    assert!(error.contains("add_member(wallet) and remove_member(delegate)"));
}

#[test]
fn finds_no_delegates_without_a_roles_manager_of_this_multisig() {
    // Arrange: a manager of another multisig, and one owned by another program.
    let manager = |ms: Address| {
        [
            &discriminator::ROLES_MANAGER[..],
            &ms.to_bytes(),
            &2u32.to_le_bytes(),
            &[254],
        ]
        .concat()
    };

    // Act
    let other_multisig = v3_roles_users(&key(40), &V3_ROLES_PROGRAM_ID, &manager(key(39)));
    let other_owner = v3_roles_users(&key(40), &key(1), &manager(key(40)));

    // Assert
    assert!(other_multisig.is_empty());
    assert!(other_owner.is_empty());
}

#[test]
fn encodes_the_config_instructions_for_authority_0() {
    // Act
    let add = add_member(&key(40), &key(41));
    let remove = remove_member(&key(40), &key(42));
    let threshold = change_threshold(&key(40), 2);

    // Assert: the multisig signs each one through a v3 transaction of authority 0.
    assert_eq!(add.accounts[0], AccountMeta::new(key(40), true));
    assert_eq!(
        add.data,
        [&discriminator::ADD_MEMBER[..], &[41; 32]].concat()
    );
    assert_eq!(
        remove.data,
        [&discriminator::REMOVE_MEMBER[..], &[42; 32]].concat()
    );
    assert_eq!(
        threshold.data,
        [&discriminator::CHANGE_THRESHOLD[..], &[2, 0]].concat()
    );
}
