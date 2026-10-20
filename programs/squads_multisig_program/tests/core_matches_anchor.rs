//! The core builders and constants must match what Anchor derives for the program:
//! account metas from `accounts::X::to_account_metas`, data from `instruction::X::data`,
//! sizes from `Space::INIT_SPACE` and discriminators from `Discriminator`.

mod common;

use anchor_lang::{Discriminator, InstructionData, Space, ToAccountMetas};
use borsh::BorshDeserialize;
use common::instruction_data;
use solana_address::Address;
use solana_instruction::Instruction;
use squads_multisig_4r_program::account::ProgramAccount;
use squads_multisig_4r_program::instructions::*;
use squads_multisig_4r_program::state::{
    Batch, ConfigTransaction, Member, Multisig, ProgramConfig, Proposal, SpendingLimit,
    TransactionBuffer, VaultBatchTransaction, VaultTransaction,
};
use squads_multisig_4r_program::{self as program, anchor_lang, builders};

fn unique() -> Address {
    Address::new_unique()
}

macro_rules! cross {
    ($name:literal, args $args:ty, $builder:expr, $anchor:expr, $ix:ident) => {
        for data in instruction_data($name) {
            let args = || <$args>::deserialize(&mut &data[8..]).expect("fixture args decode");
            let builder = $builder;
            let core = builder.instruction(args(), None).expect("builder");
            let anchor = Instruction {
                program_id: program::ID,
                accounts: ($anchor)(&builder).to_account_metas(None),
                data: program::instruction::$ix { args: args() }.data(),
            };
            assert_eq!(core, anchor, "{}", $name);
        }
    };
    ($name:literal, no_args, $builder:expr, $anchor:expr, $ix:ident) => {{
        let builder = $builder;
        let anchor = Instruction {
            program_id: program::ID,
            accounts: ($anchor)(&builder).to_account_metas(None),
            data: program::instruction::$ix {}.data(),
        };
        assert_eq!(builder.instruction(None), anchor, "{}", $name);
    }};
}

