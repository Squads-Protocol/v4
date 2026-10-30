//! Wire-format contract: real mainnet accounts and instruction data written by the
//! frozen Squads v4 program must decode with this crate and encode to the same bytes.
//! Fixture provenance: `tests/fixtures/golden/README.md`.

use anchor_lang::prelude::borsh;
use anchor_lang::{
    AccountDeserialize, AccountSerialize, AnchorDeserialize, Discriminator, InstructionData, Space,
};
use solana_borsh::v1::get_instance_packed_len;
use squads_multisig_4r_program as program;
use squads_multisig_4r_program::instruction;
use squads_multisig_4r_program::state::{
    Batch, ConfigTransaction, Member, Multisig, ProgramConfig, Proposal, SpendingLimit,
    TransactionBuffer, VaultBatchTransaction, VaultTransaction,
};
use squads_multisig_4r_program::TransactionMessage;

const ACCOUNTS: &str = include_str!("fixtures/golden/accounts.txt");
const INSTRUCTIONS: &str = include_str!("fixtures/golden/instructions.txt");

/// `(label, identifier, bytes)` per non-comment fixture line.
fn fixtures(text: &'static str) -> impl Iterator<Item = (&'static str, &'static str, Vec<u8>)> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| {
            let mut parts = line.split_whitespace();
            let label = parts.next().expect("label");
            let id = parts.next().expect("identifier");
            (label, id, hex_decode(parts.next().expect("hex data")))
        })
}

fn hex_decode(hex: &str) -> Vec<u8> {
    (0..hex.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("valid hex"))
        .collect()
}

/// Decodes `data` as `T`, encodes it again and checks the bytes match. Bytes after
/// the encoded value are realloc headroom or stale tail bytes, not part of the contract.
fn round_trip_account<T: AccountDeserialize + AccountSerialize>(id: &str, data: &[u8]) -> T {
    let decoded =
        T::try_deserialize(&mut &data[..]).unwrap_or_else(|e| panic!("{id}: decode failed: {e:?}"));
    let mut encoded = Vec::new();
    decoded
        .try_serialize(&mut encoded)
        .unwrap_or_else(|e| panic!("{id}: encode failed: {e:?}"));
    assert_eq!(
        encoded,
        data[..encoded.len()],
        "{id}: re-encoded bytes differ"
    );
    decoded
}

fn check_account(kind: &str, id: &str, data: &[u8]) {
    let len = data.len();
    match kind {
        "Multisig" => {
            let multisig: Multisig = round_trip_account(id, data);
            let headroom = len - Multisig::size(multisig.members.len());
            assert_eq!(
                headroom % Member::INIT_SPACE,
                0,
                "{id}: size is not a whole number of member slots"
            );
        }
        "Proposal" => {
            let _: Proposal = round_trip_account(id, data);
            assert_eq!(
                (len - Proposal::size(0)) % (3 * 32),
                0,
                "{id}: size does not match Proposal::size(n)"
            );
        }
        "VaultTransaction" => {
            let tx: VaultTransaction = round_trip_account(id, data);
            let expected = 8
                + 32
                + 32
                + 8
                + 1
                + 1
                + 1
                + 4
                + tx.ephemeral_signer_bumps.len()
                + get_instance_packed_len(&tx.message).expect("packed len");
            assert_eq!(
                len, expected,
                "{id}: allocated size differs from packed length"
            );
        }
        "VaultBatchTransaction" => {
            let tx: VaultBatchTransaction = round_trip_account(id, data);
            let expected = 8
                + 1
                + 4
                + tx.ephemeral_signer_bumps.len()
                + get_instance_packed_len(&tx.message).expect("packed len");
            assert_eq!(
                len, expected,
                "{id}: allocated size differs from packed length"
            );
        }
        "ConfigTransaction" => {
            let tx: ConfigTransaction = round_trip_account(id, data);
            assert_eq!(
                len,
                ConfigTransaction::size(&tx.actions),
                "{id}: size differs from ConfigTransaction::size"
            );
        }
        "SpendingLimit" => {
            let limit: SpendingLimit = round_trip_account(id, data);
            let expected = SpendingLimit::size(limit.members.len(), limit.destinations.len());
            assert_eq!(len, expected, "{id}: size differs from SpendingLimit::size");
        }
        "TransactionBuffer" => {
            let buffer: TransactionBuffer = round_trip_account(id, data);
            let expected = TransactionBuffer::size(buffer.final_buffer_size).expect("buffer size");
            assert_eq!(
                len, expected,
                "{id}: size differs from TransactionBuffer::size"
            );
        }
        "Batch" => {
            let _: Batch = round_trip_account(id, data);
            assert_eq!(
                len,
                8 + Batch::INIT_SPACE,
                "{id}: size differs from Batch::INIT_SPACE"
            );
        }
        "ProgramConfig" => {
            let _: ProgramConfig = round_trip_account(id, data);
            assert_eq!(
                len,
                8 + ProgramConfig::INIT_SPACE,
                "{id}: size differs from ProgramConfig::INIT_SPACE"
            );
        }
        other => panic!("{id}: unknown account type {other}"),
    }
}

