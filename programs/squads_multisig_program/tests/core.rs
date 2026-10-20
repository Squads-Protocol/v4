//! Core API checks that need no Anchor: discriminators, errors and builder account lists
//! against the IDL, builder data against mainnet instruction bytes, account decoding, and
//! message compilation. Runs with and without the `program` feature.

mod common;

use borsh::BorshDeserialize;
use common::{fixtures, idl, idl_account_flags, instruction_data, ACCOUNTS};
use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use squads_multisig_4r_program::account::{decode_checked, ProgramAccount};
use squads_multisig_4r_program::error::CoreError;
use squads_multisig_4r_program::errors::MultisigError;
use squads_multisig_4r_program::instructions::*;
use squads_multisig_4r_program::message::{
    compile_transaction_message, transaction_message_bytes, vault_transaction_execute,
    AddressLookupTableAccount,
};
use squads_multisig_4r_program::pda::get_vault_pda;
use squads_multisig_4r_program::state::Member;
use squads_multisig_4r_program::state::{
    Batch, ConfigTransaction, Multisig, ProgramConfig, Proposal, SpendingLimit, TransactionBuffer,
    VaultBatchTransaction, VaultTransaction, VaultTransactionMessage,
};
use squads_multisig_4r_program::{builders, ID, LEGACY_V4_PROGRAM_ID};

fn unique() -> Address {
    Address::new_unique()
}

fn key(byte: u8) -> Address {
    Address::new_from_array([byte; 32])
}

#[test]
fn discriminators_match_the_idl() {
    // Arrange
    let idl = idl();
    let bytes = |value: &serde_json::Value| -> Vec<u8> {
        value
            .as_array()
            .expect("discriminator")
            .iter()
            .map(|b| b.as_u64().expect("byte") as u8)
            .collect()
    };
    let accounts: Vec<(String, Vec<u8>)> = idl["accounts"]
        .as_array()
        .expect("accounts")
        .iter()
        .map(|a| {
            (
                a["name"].as_str().expect("name").to_string(),
                bytes(&a["discriminator"]),
            )
        })
        .collect();

    // Act
    let core = [
        ("Batch", Batch::ACCOUNT_DISCRIMINATOR),
        (
            "ConfigTransaction",
            ConfigTransaction::ACCOUNT_DISCRIMINATOR,
        ),
        ("Multisig", Multisig::ACCOUNT_DISCRIMINATOR),
        ("ProgramConfig", ProgramConfig::ACCOUNT_DISCRIMINATOR),
        ("Proposal", Proposal::ACCOUNT_DISCRIMINATOR),
        ("SpendingLimit", SpendingLimit::ACCOUNT_DISCRIMINATOR),
        (
            "TransactionBuffer",
            TransactionBuffer::ACCOUNT_DISCRIMINATOR,
        ),
        (
            "VaultBatchTransaction",
            VaultBatchTransaction::ACCOUNT_DISCRIMINATOR,
        ),
        ("VaultTransaction", VaultTransaction::ACCOUNT_DISCRIMINATOR),
    ];

    // Assert
    assert_eq!(accounts.len(), core.len());
    core.iter().for_each(|(name, disc)| {
        let expected = &accounts.iter().find(|(n, _)| n == name).expect("in IDL").1;
        assert_eq!(&disc.to_vec(), expected, "{name}");
    });
}

#[test]
fn errors_match_the_idl() {
    // Arrange
    let idl = idl();
    let expected = idl["errors"].as_array().expect("errors");

    // Act / Assert
    assert_eq!(MultisigError::ALL.len(), expected.len());
    MultisigError::ALL
        .iter()
        .zip(expected)
        .for_each(|(error, entry)| {
            assert_eq!(
                u64::from(error.code()),
                entry["code"].as_u64().expect("code")
            );
            let name = entry["name"].as_str().expect("name");
            assert!(
                name.eq_ignore_ascii_case(&error.name().replace('_', "")),
                "{name}"
            );
            assert_eq!(
                error.to_string(),
                entry["msg"].as_str().expect("msg"),
                "{name}"
            );
            assert_eq!(MultisigError::from_code(error.code()), Some(*error));
        });
}

