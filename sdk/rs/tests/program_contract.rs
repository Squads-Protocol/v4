//! The Codama client must match the Anchor program: identical discriminators, and the
//! mainnet golden fixtures must decode with the generated types and encode to the same bytes.

use anchor_lang::Discriminator;
use squads_multisig_4r::accounts as client;
use squads_multisig_4r::instructions::*;
use squads_multisig_4r_program::anchor_lang;
use squads_multisig_4r_program::instruction as program_ix;
use squads_multisig_4r_program::state as program;

const ACCOUNTS: &str =
    include_str!("../../../programs/squads_multisig_program/tests/fixtures/golden/accounts.txt");
const INSTRUCTIONS: &str = include_str!(
    "../../../programs/squads_multisig_program/tests/fixtures/golden/instructions.txt"
);

fn fixtures(text: &'static str) -> impl Iterator<Item = (&'static str, &'static str, Vec<u8>)> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !line.starts_with('#'))
        .map(|line| {
            let mut parts = line.split_whitespace();
            let label = parts.next().expect("label");
            let id = parts.next().expect("identifier");
            let hex = parts.next().expect("hex data");
            let bytes = (0..hex.len())
                .step_by(2)
                .map(|i| u8::from_str_radix(&hex[i..i + 2], 16).expect("hex"))
                .collect();
            (label, id, bytes)
        })
}

macro_rules! account_contract {
    ($kind:expr, $id:expr, $data:expr; $($name:literal => $client:ty, $disc:expr, $program:ty;)*) => {{
        let mut matched = false;
        $(if $kind == $name {
            matched = true;
            assert_eq!($disc[..], <$program>::DISCRIMINATOR[..], "{}: account discriminator differs", $name);
            let decoded = <$client>::from_bytes($data).unwrap_or_else(|e| panic!("{}: decode failed: {e}", $id));
            let encoded = borsh::to_vec(&decoded).expect("encode");
            assert_eq!(encoded, $data[..encoded.len()], "{}: generated type re-encodes differently", $id);
        })*
        assert!(matched, "{}: unknown account type {}", $id, $kind);
    }};
}

fn check_account(kind: &str, id: &str, data: &[u8]) {
    account_contract!(kind, id, data;
        "Batch" => client::Batch, client::BATCH_DISCRIMINATOR, program::Batch;
        "ConfigTransaction" => client::ConfigTransaction, client::CONFIG_TRANSACTION_DISCRIMINATOR, program::ConfigTransaction;
        "Multisig" => client::Multisig, client::MULTISIG_DISCRIMINATOR, program::Multisig;
        "ProgramConfig" => client::ProgramConfig, client::PROGRAM_CONFIG_DISCRIMINATOR, program::ProgramConfig;
        "Proposal" => client::Proposal, client::PROPOSAL_DISCRIMINATOR, program::Proposal;
        "SpendingLimit" => client::SpendingLimit, client::SPENDING_LIMIT_DISCRIMINATOR, program::SpendingLimit;
        "TransactionBuffer" => client::TransactionBuffer, client::TRANSACTION_BUFFER_DISCRIMINATOR, program::TransactionBuffer;
        "VaultBatchTransaction" => client::VaultBatchTransaction, client::VAULT_BATCH_TRANSACTION_DISCRIMINATOR, program::VaultBatchTransaction;
        "VaultTransaction" => client::VaultTransaction, client::VAULT_TRANSACTION_DISCRIMINATOR, program::VaultTransaction;
    );
}

// Rows: `name => client discriminator, program instruction type [, client args type]`.
macro_rules! instruction_table {
    ($($name:literal => $disc:ident, $program:ty $(, $args:ty)?;)*) => {
        fn check_ix_discriminators() {
            $(assert_eq!($disc[..], <$program>::DISCRIMINATOR[..], "{}: instruction discriminator differs", $name);)*
        }

        fn check_ix(name: &str, id: &str, data: &[u8]) {
            $(if name == $name {
                assert_eq!(data[..8], $disc[..], "{id}: discriminator differs");
                let args = &data[8..];
                instruction_table!(@args id, args $(, $args)?);
                return;
            })*
            panic!("{id}: unknown instruction {name}");
        }
    };
    (@args $id:ident, $bytes:ident, $args:ty) => {{
        let decoded: $args = borsh::from_slice($bytes).unwrap_or_else(|e| panic!("{}: args decode failed: {e}", $id));
        assert_eq!(borsh::to_vec(&decoded).expect("encode"), $bytes, "{}: generated args re-encode differently", $id);
    }};
    (@args $id:ident, $bytes:ident) => {
        assert!($bytes.is_empty(), "{}: instruction without args carries data", $id);
    };
}