/// Decodes instruction data as `T` (all bytes must be consumed) and encodes it
/// again with the discriminator.
fn round_trip_ix<T: AnchorDeserialize + InstructionData + Discriminator>(
    id: &str,
    data: &[u8],
) -> T {
    assert_eq!(&data[..8], T::DISCRIMINATOR, "{id}: discriminator differs");
    let decoded =
        T::try_from_slice(&data[8..]).unwrap_or_else(|e| panic!("{id}: decode failed: {e}"));
    assert_eq!(
        decoded.data(),
        data,
        "{id}: re-encoded instruction data differs"
    );
    decoded
}

/// Vault and batch transaction messages are opaque bytes in the instruction args;
/// they must also round-trip as `TransactionMessage`.
fn round_trip_message(id: &str, bytes: &[u8]) {
    let message = TransactionMessage::try_from_slice(bytes)
        .unwrap_or_else(|e| panic!("{id}: message decode failed: {e}"));
    assert_eq!(
        borsh::to_vec(&message).expect("encode message"),
        bytes,
        "{id}: message bytes differ"
    );
}

macro_rules! check_instruction {
    ($name:expr, $id:expr, $data:expr; $($ix:literal => $ty:ty $(, |$v:ident| $extra:expr)?;)*) => {
        match $name {
            $($ix => { let _decoded: $ty = round_trip_ix($id, $data); $(let $v = _decoded; $extra;)? })*
            other => panic!("{}: unknown instruction {other}", $id),
        }
    };
}

fn check_ix(name: &str, id: &str, data: &[u8]) {
    check_instruction!(name, id, data;
        "program_config_init" => instruction::ProgramConfigInit;
        "program_config_set_authority" => instruction::ProgramConfigSetAuthority;
        "program_config_set_multisig_creation_fee" => instruction::ProgramConfigSetMultisigCreationFee;
        "program_config_set_treasury" => instruction::ProgramConfigSetTreasury;
        "multisig_create" => instruction::MultisigCreate;
        "multisig_create_v2" => instruction::MultisigCreateV2;
        "multisig_add_member" => instruction::MultisigAddMember;
        "multisig_remove_member" => instruction::MultisigRemoveMember;
        "multisig_set_time_lock" => instruction::MultisigSetTimeLock;
        "multisig_change_threshold" => instruction::MultisigChangeThreshold;
        "multisig_set_config_authority" => instruction::MultisigSetConfigAuthority;
        "multisig_set_rent_collector" => instruction::MultisigSetRentCollector;
        "multisig_add_spending_limit" => instruction::MultisigAddSpendingLimit;
        "multisig_remove_spending_limit" => instruction::MultisigRemoveSpendingLimit;
        "config_transaction_create" => instruction::ConfigTransactionCreate;
        "config_transaction_execute" => instruction::ConfigTransactionExecute;
        "vault_transaction_create" => instruction::VaultTransactionCreate,
            |ix| round_trip_message(id, &ix.args.transaction_message);
        "transaction_buffer_create" => instruction::TransactionBufferCreate;
        "transaction_buffer_close" => instruction::TransactionBufferClose;
        "transaction_buffer_extend" => instruction::TransactionBufferExtend;
        "vault_transaction_create_from_buffer" => instruction::VaultTransactionCreateFromBuffer;
        "vault_transaction_execute" => instruction::VaultTransactionExecute;
        "batch_create" => instruction::BatchCreate;
        "batch_add_transaction" => instruction::BatchAddTransaction,
            |ix| round_trip_message(id, &ix.args.transaction_message);
        "batch_execute_transaction" => instruction::BatchExecuteTransaction;
        "proposal_create" => instruction::ProposalCreate;
        "proposal_activate" => instruction::ProposalActivate;
        "proposal_approve" => instruction::ProposalApprove;
        "proposal_reject" => instruction::ProposalReject;
        "proposal_cancel" => instruction::ProposalCancel;
        "proposal_cancel_v2" => instruction::ProposalCancelV2;
        "spending_limit_use" => instruction::SpendingLimitUse;
        "config_transaction_accounts_close" => instruction::ConfigTransactionAccountsClose;
        "vault_transaction_accounts_close" => instruction::VaultTransactionAccountsClose;
        "vault_batch_transaction_account_close" => instruction::VaultBatchTransactionAccountClose;
        "batch_accounts_close" => instruction::BatchAccountsClose;
    );
}