/// Checks a builder's output (all optional accounts set, and all omitted) against the IDL
/// and against the mainnet instruction data it was built from.
fn check(name: &str, data: &[u8], some: &Instruction, none: &Instruction) {
    let flags = idl_account_flags(name);
    assert_eq!(some.data, data, "{name}: data");
    assert_eq!(none.data, data, "{name}: data");
    assert_eq!(some.program_id, ID, "{name}: program id");
    assert_eq!(some.accounts.len(), flags.len(), "{name}: account count");
    assert_eq!(none.accounts.len(), flags.len(), "{name}: account count");
    some.accounts
        .iter()
        .zip(&none.accounts)
        .zip(&flags)
        .enumerate()
        .for_each(|(i, ((with, without), &(writable, signer, optional)))| {
            assert_eq!(
                (with.is_writable, with.is_signer),
                (writable, signer),
                "{name}[{i}]"
            );
            match optional {
                true => assert_eq!(
                    *without,
                    AccountMeta::new_readonly(ID, false),
                    "{name}[{i}]"
                ),
                false => assert_eq!((without.is_writable, without.is_signer), (writable, signer)),
            }
        });
    let mut keys: Vec<Address> = some.accounts.iter().map(|m| m.pubkey).collect();
    keys.sort();
    keys.dedup();
    assert_eq!(
        keys.len(),
        some.accounts.len(),
        "{name}: every field maps to one account"
    );
}

macro_rules! case {
    ($name:literal, args $args:ty, $some:expr, $none:expr) => {
        for data in instruction_data($name) {
            let args = || <$args>::deserialize(&mut &data[8..]).expect("fixture args decode");
            let some = $some.instruction(args(), None).expect("builder");
            let none = $none.instruction(args(), None).expect("builder");
            check($name, &data, &some, &none);
        }
    };
    ($name:literal, no_args, $some:expr, $none:expr) => {
        for data in instruction_data($name) {
            check(
                $name,
                &data,
                &$some.instruction(None),
                &$none.instruction(None),
            );
        }
    };
}

