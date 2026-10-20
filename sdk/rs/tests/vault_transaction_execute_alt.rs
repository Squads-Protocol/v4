//! Regression tests: the Rust `vault_transaction_execute` helper must emit the
//! lookup-table account metas built from `message.address_table_lookups` (in message order),
//! not from the raw caller-supplied slice. The program splits `remaining_accounts` at
//! `message.address_table_lookups.len()` and requires the tables to match by order and length.

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use solana_message::AddressLookupTableAccount;
use squads_multisig_4r::instructions::VaultTransactionExecute;
use squads_multisig_4r::message::{compile_transaction_message, vault_transaction_execute};
use squads_multisig_4r::pda::get_vault_pda;
use squads_multisig_4r::types::VaultTransactionMessage;

const SYSTEM_PROGRAM: Address = Address::new_from_array([0; 32]);

fn system_transfer(from: &Address, to: &Address, lamports: u64) -> Instruction {
    let data = [&2u32.to_le_bytes()[..], &lamports.to_le_bytes()].concat();
    Instruction::new_with_bytes(
        SYSTEM_PROGRAM,
        &data,
        vec![AccountMeta::new(*from, true), AccountMeta::new(*to, false)],
    )
}

fn execute_accounts(multisig: Address) -> VaultTransactionExecute {
    VaultTransactionExecute {
        multisig,
        proposal: Address::new_unique(),
        transaction: Address::new_unique(),
        member: Address::new_unique(),
    }
}

fn loaded_account_count(message: &VaultTransactionMessage) -> usize {
    message
        .address_table_lookups
        .iter()
        .map(|lookup| lookup.writable_indexes.len() + lookup.readonly_indexes.len())
        .sum()
}

/// A message that references one lookup table, while the caller holds a superset of two.
fn compile_superset() -> (
    VaultTransactionMessage,
    AddressLookupTableAccount,
    AddressLookupTableAccount,
    Address,
) {
    let multisig = Address::new_unique();
    let vault = get_vault_pda(&multisig, 0, None).0;
    let destination = Address::new_unique();
    let unused = AddressLookupTableAccount {
        key: Address::new_unique(),
        addresses: vec![Address::new_unique(), Address::new_unique()],
    };
    let used = AddressLookupTableAccount {
        key: Address::new_unique(),
        addresses: vec![SYSTEM_PROGRAM, destination],
    };
    let message = compile_transaction_message(
        &vault,
        &[system_transfer(&vault, &destination, 1)],
        &[unused.clone(), used.clone()],
    )
    .expect("lookup-table superset should compile into a valid message");
    (
        VaultTransactionMessage::from(&message),
        unused,
        used,
        multisig,
    )
}

#[test]
fn execute_helper_emits_lookup_tables_in_message_order_not_caller_order() {
    // Arrange
    let (message, unused, used, multisig) = compile_superset();
    let base = execute_accounts(multisig).instruction().accounts.len();
    let expected_remaining = message.address_table_lookups.len()
        + message.account_keys.len()
        + loaded_account_count(&message);

    assert_eq!(
        message.address_table_lookups.len(),
        1,
        "compile should retain only the referenced lookup table"
    );
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
        assert_eq!(
            remaining.len(),
            expected_remaining,
            "an ALT superset must not change the remaining-account layout"
        );
        assert_eq!(
            remaining[0].pubkey, used.key,
            "the only leading lookup-table meta must be the referenced table"
        );
        assert!(
            !remaining[1..]
                .iter()
                .take(message.account_keys.len())
                .any(|meta| meta.pubkey == unused.key),
            "the unused lookup table must not appear among the emitted accounts",
        );
    }
}

#[test]
fn execute_helper_errors_when_referenced_lookup_table_missing() {
    // Arrange
    let (message, unused, _used, multisig) = compile_superset();

    // Act
    let result =
        vault_transaction_execute(&execute_accounts(multisig), 0, 0, &message, &[unused], None);

    // Assert
    assert!(
        result.is_err(),
        "a missing referenced lookup table must be rejected, not silently dropped"
    );
}

#[test]
fn execute_helper_targets_the_given_program_id() {
    // Arrange
    let (message, _unused, used, multisig) = compile_superset();
    let localnet = Address::new_unique();

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