#[test]
fn mainnet_accounts_round_trip_byte_for_byte() {
    // Arrange
    let accounts: Vec<_> = fixtures(ACCOUNTS).collect();
    assert!(!accounts.is_empty(), "no account fixtures");

    // Act + Assert
    accounts
        .iter()
        .for_each(|(kind, address, data)| check_account(kind, address, data));
}

#[test]
fn mainnet_account_fixtures_cover_every_account_type() {
    // Arrange
    let expected = [
        Multisig::DISCRIMINATOR,
        Proposal::DISCRIMINATOR,
        VaultTransaction::DISCRIMINATOR,
        VaultBatchTransaction::DISCRIMINATOR,
        ConfigTransaction::DISCRIMINATOR,
        SpendingLimit::DISCRIMINATOR,
        TransactionBuffer::DISCRIMINATOR,
        Batch::DISCRIMINATOR,
        ProgramConfig::DISCRIMINATOR,
    ];

    // Act
    let present: Vec<Vec<u8>> = fixtures(ACCOUNTS)
        .map(|(_, _, data)| data[..8].to_vec())
        .collect();

    // Assert
    expected.iter().for_each(|disc| {
        assert!(
            present.iter().any(|p| p == disc),
            "missing fixture for discriminator {disc:?}"
        )
    });
}

#[test]
fn mainnet_instruction_data_round_trips_byte_for_byte() {
    // Arrange
    let instructions: Vec<_> = fixtures(INSTRUCTIONS).collect();
    assert!(!instructions.is_empty(), "no instruction fixtures");

    // Act + Assert
    instructions
        .iter()
        .for_each(|(name, signature, data)| check_ix(name, signature, data));
}

#[test]
fn instruction_fixtures_cover_every_live_instruction() {
    // Arrange: `multisig_create` (v1) was deprecated before the freeze and takes no args.
    let live = [
        "program_config_init",
        "program_config_set_authority",
        "program_config_set_multisig_creation_fee",
        "program_config_set_treasury",
        "multisig_create_v2",
        "multisig_add_member",
        "multisig_remove_member",
        "multisig_set_time_lock",
        "multisig_change_threshold",
        "multisig_set_config_authority",
        "multisig_set_rent_collector",
        "multisig_add_spending_limit",
        "multisig_remove_spending_limit",
        "config_transaction_create",
        "config_transaction_execute",
        "vault_transaction_create",
        "transaction_buffer_create",
        "transaction_buffer_close",
        "transaction_buffer_extend",
        "vault_transaction_create_from_buffer",
        "vault_transaction_execute",
        "batch_create",
        "batch_add_transaction",
        "batch_execute_transaction",
        "proposal_create",
        "proposal_activate",
        "proposal_approve",
        "proposal_reject",
        "proposal_cancel",
        "proposal_cancel_v2",
        "spending_limit_use",
        "config_transaction_accounts_close",
        "vault_transaction_accounts_close",
        "vault_batch_transaction_account_close",
        "batch_accounts_close",
    ];

    // Act
    let present: Vec<&str> = fixtures(INSTRUCTIONS).map(|(name, _, _)| name).collect();

    // Assert
    live.iter().for_each(|name| {
        assert!(
            present.contains(name),
            "missing instruction fixture for {name}"
        )
    });
}

#[test]
fn program_id_is_not_the_frozen_v4_program() {
    assert_ne!(
        program::ID.to_string(),
        "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf"
    );
}
