//! Regression tests for MUL-753: the Rust `vault_transaction_execute` helper must emit the
//! lookup-table account metas built from `message.address_table_lookups` (in message order),
//! not from the raw caller-supplied slice. Otherwise an ALT superset or a reordered ALT slice
//! desyncs the emitted instruction from the on-chain validator, which splits `remaining_accounts`
//! at `message.address_table_lookups.len()` and requires the leading lookup-table accounts to
//! match the message by both order and length.

use solana_message::AddressLookupTableAccount;
use squads_multisig::{
    anchor_lang::ToAccountMetas,
    client::{vault_transaction_execute, VaultTransactionExecuteAccounts},
    pda::get_vault_pda,
    solana_program::{pubkey::Pubkey, system_instruction, system_program},
    state::TransactionMessage,
    vault_transaction::VaultTransactionMessageExt,
};

fn loaded_account_count(message: &TransactionMessage) -> usize {
    let address_table_lookups: Vec<_> = message.address_table_lookups.clone().into();
    address_table_lookups
        .iter()
        .map(|lookup| lookup.writable_indexes.len() + lookup.readonly_indexes.len())
        .sum()
}

/// Build a message that references a single lookup table, while the caller is handed a superset
/// of two tables (one referenced, one unused).
fn compile_superset() -> (
    TransactionMessage,
    AddressLookupTableAccount,
    AddressLookupTableAccount,
    Pubkey,
) {
    let multisig = Pubkey::new_unique();
    let vault_index = 0;
    let vault_pda = get_vault_pda(&multisig, vault_index, None).0;
    let transfer_destination = Pubkey::new_unique();

    let unused_lookup_table = AddressLookupTableAccount {
        key: Pubkey::new_unique(),
        addresses: vec![Pubkey::new_unique(), Pubkey::new_unique()],
    };
    let used_lookup_table = AddressLookupTableAccount {
        key: Pubkey::new_unique(),
        addresses: vec![system_program::id(), transfer_destination],
    };

    let message = TransactionMessage::try_compile(
        &vault_pda,
        &[system_instruction::transfer(
            &vault_pda,
            &transfer_destination,
            1,
        )],
        &[unused_lookup_table.clone(), used_lookup_table.clone()],
    )
    .expect("lookup-table superset should compile into a valid message");

    (message, unused_lookup_table, used_lookup_table, multisig)
}

fn base_account_count() -> usize {
    VaultTransactionExecuteAccounts {
        multisig: Pubkey::new_unique(),
        member: Pubkey::new_unique(),
        proposal: Pubkey::new_unique(),
        transaction: Pubkey::new_unique(),
    }
    .to_account_metas(Some(false))
    .len()
}

#[test]
fn execute_helper_emits_lookup_tables_in_message_order_not_caller_order() {
    let (message, unused_lookup_table, used_lookup_table, multisig) = compile_superset();

    let address_table_lookups: Vec<_> = message.address_table_lookups.clone().into();
    assert_eq!(
        address_table_lookups.len(),
        1,
        "compile should retain only the referenced lookup table",
    );
    assert_eq!(address_table_lookups[0].account_key, used_lookup_table.key);

    let base = base_account_count();
    // The on-chain layout the validator expects: one meta per referenced lookup table, then the
    // static account keys, then the lookup-loaded accounts. Supplying an extra ALT must NOT add
    // an extra remaining account.
    let expected_remaining_account_count =
        address_table_lookups.len() + message.account_keys.len() + loaded_account_count(&message);

    // The caller supplies the superset in two different orders; both must produce the same layout,
    // driven by the message rather than the caller's ordering.
    for supplied in [
        vec![unused_lookup_table.clone(), used_lookup_table.clone()],
        vec![used_lookup_table.clone(), unused_lookup_table.clone()],
    ] {
        let instruction = vault_transaction_execute(
            VaultTransactionExecuteAccounts {
                multisig,
                member: Pubkey::new_unique(),
                proposal: Pubkey::new_unique(),
                transaction: Pubkey::new_unique(),
            },
            0,
            0,
            &message,
            &supplied,
            None,
        )
        .expect("execute helper should assemble an instruction");

        let remaining = &instruction.accounts[base..];

        assert_eq!(
            remaining.len(),
            expected_remaining_account_count,
            "supplying an ALT superset must not change the message-defined remaining-account layout",
        );
        assert_eq!(
            remaining[0].pubkey, used_lookup_table.key,
            "the only leading lookup-table meta must be the message-referenced table",
        );
        // Exactly one leading lookup-table meta (matches `message.address_table_lookups.len()`),
        // so the next meta is already a static account key, never the unused table.
        assert!(
            !remaining[1..]
                .iter()
                .take(message.account_keys.len())
                .any(|meta| meta.pubkey == unused_lookup_table.key),
            "the unused lookup table must not appear among the emitted accounts",
        );
    }
}

#[test]
fn execute_helper_errors_when_referenced_lookup_table_missing() {
    let (message, unused_lookup_table, _used_lookup_table, multisig) = compile_superset();

    // Supply only the unused table, omitting the one the message actually references.
    let result = vault_transaction_execute(
        VaultTransactionExecuteAccounts {
            multisig,
            member: Pubkey::new_unique(),
            proposal: Pubkey::new_unique(),
            transaction: Pubkey::new_unique(),
        },
        0,
        0,
        &message,
        &[unused_lookup_table],
        None,
    );

    assert!(
        result.is_err(),
        "a missing referenced lookup table must be rejected, not silently dropped",
    );
}