#[test]
fn builders_match_the_idl_and_rebuild_mainnet_instruction_data() {
    case!(
        "batch_accounts_close",
        no_args,
        builders::BatchAccountsClose {
            multisig: unique(),
            proposal: unique(),
            batch: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        builders::BatchAccountsClose {
            multisig: unique(),
            proposal: unique(),
            batch: unique(),
            rent_collector: unique(),
            system_program: unique()
        }
    );
    case!("batch_add_transaction", args BatchAddTransactionArgs, builders::BatchAddTransaction { multisig: unique(), proposal: unique(), batch: unique(), transaction: unique(), member: unique(), rent_payer: unique(), system_program: unique() }, builders::BatchAddTransaction { multisig: unique(), proposal: unique(), batch: unique(), transaction: unique(), member: unique(), rent_payer: unique(), system_program: unique() });
    case!("batch_create", args BatchCreateArgs, builders::BatchCreate { multisig: unique(), batch: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, builders::BatchCreate { multisig: unique(), batch: unique(), creator: unique(), rent_payer: unique(), system_program: unique() });
    case!(
        "batch_execute_transaction",
        no_args,
        builders::BatchExecuteTransaction {
            multisig: unique(),
            member: unique(),
            proposal: unique(),
            batch: unique(),
            transaction: unique()
        },
        builders::BatchExecuteTransaction {
            multisig: unique(),
            member: unique(),
            proposal: unique(),
            batch: unique(),
            transaction: unique()
        }
    );
    case!(
        "config_transaction_accounts_close",
        no_args,
        builders::ConfigTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        builders::ConfigTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        }
    );
    case!("config_transaction_create", args ConfigTransactionCreateArgs, builders::ConfigTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, builders::ConfigTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() });
    case!(
        "config_transaction_execute",
        no_args,
        builders::ConfigTransactionExecute {
            multisig: unique(),
            member: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_payer: Some(unique()),
            system_program: Some(unique())
        },
        builders::ConfigTransactionExecute {
            multisig: unique(),
            member: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_payer: None,
            system_program: None
        }
    );
    case!("multisig_add_member", args MultisigAddMemberArgs, builders::MultisigAddMember { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, builders::MultisigAddMember { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None });
    case!("multisig_add_spending_limit", args MultisigAddSpendingLimitArgs, builders::MultisigAddSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_payer: unique(), system_program: unique() }, builders::MultisigAddSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_payer: unique(), system_program: unique() });
    case!("multisig_change_threshold", args MultisigChangeThresholdArgs, builders::MultisigChangeThreshold { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, builders::MultisigChangeThreshold { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None });
    case!("multisig_create_v2", args MultisigCreateArgsV2, builders::MultisigCreateV2 { program_config: unique(), treasury: unique(), multisig: unique(), create_key: unique(), creator: unique(), system_program: unique() }, builders::MultisigCreateV2 { program_config: unique(), treasury: unique(), multisig: unique(), create_key: unique(), creator: unique(), system_program: unique() });
    case!("multisig_remove_member", args MultisigRemoveMemberArgs, builders::MultisigRemoveMember { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, builders::MultisigRemoveMember { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None });
    case!("multisig_remove_spending_limit", args MultisigRemoveSpendingLimitArgs, builders::MultisigRemoveSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_collector: unique() }, builders::MultisigRemoveSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_collector: unique() });
    case!("multisig_set_config_authority", args MultisigSetConfigAuthorityArgs, builders::MultisigSetConfigAuthority { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, builders::MultisigSetConfigAuthority { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None });
    case!("multisig_set_rent_collector", args MultisigSetRentCollectorArgs, builders::MultisigSetRentCollector { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, builders::MultisigSetRentCollector { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None });
    case!("multisig_set_time_lock", args MultisigSetTimeLockArgs, builders::MultisigSetTimeLock { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, builders::MultisigSetTimeLock { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None });
    case!("program_config_init", args ProgramConfigInitArgs, builders::ProgramConfigInit { program_config: unique(), initializer: unique(), system_program: unique() }, builders::ProgramConfigInit { program_config: unique(), initializer: unique(), system_program: unique() });
    case!("program_config_set_authority", args ProgramConfigSetAuthorityArgs, builders::ProgramConfigSetAuthority { program_config: unique(), authority: unique() }, builders::ProgramConfigSetAuthority { program_config: unique(), authority: unique() });
    case!("program_config_set_multisig_creation_fee", args ProgramConfigSetMultisigCreationFeeArgs, builders::ProgramConfigSetMultisigCreationFee { program_config: unique(), authority: unique() }, builders::ProgramConfigSetMultisigCreationFee { program_config: unique(), authority: unique() });
    case!("program_config_set_treasury", args ProgramConfigSetTreasuryArgs, builders::ProgramConfigSetTreasury { program_config: unique(), authority: unique() }, builders::ProgramConfigSetTreasury { program_config: unique(), authority: unique() });
    case!(
        "proposal_activate",
        no_args,
        builders::ProposalActivate {
            multisig: unique(),
            member: unique(),
            proposal: unique()
        },
        builders::ProposalActivate {
            multisig: unique(),
            member: unique(),
            proposal: unique()
        }
    );
    case!("proposal_approve", args ProposalVoteArgs, builders::ProposalApprove { multisig: unique(), member: unique(), proposal: unique() }, builders::ProposalApprove { multisig: unique(), member: unique(), proposal: unique() });
    case!("proposal_cancel", args ProposalVoteArgs, builders::ProposalCancel { multisig: unique(), member: unique(), proposal: unique() }, builders::ProposalCancel { multisig: unique(), member: unique(), proposal: unique() });
    case!("proposal_cancel_v2", args ProposalVoteArgs, builders::ProposalCancelV2 { multisig: unique(), member: unique(), proposal: unique(), system_program: unique() }, builders::ProposalCancelV2 { multisig: unique(), member: unique(), proposal: unique(), system_program: unique() });
    case!("proposal_create", args ProposalCreateArgs, builders::ProposalCreate { multisig: unique(), proposal: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, builders::ProposalCreate { multisig: unique(), proposal: unique(), creator: unique(), rent_payer: unique(), system_program: unique() });
    case!("proposal_reject", args ProposalVoteArgs, builders::ProposalReject { multisig: unique(), member: unique(), proposal: unique() }, builders::ProposalReject { multisig: unique(), member: unique(), proposal: unique() });
    case!("spending_limit_use", args SpendingLimitUseArgs, builders::SpendingLimitUse { multisig: unique(), member: unique(), spending_limit: unique(), vault: unique(), destination: unique(), system_program: Some(unique()), mint: Some(unique()), vault_token_account: Some(unique()), destination_token_account: Some(unique()), token_program: Some(unique()) }, builders::SpendingLimitUse { multisig: unique(), member: unique(), spending_limit: unique(), vault: unique(), destination: unique(), system_program: None, mint: None, vault_token_account: None, destination_token_account: None, token_program: None });
    case!(
        "transaction_buffer_close",
        no_args,
        builders::TransactionBufferClose {
            multisig: unique(),
            transaction_buffer: unique(),
            creator: unique()
        },
        builders::TransactionBufferClose {
            multisig: unique(),
            transaction_buffer: unique(),
            creator: unique()
        }
    );
    case!("transaction_buffer_create", args TransactionBufferCreateArgs, builders::TransactionBufferCreate { multisig: unique(), transaction_buffer: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, builders::TransactionBufferCreate { multisig: unique(), transaction_buffer: unique(), creator: unique(), rent_payer: unique(), system_program: unique() });
    case!("transaction_buffer_extend", args TransactionBufferExtendArgs, builders::TransactionBufferExtend { multisig: unique(), transaction_buffer: unique(), creator: unique() }, builders::TransactionBufferExtend { multisig: unique(), transaction_buffer: unique(), creator: unique() });
    case!(
        "vault_batch_transaction_account_close",
        no_args,
        builders::VaultBatchTransactionAccountClose {
            multisig: unique(),
            proposal: unique(),
            batch: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        builders::VaultBatchTransactionAccountClose {
            multisig: unique(),
            proposal: unique(),
            batch: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        }
    );
    case!(
        "vault_transaction_accounts_close",
        no_args,
        builders::VaultTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        builders::VaultTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        }
    );
    case!("vault_transaction_create", args VaultTransactionCreateArgs, builders::VaultTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, builders::VaultTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() });
    case!("vault_transaction_create_from_buffer", args VaultTransactionCreateArgs, builders::VaultTransactionCreateFromBuffer { vault_transaction_create_multisig: unique(), vault_transaction_create_transaction: unique(), vault_transaction_create_creator: unique(), vault_transaction_create_rent_payer: unique(), vault_transaction_create_system_program: unique(), transaction_buffer: unique(), creator: unique() }, builders::VaultTransactionCreateFromBuffer { vault_transaction_create_multisig: unique(), vault_transaction_create_transaction: unique(), vault_transaction_create_creator: unique(), vault_transaction_create_rent_payer: unique(), vault_transaction_create_system_program: unique(), transaction_buffer: unique(), creator: unique() });
    case!(
        "vault_transaction_execute",
        no_args,
        builders::VaultTransactionExecute {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            member: unique()
        },
        builders::VaultTransactionExecute {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            member: unique()
        }
    );
}

#[test]
fn builders_use_the_given_program_id_for_omitted_optional_accounts() {
    // Arrange
    let staging = unique();
    let builder = builders::ConfigTransactionExecute {
        multisig: unique(),
        member: unique(),
        proposal: unique(),
        transaction: unique(),
        rent_payer: None,
        system_program: None,
    };

    // Act
    let instruction = builder.instruction(Some(&staging));

    // Assert
    assert_eq!(instruction.program_id, staging);
    assert!(instruction.accounts[4..]
        .iter()
        .all(|meta| *meta == AccountMeta::new_readonly(staging, false)));
}

macro_rules! decode_as {
    ($label:expr, $id:expr, $data:expr; $($name:literal => $ty:ty,)*) => {
        match $label {
            $($name => {
                let decoded = <$ty>::try_from_account_data(&key(0), $data)
                    .unwrap_or_else(|e| panic!("{}: {e}", $id));
                let encoded = borsh::to_vec(&decoded).expect("encode");
                assert_eq!(encoded, $data[8..8 + encoded.len()], "{}", $id);
            })*
            other => panic!("unknown account type {other}"),
        }
    };
}

#[test]
fn account_types_decode_and_reencode_mainnet_accounts() {
    fixtures(ACCOUNTS).for_each(|(label, id, data)| {
        decode_as!(label, id, &data;
            "Batch" => Batch,
            "ConfigTransaction" => ConfigTransaction,
            "Multisig" => Multisig,
            "ProgramConfig" => ProgramConfig,
            "Proposal" => Proposal,
            "SpendingLimit" => SpendingLimit,
            "TransactionBuffer" => TransactionBuffer,
            "VaultBatchTransaction" => VaultBatchTransaction,
            "VaultTransaction" => VaultTransaction,
        );
    });
}

#[test]
fn decode_checked_rejects_a_foreign_owner_and_a_wrong_discriminator() {
    // Arrange
    let (_, _, multisig) = fixtures(ACCOUNTS)
        .find(|(label, _, _)| *label == "Multisig")
        .expect("multisig fixture");
    let address = unique();
    let foreign = unique();

    // Act
    let wrong_owner = decode_checked::<Multisig>(&address, &foreign, &multisig, None);
    let wrong_type = decode_checked::<Proposal>(&address, &ID, &multisig, None);
    let ok = decode_checked::<Multisig>(&address, &ID, &multisig, None);

    // Assert
    assert_eq!(
        wrong_owner.unwrap_err(),
        CoreError::WrongOwner {
            address,
            owner: foreign,
            expected: ID
        }
    );
    assert_eq!(
        wrong_type.unwrap_err(),
        CoreError::WrongDiscriminator(address)
    );
    assert!(ok.is_ok());
}

#[test]
fn size_constants_match_the_layout() {
    assert_eq!(Member::LEN, 33);
    assert_eq!(Batch::LEN, 83);
    assert_eq!(ProgramConfig::LEN, 136);
}

/// Pins the compiled `TransactionMessage` bytes for a fixed input. The TypeScript SDK
/// (`sdk/multisig-4r/test/unit/message.test.ts`) asserts the same vector.
const EXPECTED_HEX: &str = concat!(
    "0201010609090909090909090909090909090909090909090909090909090909090909090505050505050505",
    "0505050505050505050505050505050505050505050505050707070707070707070707070707070707070707",
    "0707070707070707070707070303030303030303030303030303030303030303030303030303030303030303",
    "6464646464646464646464646464646464646464646464646464646464646464c8c8c8c8c8c8c8c8c8c8c8c8",
    "c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8020503000201030001020304030306070000013c3c3c3c3c",
    "3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c01020100",
);

#[test]
fn compiled_message_matches_the_shared_cross_sdk_vector() {
    // Arrange
    let vault = key(9);
    let instructions = [
        Instruction::new_with_bytes(
            key(200),
            &[1, 2, 3],
            vec![
                AccountMeta::new(vault, true),
                AccountMeta::new(key(7), false),
                AccountMeta::new_readonly(key(5), true),
            ],
        ),
        Instruction::new_with_bytes(
            key(100),
            &[],
            vec![
                AccountMeta::new_readonly(key(3), false),
                AccountMeta::new(key(1), false),
                AccountMeta::new_readonly(key(8), false),
            ],
        ),
    ];
    let tables = [
        AddressLookupTableAccount {
            key: key(50),
            addresses: vec![key(42), key(43)],
        },
        AddressLookupTableAccount {
            key: key(60),
            addresses: vec![key(8), key(99), key(1)],
        },
    ];

    // Act
    let bytes = transaction_message_bytes(&vault, &instructions, &tables).expect("compile");

    // Assert
    let hex: String = bytes.iter().map(|b| format!("{b:02x}")).collect();
    assert_eq!(hex, EXPECTED_HEX);
}

fn system_transfer(from: &Address, to: &Address, lamports: u64) -> Instruction {
    let data = [&2u32.to_le_bytes()[..], &lamports.to_le_bytes()].concat();
    Instruction::new_with_bytes(
        builders::SYSTEM_PROGRAM_ID,
        &data,
        vec![AccountMeta::new(*from, true), AccountMeta::new(*to, false)],
    )
}

fn execute_accounts(multisig: Address) -> builders::VaultTransactionExecute {
    builders::VaultTransactionExecute {
        multisig,
        proposal: unique(),
        transaction: unique(),
        member: unique(),
    }
}

/// A message that references one lookup table, while the caller holds a superset of two.
fn compile_superset() -> (
    VaultTransactionMessage,
    AddressLookupTableAccount,
    AddressLookupTableAccount,
    Address,
) {
    let multisig = unique();
    let vault = get_vault_pda(&multisig, 0, None).0;
    let destination = unique();
    let unused = AddressLookupTableAccount {
        key: unique(),
        addresses: vec![unique(), unique()],
    };
    let used = AddressLookupTableAccount {
        key: unique(),
        addresses: vec![builders::SYSTEM_PROGRAM_ID, destination],
    };
    let message = compile_transaction_message(
        &vault,
        &[system_transfer(&vault, &destination, 1)],
        &[unused.clone(), used.clone()],
    )
    .expect("lookup-table superset should compile into a valid message");
    let message = VaultTransactionMessage::try_from(message).expect("valid message");
    (message, unused, used, multisig)
}

#[test]
fn execute_helper_emits_lookup_tables_in_message_order_not_caller_order() {
    // Arrange
    let (message, unused, used, multisig) = compile_superset();
    let base = execute_accounts(multisig).instruction(None).accounts.len();
    let loaded: usize = message
        .address_table_lookups
        .iter()
        .map(|l| l.writable_indexes.len() + l.readonly_indexes.len())
        .sum();
    let expected_remaining =
        message.address_table_lookups.len() + message.account_keys.len() + loaded;
    assert_eq!(message.address_table_lookups.len(), 1);
    assert_eq!(message.address_table_lookups[0].account_key, used.key);

    for supplied in [
        vec![unused.clone(), used.clone()],
        vec![used.clone(), unused.clone()],
    ] {
        // Act
        let instruction =
            vault_transaction_execute(&execute_accounts(multisig), 0, 0, &message, &supplied, None)
                .expect("execute helper should assemble an instruction");

        // Assert
        let remaining = &instruction.accounts[base..];
        assert_eq!(remaining.len(), expected_remaining);
        assert_eq!(remaining[0].pubkey, used.key);
        assert!(!remaining.iter().any(|meta| meta.pubkey == unused.key));
    }
}

#[test]
fn execute_helper_errors_when_referenced_lookup_table_missing() {
    // Arrange
    let (message, unused, used, multisig) = compile_superset();

    // Act
    let result =
        vault_transaction_execute(&execute_accounts(multisig), 0, 0, &message, &[unused], None);

    // Assert
    assert_eq!(
        result.unwrap_err(),
        CoreError::MissingAddressLookupTable(used.key)
    );
}

#[test]
fn execute_helper_targets_the_given_program_id() {
    // Arrange
    let (message, _unused, used, multisig) = compile_superset();
    let localnet = unique();

    // Act
    let instruction = vault_transaction_execute(
        &execute_accounts(multisig),
        0,
        0,
        &message,
        &[used],
        Some(&localnet),
    )
    .expect("execute helper should assemble an instruction");

    // Assert
    assert_eq!(instruction.program_id, localnet);
}

#[test]
fn legacy_v4_program_id_targets_the_frozen_program() {
    // Arrange
    let (_, _, multisig) = fixtures(ACCOUNTS)
        .find(|(label, _, _)| *label == "Multisig")
        .expect("multisig fixture");
    let address = unique();
    let builder = builders::ConfigTransactionExecute {
        multisig: unique(),
        member: unique(),
        proposal: unique(),
        transaction: unique(),
        rent_payer: None,
        system_program: None,
    };

    // Act
    let decoded = decode_checked::<Multisig>(
        &address,
        &LEGACY_V4_PROGRAM_ID,
        &multisig,
        Some(&LEGACY_V4_PROGRAM_ID),
    );
    let instruction = builder.instruction(Some(&LEGACY_V4_PROGRAM_ID));

    // Assert
    assert_eq!(
        LEGACY_V4_PROGRAM_ID.to_string(),
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
    );
    assert_ne!(LEGACY_V4_PROGRAM_ID, ID);
    assert!(decoded.is_ok());
    assert_eq!(instruction.program_id, LEGACY_V4_PROGRAM_ID);
    assert!(instruction.accounts[4..]
        .iter()
        .all(|meta| *meta == AccountMeta::new_readonly(LEGACY_V4_PROGRAM_ID, false)));
}