#[test]
fn builders_match_anchor_account_metas_and_instruction_data() {
    cross!(
        "batch_accounts_close",
        no_args,
        builders::BatchAccountsClose {
            multisig: unique(),
            proposal: unique(),
            batch: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        |b: &builders::BatchAccountsClose| program::accounts::BatchAccountsClose {
            multisig: b.multisig,
            proposal: b.proposal,
            batch: b.batch,
            rent_collector: b.rent_collector,
            system_program: b.system_program
        },
        BatchAccountsClose
    );
    cross!(
        "batch_accounts_close",
        no_args,
        builders::BatchAccountsClose {
            multisig: unique(),
            proposal: unique(),
            batch: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        |b: &builders::BatchAccountsClose| program::accounts::BatchAccountsClose {
            multisig: b.multisig,
            proposal: b.proposal,
            batch: b.batch,
            rent_collector: b.rent_collector,
            system_program: b.system_program
        },
        BatchAccountsClose
    );
    cross!("batch_add_transaction", args BatchAddTransactionArgs, builders::BatchAddTransaction { multisig: unique(), proposal: unique(), batch: unique(), transaction: unique(), member: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::BatchAddTransaction| program::accounts::BatchAddTransaction { multisig: b.multisig, proposal: b.proposal, batch: b.batch, transaction: b.transaction, member: b.member, rent_payer: b.rent_payer, system_program: b.system_program }, BatchAddTransaction);
    cross!("batch_add_transaction", args BatchAddTransactionArgs, builders::BatchAddTransaction { multisig: unique(), proposal: unique(), batch: unique(), transaction: unique(), member: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::BatchAddTransaction| program::accounts::BatchAddTransaction { multisig: b.multisig, proposal: b.proposal, batch: b.batch, transaction: b.transaction, member: b.member, rent_payer: b.rent_payer, system_program: b.system_program }, BatchAddTransaction);
    cross!("batch_create", args BatchCreateArgs, builders::BatchCreate { multisig: unique(), batch: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::BatchCreate| program::accounts::BatchCreate { multisig: b.multisig, batch: b.batch, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, BatchCreate);
    cross!("batch_create", args BatchCreateArgs, builders::BatchCreate { multisig: unique(), batch: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::BatchCreate| program::accounts::BatchCreate { multisig: b.multisig, batch: b.batch, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, BatchCreate);
    cross!(
        "batch_execute_transaction",
        no_args,
        builders::BatchExecuteTransaction {
            multisig: unique(),
            member: unique(),
            proposal: unique(),
            batch: unique(),
            transaction: unique()
        },
        |b: &builders::BatchExecuteTransaction| program::accounts::BatchExecuteTransaction {
            multisig: b.multisig,
            member: b.member,
            proposal: b.proposal,
            batch: b.batch,
            transaction: b.transaction
        },
        BatchExecuteTransaction
    );
    cross!(
        "batch_execute_transaction",
        no_args,
        builders::BatchExecuteTransaction {
            multisig: unique(),
            member: unique(),
            proposal: unique(),
            batch: unique(),
            transaction: unique()
        },
        |b: &builders::BatchExecuteTransaction| program::accounts::BatchExecuteTransaction {
            multisig: b.multisig,
            member: b.member,
            proposal: b.proposal,
            batch: b.batch,
            transaction: b.transaction
        },
        BatchExecuteTransaction
    );
    cross!(
        "config_transaction_accounts_close",
        no_args,
        builders::ConfigTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        |b: &builders::ConfigTransactionAccountsClose| {
            program::accounts::ConfigTransactionAccountsClose {
                multisig: b.multisig,
                proposal: b.proposal,
                transaction: b.transaction,
                rent_collector: b.rent_collector,
                system_program: b.system_program,
            }
        },
        ConfigTransactionAccountsClose
    );
    cross!(
        "config_transaction_accounts_close",
        no_args,
        builders::ConfigTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        |b: &builders::ConfigTransactionAccountsClose| {
            program::accounts::ConfigTransactionAccountsClose {
                multisig: b.multisig,
                proposal: b.proposal,
                transaction: b.transaction,
                rent_collector: b.rent_collector,
                system_program: b.system_program,
            }
        },
        ConfigTransactionAccountsClose
    );
    cross!("config_transaction_create", args ConfigTransactionCreateArgs, builders::ConfigTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::ConfigTransactionCreate| program::accounts::ConfigTransactionCreate { multisig: b.multisig, transaction: b.transaction, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, ConfigTransactionCreate);
    cross!("config_transaction_create", args ConfigTransactionCreateArgs, builders::ConfigTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::ConfigTransactionCreate| program::accounts::ConfigTransactionCreate { multisig: b.multisig, transaction: b.transaction, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, ConfigTransactionCreate);
    cross!(
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
        |b: &builders::ConfigTransactionExecute| program::accounts::ConfigTransactionExecute {
            multisig: b.multisig,
            member: b.member,
            proposal: b.proposal,
            transaction: b.transaction,
            rent_payer: b.rent_payer,
            system_program: b.system_program
        },
        ConfigTransactionExecute
    );
    cross!(
        "config_transaction_execute",
        no_args,
        builders::ConfigTransactionExecute {
            multisig: unique(),
            member: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_payer: None,
            system_program: None
        },
        |b: &builders::ConfigTransactionExecute| program::accounts::ConfigTransactionExecute {
            multisig: b.multisig,
            member: b.member,
            proposal: b.proposal,
            transaction: b.transaction,
            rent_payer: b.rent_payer,
            system_program: b.system_program
        },
        ConfigTransactionExecute
    );
    cross!("multisig_add_member", args MultisigAddMemberArgs, builders::MultisigAddMember { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, |b: &builders::MultisigAddMember| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigAddMember);
    cross!("multisig_add_member", args MultisigAddMemberArgs, builders::MultisigAddMember { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None }, |b: &builders::MultisigAddMember| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigAddMember);
    cross!("multisig_add_spending_limit", args MultisigAddSpendingLimitArgs, builders::MultisigAddSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::MultisigAddSpendingLimit| program::accounts::MultisigAddSpendingLimit { multisig: b.multisig, config_authority: b.config_authority, spending_limit: b.spending_limit, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigAddSpendingLimit);
    cross!("multisig_add_spending_limit", args MultisigAddSpendingLimitArgs, builders::MultisigAddSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::MultisigAddSpendingLimit| program::accounts::MultisigAddSpendingLimit { multisig: b.multisig, config_authority: b.config_authority, spending_limit: b.spending_limit, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigAddSpendingLimit);
    cross!("multisig_change_threshold", args MultisigChangeThresholdArgs, builders::MultisigChangeThreshold { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, |b: &builders::MultisigChangeThreshold| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigChangeThreshold);
    cross!("multisig_change_threshold", args MultisigChangeThresholdArgs, builders::MultisigChangeThreshold { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None }, |b: &builders::MultisigChangeThreshold| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigChangeThreshold);
    cross!("multisig_create_v2", args MultisigCreateArgsV2, builders::MultisigCreateV2 { program_config: unique(), treasury: unique(), multisig: unique(), create_key: unique(), creator: unique(), system_program: unique() }, |b: &builders::MultisigCreateV2| program::accounts::MultisigCreateV2 { program_config: b.program_config, treasury: b.treasury, multisig: b.multisig, create_key: b.create_key, creator: b.creator, system_program: b.system_program }, MultisigCreateV2);
    cross!("multisig_create_v2", args MultisigCreateArgsV2, builders::MultisigCreateV2 { program_config: unique(), treasury: unique(), multisig: unique(), create_key: unique(), creator: unique(), system_program: unique() }, |b: &builders::MultisigCreateV2| program::accounts::MultisigCreateV2 { program_config: b.program_config, treasury: b.treasury, multisig: b.multisig, create_key: b.create_key, creator: b.creator, system_program: b.system_program }, MultisigCreateV2);
    cross!("multisig_remove_member", args MultisigRemoveMemberArgs, builders::MultisigRemoveMember { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, |b: &builders::MultisigRemoveMember| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigRemoveMember);
    cross!("multisig_remove_member", args MultisigRemoveMemberArgs, builders::MultisigRemoveMember { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None }, |b: &builders::MultisigRemoveMember| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigRemoveMember);
    cross!("multisig_remove_spending_limit", args MultisigRemoveSpendingLimitArgs, builders::MultisigRemoveSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_collector: unique() }, |b: &builders::MultisigRemoveSpendingLimit| program::accounts::MultisigRemoveSpendingLimit { multisig: b.multisig, config_authority: b.config_authority, spending_limit: b.spending_limit, rent_collector: b.rent_collector }, MultisigRemoveSpendingLimit);
    cross!("multisig_remove_spending_limit", args MultisigRemoveSpendingLimitArgs, builders::MultisigRemoveSpendingLimit { multisig: unique(), config_authority: unique(), spending_limit: unique(), rent_collector: unique() }, |b: &builders::MultisigRemoveSpendingLimit| program::accounts::MultisigRemoveSpendingLimit { multisig: b.multisig, config_authority: b.config_authority, spending_limit: b.spending_limit, rent_collector: b.rent_collector }, MultisigRemoveSpendingLimit);
    cross!("multisig_set_config_authority", args MultisigSetConfigAuthorityArgs, builders::MultisigSetConfigAuthority { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, |b: &builders::MultisigSetConfigAuthority| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigSetConfigAuthority);
    cross!("multisig_set_config_authority", args MultisigSetConfigAuthorityArgs, builders::MultisigSetConfigAuthority { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None }, |b: &builders::MultisigSetConfigAuthority| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigSetConfigAuthority);
    cross!("multisig_set_rent_collector", args MultisigSetRentCollectorArgs, builders::MultisigSetRentCollector { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, |b: &builders::MultisigSetRentCollector| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigSetRentCollector);
    cross!("multisig_set_rent_collector", args MultisigSetRentCollectorArgs, builders::MultisigSetRentCollector { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None }, |b: &builders::MultisigSetRentCollector| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigSetRentCollector);
    cross!("multisig_set_time_lock", args MultisigSetTimeLockArgs, builders::MultisigSetTimeLock { multisig: unique(), config_authority: unique(), rent_payer: Some(unique()), system_program: Some(unique()) }, |b: &builders::MultisigSetTimeLock| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigSetTimeLock);
    cross!("multisig_set_time_lock", args MultisigSetTimeLockArgs, builders::MultisigSetTimeLock { multisig: unique(), config_authority: unique(), rent_payer: None, system_program: None }, |b: &builders::MultisigSetTimeLock| program::accounts::MultisigConfig { multisig: b.multisig, config_authority: b.config_authority, rent_payer: b.rent_payer, system_program: b.system_program }, MultisigSetTimeLock);
    cross!("program_config_init", args ProgramConfigInitArgs, builders::ProgramConfigInit { program_config: unique(), initializer: unique(), system_program: unique() }, |b: &builders::ProgramConfigInit| program::accounts::ProgramConfigInit { program_config: b.program_config, initializer: b.initializer, system_program: b.system_program }, ProgramConfigInit);
    cross!("program_config_init", args ProgramConfigInitArgs, builders::ProgramConfigInit { program_config: unique(), initializer: unique(), system_program: unique() }, |b: &builders::ProgramConfigInit| program::accounts::ProgramConfigInit { program_config: b.program_config, initializer: b.initializer, system_program: b.system_program }, ProgramConfigInit);
    cross!("program_config_set_authority", args ProgramConfigSetAuthorityArgs, builders::ProgramConfigSetAuthority { program_config: unique(), authority: unique() }, |b: &builders::ProgramConfigSetAuthority| program::accounts::ProgramConfig { program_config: b.program_config, authority: b.authority }, ProgramConfigSetAuthority);
    cross!("program_config_set_authority", args ProgramConfigSetAuthorityArgs, builders::ProgramConfigSetAuthority { program_config: unique(), authority: unique() }, |b: &builders::ProgramConfigSetAuthority| program::accounts::ProgramConfig { program_config: b.program_config, authority: b.authority }, ProgramConfigSetAuthority);
    cross!("program_config_set_multisig_creation_fee", args ProgramConfigSetMultisigCreationFeeArgs, builders::ProgramConfigSetMultisigCreationFee { program_config: unique(), authority: unique() }, |b: &builders::ProgramConfigSetMultisigCreationFee| program::accounts::ProgramConfig { program_config: b.program_config, authority: b.authority }, ProgramConfigSetMultisigCreationFee);
    cross!("program_config_set_multisig_creation_fee", args ProgramConfigSetMultisigCreationFeeArgs, builders::ProgramConfigSetMultisigCreationFee { program_config: unique(), authority: unique() }, |b: &builders::ProgramConfigSetMultisigCreationFee| program::accounts::ProgramConfig { program_config: b.program_config, authority: b.authority }, ProgramConfigSetMultisigCreationFee);
    cross!("program_config_set_treasury", args ProgramConfigSetTreasuryArgs, builders::ProgramConfigSetTreasury { program_config: unique(), authority: unique() }, |b: &builders::ProgramConfigSetTreasury| program::accounts::ProgramConfig { program_config: b.program_config, authority: b.authority }, ProgramConfigSetTreasury);
    cross!("program_config_set_treasury", args ProgramConfigSetTreasuryArgs, builders::ProgramConfigSetTreasury { program_config: unique(), authority: unique() }, |b: &builders::ProgramConfigSetTreasury| program::accounts::ProgramConfig { program_config: b.program_config, authority: b.authority }, ProgramConfigSetTreasury);
    cross!(
        "proposal_activate",
        no_args,
        builders::ProposalActivate {
            multisig: unique(),
            member: unique(),
            proposal: unique()
        },
        |b: &builders::ProposalActivate| program::accounts::ProposalActivate {
            multisig: b.multisig,
            member: b.member,
            proposal: b.proposal
        },
        ProposalActivate
    );
    cross!(
        "proposal_activate",
        no_args,
        builders::ProposalActivate {
            multisig: unique(),
            member: unique(),
            proposal: unique()
        },
        |b: &builders::ProposalActivate| program::accounts::ProposalActivate {
            multisig: b.multisig,
            member: b.member,
            proposal: b.proposal
        },
        ProposalActivate
    );
    cross!("proposal_approve", args ProposalVoteArgs, builders::ProposalApprove { multisig: unique(), member: unique(), proposal: unique() }, |b: &builders::ProposalApprove| program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, ProposalApprove);
    cross!("proposal_approve", args ProposalVoteArgs, builders::ProposalApprove { multisig: unique(), member: unique(), proposal: unique() }, |b: &builders::ProposalApprove| program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, ProposalApprove);
    cross!("proposal_cancel", args ProposalVoteArgs, builders::ProposalCancel { multisig: unique(), member: unique(), proposal: unique() }, |b: &builders::ProposalCancel| program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, ProposalCancel);
    cross!("proposal_cancel", args ProposalVoteArgs, builders::ProposalCancel { multisig: unique(), member: unique(), proposal: unique() }, |b: &builders::ProposalCancel| program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, ProposalCancel);
    cross!("proposal_cancel_v2", args ProposalVoteArgs, builders::ProposalCancelV2 { multisig: unique(), member: unique(), proposal: unique(), system_program: unique() }, |b: &builders::ProposalCancelV2| program::accounts::ProposalCancelV2 { proposal_vote: program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, system_program: b.system_program }, ProposalCancelV2);
    cross!("proposal_cancel_v2", args ProposalVoteArgs, builders::ProposalCancelV2 { multisig: unique(), member: unique(), proposal: unique(), system_program: unique() }, |b: &builders::ProposalCancelV2| program::accounts::ProposalCancelV2 { proposal_vote: program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, system_program: b.system_program }, ProposalCancelV2);
    cross!("proposal_create", args ProposalCreateArgs, builders::ProposalCreate { multisig: unique(), proposal: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::ProposalCreate| program::accounts::ProposalCreate { multisig: b.multisig, proposal: b.proposal, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, ProposalCreate);
    cross!("proposal_create", args ProposalCreateArgs, builders::ProposalCreate { multisig: unique(), proposal: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::ProposalCreate| program::accounts::ProposalCreate { multisig: b.multisig, proposal: b.proposal, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, ProposalCreate);
    cross!("proposal_reject", args ProposalVoteArgs, builders::ProposalReject { multisig: unique(), member: unique(), proposal: unique() }, |b: &builders::ProposalReject| program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, ProposalReject);
    cross!("proposal_reject", args ProposalVoteArgs, builders::ProposalReject { multisig: unique(), member: unique(), proposal: unique() }, |b: &builders::ProposalReject| program::accounts::ProposalVote { multisig: b.multisig, member: b.member, proposal: b.proposal }, ProposalReject);
    cross!("spending_limit_use", args SpendingLimitUseArgs, builders::SpendingLimitUse { multisig: unique(), member: unique(), spending_limit: unique(), vault: unique(), destination: unique(), system_program: Some(unique()), mint: Some(unique()), vault_token_account: Some(unique()), destination_token_account: Some(unique()), token_program: Some(unique()) }, |b: &builders::SpendingLimitUse| program::accounts::SpendingLimitUse { multisig: b.multisig, member: b.member, spending_limit: b.spending_limit, vault: b.vault, destination: b.destination, system_program: b.system_program, mint: b.mint, vault_token_account: b.vault_token_account, destination_token_account: b.destination_token_account, token_program: b.token_program }, SpendingLimitUse);
    cross!("spending_limit_use", args SpendingLimitUseArgs, builders::SpendingLimitUse { multisig: unique(), member: unique(), spending_limit: unique(), vault: unique(), destination: unique(), system_program: None, mint: None, vault_token_account: None, destination_token_account: None, token_program: None }, |b: &builders::SpendingLimitUse| program::accounts::SpendingLimitUse { multisig: b.multisig, member: b.member, spending_limit: b.spending_limit, vault: b.vault, destination: b.destination, system_program: b.system_program, mint: b.mint, vault_token_account: b.vault_token_account, destination_token_account: b.destination_token_account, token_program: b.token_program }, SpendingLimitUse);
    cross!(
        "transaction_buffer_close",
        no_args,
        builders::TransactionBufferClose {
            multisig: unique(),
            transaction_buffer: unique(),
            creator: unique()
        },
        |b: &builders::TransactionBufferClose| program::accounts::TransactionBufferClose {
            multisig: b.multisig,
            transaction_buffer: b.transaction_buffer,
            creator: b.creator
        },
        TransactionBufferClose
    );
    cross!(
        "transaction_buffer_close",
        no_args,
        builders::TransactionBufferClose {
            multisig: unique(),
            transaction_buffer: unique(),
            creator: unique()
        },
        |b: &builders::TransactionBufferClose| program::accounts::TransactionBufferClose {
            multisig: b.multisig,
            transaction_buffer: b.transaction_buffer,
            creator: b.creator
        },
        TransactionBufferClose
    );
    cross!("transaction_buffer_create", args TransactionBufferCreateArgs, builders::TransactionBufferCreate { multisig: unique(), transaction_buffer: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::TransactionBufferCreate| program::accounts::TransactionBufferCreate { multisig: b.multisig, transaction_buffer: b.transaction_buffer, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, TransactionBufferCreate);
    cross!("transaction_buffer_create", args TransactionBufferCreateArgs, builders::TransactionBufferCreate { multisig: unique(), transaction_buffer: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::TransactionBufferCreate| program::accounts::TransactionBufferCreate { multisig: b.multisig, transaction_buffer: b.transaction_buffer, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, TransactionBufferCreate);
    cross!("transaction_buffer_extend", args TransactionBufferExtendArgs, builders::TransactionBufferExtend { multisig: unique(), transaction_buffer: unique(), creator: unique() }, |b: &builders::TransactionBufferExtend| program::accounts::TransactionBufferExtend { multisig: b.multisig, transaction_buffer: b.transaction_buffer, creator: b.creator }, TransactionBufferExtend);
    cross!("transaction_buffer_extend", args TransactionBufferExtendArgs, builders::TransactionBufferExtend { multisig: unique(), transaction_buffer: unique(), creator: unique() }, |b: &builders::TransactionBufferExtend| program::accounts::TransactionBufferExtend { multisig: b.multisig, transaction_buffer: b.transaction_buffer, creator: b.creator }, TransactionBufferExtend);
    cross!(
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
        |b: &builders::VaultBatchTransactionAccountClose| {
            program::accounts::VaultBatchTransactionAccountClose {
                multisig: b.multisig,
                proposal: b.proposal,
                batch: b.batch,
                transaction: b.transaction,
                rent_collector: b.rent_collector,
                system_program: b.system_program,
            }
        },
        VaultBatchTransactionAccountClose
    );
    cross!(
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
        |b: &builders::VaultBatchTransactionAccountClose| {
            program::accounts::VaultBatchTransactionAccountClose {
                multisig: b.multisig,
                proposal: b.proposal,
                batch: b.batch,
                transaction: b.transaction,
                rent_collector: b.rent_collector,
                system_program: b.system_program,
            }
        },
        VaultBatchTransactionAccountClose
    );
    cross!(
        "vault_transaction_accounts_close",
        no_args,
        builders::VaultTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        |b: &builders::VaultTransactionAccountsClose| {
            program::accounts::VaultTransactionAccountsClose {
                multisig: b.multisig,
                proposal: b.proposal,
                transaction: b.transaction,
                rent_collector: b.rent_collector,
                system_program: b.system_program,
            }
        },
        VaultTransactionAccountsClose
    );
    cross!(
        "vault_transaction_accounts_close",
        no_args,
        builders::VaultTransactionAccountsClose {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            rent_collector: unique(),
            system_program: unique()
        },
        |b: &builders::VaultTransactionAccountsClose| {
            program::accounts::VaultTransactionAccountsClose {
                multisig: b.multisig,
                proposal: b.proposal,
                transaction: b.transaction,
                rent_collector: b.rent_collector,
                system_program: b.system_program,
            }
        },
        VaultTransactionAccountsClose
    );
    cross!("vault_transaction_create", args VaultTransactionCreateArgs, builders::VaultTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::VaultTransactionCreate| program::accounts::VaultTransactionCreate { multisig: b.multisig, transaction: b.transaction, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, VaultTransactionCreate);
    cross!("vault_transaction_create", args VaultTransactionCreateArgs, builders::VaultTransactionCreate { multisig: unique(), transaction: unique(), creator: unique(), rent_payer: unique(), system_program: unique() }, |b: &builders::VaultTransactionCreate| program::accounts::VaultTransactionCreate { multisig: b.multisig, transaction: b.transaction, creator: b.creator, rent_payer: b.rent_payer, system_program: b.system_program }, VaultTransactionCreate);
    cross!("vault_transaction_create_from_buffer", args VaultTransactionCreateArgs, builders::VaultTransactionCreateFromBuffer { vault_transaction_create_multisig: unique(), vault_transaction_create_transaction: unique(), vault_transaction_create_creator: unique(), vault_transaction_create_rent_payer: unique(), vault_transaction_create_system_program: unique(), transaction_buffer: unique(), creator: unique() }, |b: &builders::VaultTransactionCreateFromBuffer| program::accounts::VaultTransactionCreateFromBuffer { vault_transaction_create: program::accounts::VaultTransactionCreate { multisig: b.vault_transaction_create_multisig, transaction: b.vault_transaction_create_transaction, creator: b.vault_transaction_create_creator, rent_payer: b.vault_transaction_create_rent_payer, system_program: b.vault_transaction_create_system_program }, transaction_buffer: b.transaction_buffer, creator: b.creator }, VaultTransactionCreateFromBuffer);
    cross!("vault_transaction_create_from_buffer", args VaultTransactionCreateArgs, builders::VaultTransactionCreateFromBuffer { vault_transaction_create_multisig: unique(), vault_transaction_create_transaction: unique(), vault_transaction_create_creator: unique(), vault_transaction_create_rent_payer: unique(), vault_transaction_create_system_program: unique(), transaction_buffer: unique(), creator: unique() }, |b: &builders::VaultTransactionCreateFromBuffer| program::accounts::VaultTransactionCreateFromBuffer { vault_transaction_create: program::accounts::VaultTransactionCreate { multisig: b.vault_transaction_create_multisig, transaction: b.vault_transaction_create_transaction, creator: b.vault_transaction_create_creator, rent_payer: b.vault_transaction_create_rent_payer, system_program: b.vault_transaction_create_system_program }, transaction_buffer: b.transaction_buffer, creator: b.creator }, VaultTransactionCreateFromBuffer);
    cross!(
        "vault_transaction_execute",
        no_args,
        builders::VaultTransactionExecute {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            member: unique()
        },
        |b: &builders::VaultTransactionExecute| program::accounts::VaultTransactionExecute {
            multisig: b.multisig,
            proposal: b.proposal,
            transaction: b.transaction,
            member: b.member
        },
        VaultTransactionExecute
    );
    cross!(
        "vault_transaction_execute",
        no_args,
        builders::VaultTransactionExecute {
            multisig: unique(),
            proposal: unique(),
            transaction: unique(),
            member: unique()
        },
        |b: &builders::VaultTransactionExecute| program::accounts::VaultTransactionExecute {
            multisig: b.multisig,
            proposal: b.proposal,
            transaction: b.transaction,
            member: b.member
        },
        VaultTransactionExecute
    );
}

#[test]
fn size_constants_match_anchor_init_space() {
    assert_eq!(Member::LEN, Member::INIT_SPACE);
    assert_eq!(Batch::LEN, Batch::INIT_SPACE);
    assert_eq!(ProgramConfig::LEN, ProgramConfig::INIT_SPACE);
}

#[test]
fn account_discriminators_match_anchor() {
    fn check<T: Discriminator + ProgramAccount>() {
        assert_eq!(T::DISCRIMINATOR, T::ACCOUNT_DISCRIMINATOR.as_slice());
    }
    check::<Batch>();
    check::<ConfigTransaction>();
    check::<Multisig>();
    check::<ProgramConfig>();
    check::<Proposal>();
    check::<SpendingLimit>();
    check::<TransactionBuffer>();
    check::<VaultBatchTransaction>();
    check::<VaultTransaction>();
}

#[test]
fn log_event_builder_matches_anchor() {
    // Arrange
    let builder = builders::LogEvent {
        log_authority: unique(),
    };
    let args = || LogEventArgs { event: vec![7; 40] };

    // Act
    let core = builder.instruction(args(), None).expect("builder");
    let anchor = Instruction {
        program_id: program::ID,
        accounts: program::accounts::LogEvent {
            log_authority: builder.log_authority,
        }
        .to_account_metas(None),
        data: program::instruction::LogEvent { args: args() }.data(),
    };

    // Assert
    assert_eq!(core, anchor);
    assert_eq!(
        program::instruction::LogEvent::DISCRIMINATOR,
        squads_multisig_4r_program::discriminator::instruction::LOG_EVENT
    );
}