instruction_table! {
    "batch_accounts_close" => BATCH_ACCOUNTS_CLOSE_DISCRIMINATOR, program_ix::BatchAccountsClose;
    "batch_add_transaction" => BATCH_ADD_TRANSACTION_DISCRIMINATOR, program_ix::BatchAddTransaction, BatchAddTransactionInstructionArgs;
    "batch_create" => BATCH_CREATE_DISCRIMINATOR, program_ix::BatchCreate, BatchCreateInstructionArgs;
    "batch_execute_transaction" => BATCH_EXECUTE_TRANSACTION_DISCRIMINATOR, program_ix::BatchExecuteTransaction;
    "config_transaction_accounts_close" => CONFIG_TRANSACTION_ACCOUNTS_CLOSE_DISCRIMINATOR, program_ix::ConfigTransactionAccountsClose;
    "config_transaction_create" => CONFIG_TRANSACTION_CREATE_DISCRIMINATOR, program_ix::ConfigTransactionCreate, ConfigTransactionCreateInstructionArgs;
    "config_transaction_execute" => CONFIG_TRANSACTION_EXECUTE_DISCRIMINATOR, program_ix::ConfigTransactionExecute;
    "multisig_add_member" => MULTISIG_ADD_MEMBER_DISCRIMINATOR, program_ix::MultisigAddMember, MultisigAddMemberInstructionArgs;
    "multisig_add_spending_limit" => MULTISIG_ADD_SPENDING_LIMIT_DISCRIMINATOR, program_ix::MultisigAddSpendingLimit, MultisigAddSpendingLimitInstructionArgs;
    "multisig_change_threshold" => MULTISIG_CHANGE_THRESHOLD_DISCRIMINATOR, program_ix::MultisigChangeThreshold, MultisigChangeThresholdInstructionArgs;
    "multisig_create" => MULTISIG_CREATE_DISCRIMINATOR, program_ix::MultisigCreate;
    "multisig_create_v2" => MULTISIG_CREATE_V2_DISCRIMINATOR, program_ix::MultisigCreateV2, MultisigCreateV2InstructionArgs;
    "multisig_remove_member" => MULTISIG_REMOVE_MEMBER_DISCRIMINATOR, program_ix::MultisigRemoveMember, MultisigRemoveMemberInstructionArgs;
    "multisig_remove_spending_limit" => MULTISIG_REMOVE_SPENDING_LIMIT_DISCRIMINATOR, program_ix::MultisigRemoveSpendingLimit, MultisigRemoveSpendingLimitInstructionArgs;
    "multisig_set_config_authority" => MULTISIG_SET_CONFIG_AUTHORITY_DISCRIMINATOR, program_ix::MultisigSetConfigAuthority, MultisigSetConfigAuthorityInstructionArgs;
    "multisig_set_rent_collector" => MULTISIG_SET_RENT_COLLECTOR_DISCRIMINATOR, program_ix::MultisigSetRentCollector, MultisigSetRentCollectorInstructionArgs;
    "multisig_set_time_lock" => MULTISIG_SET_TIME_LOCK_DISCRIMINATOR, program_ix::MultisigSetTimeLock, MultisigSetTimeLockInstructionArgs;
    "program_config_init" => PROGRAM_CONFIG_INIT_DISCRIMINATOR, program_ix::ProgramConfigInit, ProgramConfigInitInstructionArgs;
    "program_config_set_authority" => PROGRAM_CONFIG_SET_AUTHORITY_DISCRIMINATOR, program_ix::ProgramConfigSetAuthority, ProgramConfigSetAuthorityInstructionArgs;
    "program_config_set_multisig_creation_fee" => PROGRAM_CONFIG_SET_MULTISIG_CREATION_FEE_DISCRIMINATOR, program_ix::ProgramConfigSetMultisigCreationFee, ProgramConfigSetMultisigCreationFeeInstructionArgs;
    "program_config_set_treasury" => PROGRAM_CONFIG_SET_TREASURY_DISCRIMINATOR, program_ix::ProgramConfigSetTreasury, ProgramConfigSetTreasuryInstructionArgs;
    "proposal_activate" => PROPOSAL_ACTIVATE_DISCRIMINATOR, program_ix::ProposalActivate;
    "proposal_approve" => PROPOSAL_APPROVE_DISCRIMINATOR, program_ix::ProposalApprove, ProposalApproveInstructionArgs;
    "proposal_cancel" => PROPOSAL_CANCEL_DISCRIMINATOR, program_ix::ProposalCancel, ProposalCancelInstructionArgs;
    "proposal_cancel_v2" => PROPOSAL_CANCEL_V2_DISCRIMINATOR, program_ix::ProposalCancelV2, ProposalCancelV2InstructionArgs;
    "proposal_create" => PROPOSAL_CREATE_DISCRIMINATOR, program_ix::ProposalCreate, ProposalCreateInstructionArgs;
    "proposal_reject" => PROPOSAL_REJECT_DISCRIMINATOR, program_ix::ProposalReject, ProposalRejectInstructionArgs;
    "spending_limit_use" => SPENDING_LIMIT_USE_DISCRIMINATOR, program_ix::SpendingLimitUse, SpendingLimitUseInstructionArgs;
    "transaction_buffer_close" => TRANSACTION_BUFFER_CLOSE_DISCRIMINATOR, program_ix::TransactionBufferClose;
    "transaction_buffer_create" => TRANSACTION_BUFFER_CREATE_DISCRIMINATOR, program_ix::TransactionBufferCreate, TransactionBufferCreateInstructionArgs;
    "transaction_buffer_extend" => TRANSACTION_BUFFER_EXTEND_DISCRIMINATOR, program_ix::TransactionBufferExtend, TransactionBufferExtendInstructionArgs;
    "vault_batch_transaction_account_close" => VAULT_BATCH_TRANSACTION_ACCOUNT_CLOSE_DISCRIMINATOR, program_ix::VaultBatchTransactionAccountClose;
    "vault_transaction_accounts_close" => VAULT_TRANSACTION_ACCOUNTS_CLOSE_DISCRIMINATOR, program_ix::VaultTransactionAccountsClose;
    "vault_transaction_create" => VAULT_TRANSACTION_CREATE_DISCRIMINATOR, program_ix::VaultTransactionCreate, VaultTransactionCreateInstructionArgs;
    "vault_transaction_create_from_buffer" => VAULT_TRANSACTION_CREATE_FROM_BUFFER_DISCRIMINATOR, program_ix::VaultTransactionCreateFromBuffer, VaultTransactionCreateFromBufferInstructionArgs;
    "vault_transaction_execute" => VAULT_TRANSACTION_EXECUTE_DISCRIMINATOR, program_ix::VaultTransactionExecute;
}

#[test]
fn generated_instruction_discriminators_match_the_program() {
    check_ix_discriminators();
}

#[test]
fn generated_account_types_round_trip_mainnet_accounts() {
    // Arrange
    let accounts: Vec<_> = fixtures(ACCOUNTS).collect();
    assert!(!accounts.is_empty(), "no account fixtures");

    // Act + Assert
    accounts
        .iter()
        .for_each(|(kind, address, data)| check_account(kind, address, data));
}

#[test]
fn generated_instruction_args_round_trip_mainnet_instruction_data() {
    // Arrange
    let instructions: Vec<_> = fixtures(INSTRUCTIONS).collect();
    assert!(!instructions.is_empty(), "no instruction fixtures");

    // Act + Assert
    instructions
        .iter()
        .for_each(|(name, signature, data)| check_ix(name, signature, data));
}

#[test]
fn generated_program_id_matches_the_program() {
    assert_eq!(
        squads_multisig_4r::ID.to_bytes(),
        squads_multisig_4r_program::ID.to_bytes()
    );
}
