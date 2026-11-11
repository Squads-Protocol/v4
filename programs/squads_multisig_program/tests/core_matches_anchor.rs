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

#[test]
fn migration_builders_match_anchor() {
    // Arrange
    use program::accounts;
    use program::instruction as ix;
    let source = unique();
    let create_from = builders::MultisigCreateFrom::new(source, 1, unique(), None);
    let migration = builders::MigrationAccounts::new(source, 1, None);
    let anchor_migration = || accounts::MigrationAccounts {
        source_multisig: migration.source_multisig,
        source_vault: migration.source_vault,
        multisig: migration.multisig,
        vault: migration.vault,
    };
    let create_from_args = || MultisigCreateFromArgs {
        vault_index: 1,
        config_authority_vault_index: Some(1),
        rent_collector_vault_index: None,
        max_creation_fee: 7,
        memo: Some("move".into()),
    };
    let sol_args = || MigrateSolArgs {
        vault_index: 1,
        config_authority_vault_index: None,
        keep: 0,
        memo: None,
    };
    let tokens_args = || MigrateTokensArgs {
        vault_index: 1,
        config_authority_vault_index: None,
        close_source: true,
        memo: None,
    };
    let authorities_args = || MigrateTokenAuthoritiesArgs {
        vault_index: 1,
        config_authority_vault_index: None,
        items: vec![TokenAuthorityKind::MetadataUpdate],
        memo: None,
    };
    let other_args = || MigrateAuthoritiesArgs {
        vault_index: 1,
        config_authority_vault_index: Some(0),
        memo: Some("m".into()),
    };
    let tokens = builders::MultisigMigrateTokens::new(migration, anchor_spl::token_2022::ID);
    let authorities =
        builders::MultisigMigrateTokenAuthorities::new(migration, anchor_spl::token::ID);
    let stakes = builders::MultisigMigrateStakes::new(migration);
    let votes = builders::MultisigMigrateVoteAccounts::new(migration);
    let programs = builders::MultisigMigratePrograms::new(migration);
    let anchor = |metas: Vec<solana_instruction::AccountMeta>, data: Vec<u8>| Instruction {
        program_id: program::ID,
        accounts: metas,
        data,
    };

    // Act
    let core = [
        create_from.instruction(create_from_args(), None),
        builders::MultisigMigrateSol::new(migration).instruction(sol_args(), None),
        tokens.instruction(tokens_args(), &[], None),
        authorities.instruction(authorities_args(), &[], None),
        stakes.instruction(other_args(), &[], None),
        votes.instruction(other_args(), &[], None),
        programs.instruction(other_args(), &[], None),
    ]
    .map(|instruction| instruction.expect("builder"));
    let expected = [
        anchor(
            accounts::MultisigCreateFrom {
                program_config: create_from.program_config,
                treasury: create_from.treasury,
                source_multisig: create_from.source_multisig,
                source_vault: create_from.source_vault,
                multisig: create_from.multisig,
                system_program: create_from.system_program,
            }
            .to_account_metas(None),
            ix::MultisigCreateFrom {
                args: create_from_args(),
            }
            .data(),
        ),
        anchor(
            accounts::MultisigMigrateSol {
                migration: anchor_migration(),
                system_program: builders::SYSTEM_PROGRAM_ID,
            }
            .to_account_metas(None),
            ix::MultisigMigrateSol { args: sol_args() }.data(),
        ),
        anchor(
            accounts::MultisigMigrateTokens {
                migration: anchor_migration(),
                token_program: tokens.token_program,
                associated_token_program: tokens.associated_token_program,
                system_program: tokens.system_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateTokens {
                args: tokens_args(),
            }
            .data(),
        ),
        anchor(
            accounts::MultisigMigrateTokenAuthorities {
                migration: anchor_migration(),
                token_program: authorities.token_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateTokenAuthorities {
                args: authorities_args(),
            }
            .data(),
        ),
        anchor(
            accounts::MultisigMigrateStakes {
                migration: anchor_migration(),
                clock: stakes.clock,
                stake_program: stakes.stake_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateStakes { args: other_args() }.data(),
        ),
        anchor(
            accounts::MultisigMigrateVoteAccounts {
                migration: anchor_migration(),
                clock: votes.clock,
                vote_program: votes.vote_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateVoteAccounts { args: other_args() }.data(),
        ),
        anchor(
            accounts::MultisigMigratePrograms {
                migration: anchor_migration(),
                bpf_loader_upgradeable: programs.bpf_loader_upgradeable,
            }
            .to_account_metas(None),
            ix::MultisigMigratePrograms { args: other_args() }.data(),
        ),
    ];

    // Assert
    assert_eq!(core, expected);
}

#[test]
fn v3_migration_builders_match_anchor() {
    // Arrange
    use program::accounts;
    use program::instruction as ix;
    let source = unique();
    let create_from = builders::MultisigCreateFromV3::new(source, 1, unique(), None);
    let migration = builders::MigrationAccountsV3::new(source, 256, None).expect("1..=256");
    let anchor_migration = || accounts::MigrationAccountsV3 {
        source_multisig: migration.source_multisig,
        source_vault: migration.source_vault,
        multisig: migration.multisig,
        vault: migration.vault,
    };
    let create_from_args = || MultisigCreateFromV3Args {
        authority_index: 1,
        max_creation_fee: 7,
        memo: Some("move".into()),
    };
    let sol_args = || MigrateV3SolArgs {
        authority_index: 256,
        keep: 0,
        memo: None,
    };
    let tokens_args = || MigrateV3TokensArgs {
        authority_index: 256,
        close_source: true,
        memo: None,
    };
    let authorities_args = || MigrateV3TokenAuthoritiesArgs {
        authority_index: 256,
        items: vec![TokenAuthorityKind::MetadataUpdate],
        memo: None,
    };
    let other_args = || MigrateV3AuthoritiesArgs {
        authority_index: 256,
        memo: Some("m".into()),
    };
    let tokens = builders::MultisigMigrateTokens::new(migration, anchor_spl::token_2022::ID);
    let authorities =
        builders::MultisigMigrateTokenAuthorities::new(migration, anchor_spl::token::ID);
    let stakes = builders::MultisigMigrateStakes::new(migration);
    let votes = builders::MultisigMigrateVoteAccounts::new(migration);
    let programs = builders::MultisigMigratePrograms::new(migration);
    let anchor = |metas: Vec<solana_instruction::AccountMeta>, data: Vec<u8>| Instruction {
        program_id: program::ID,
        accounts: metas,
        data,
    };

    // Act
    let core = [
        create_from.instruction(create_from_args(), None),
        builders::MultisigMigrateSol::new(migration).instruction(sol_args(), None),
        tokens.instruction(tokens_args(), &[], None),
        authorities.instruction(authorities_args(), &[], None),
        stakes.instruction(other_args(), &[], None),
        votes.instruction(other_args(), &[], None),
        programs.instruction(other_args(), &[], None),
    ]
    .map(|instruction| instruction.expect("builder"));
    let expected = [
        anchor(
            accounts::MultisigCreateFromV3 {
                program_config: create_from.program_config,
                treasury: create_from.treasury,
                source_multisig: create_from.source_multisig,
                source_vault: create_from.source_vault,
                multisig: create_from.multisig,
                system_program: create_from.system_program,
            }
            .to_account_metas(None),
            ix::MultisigCreateFromV3 {
                args: create_from_args(),
            }
            .data(),
        ),
        anchor(
            accounts::MultisigMigrateV3Sol {
                migration: anchor_migration(),
                system_program: builders::SYSTEM_PROGRAM_ID,
            }
            .to_account_metas(None),
            ix::MultisigMigrateV3Sol { args: sol_args() }.data(),
        ),
        anchor(
            accounts::MultisigMigrateV3Tokens {
                migration: anchor_migration(),
                token_program: tokens.token_program,
                associated_token_program: tokens.associated_token_program,
                system_program: tokens.system_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateV3Tokens {
                args: tokens_args(),
            }
            .data(),
        ),
        anchor(
            accounts::MultisigMigrateV3TokenAuthorities {
                migration: anchor_migration(),
                token_program: authorities.token_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateV3TokenAuthorities {
                args: authorities_args(),
            }
            .data(),
        ),
        anchor(
            accounts::MultisigMigrateV3Stakes {
                migration: anchor_migration(),
                clock: stakes.clock,
                stake_program: stakes.stake_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateV3Stakes { args: other_args() }.data(),
        ),
        anchor(
            accounts::MultisigMigrateV3VoteAccounts {
                migration: anchor_migration(),
                clock: votes.clock,
                vote_program: votes.vote_program,
            }
            .to_account_metas(None),
            ix::MultisigMigrateV3VoteAccounts { args: other_args() }.data(),
        ),
        anchor(
            accounts::MultisigMigrateV3Programs {
                migration: anchor_migration(),
                bpf_loader_upgradeable: programs.bpf_loader_upgradeable,
            }
            .to_account_metas(None),
            ix::MultisigMigrateV3Programs { args: other_args() }.data(),
        ),
    ];

    // Assert
    assert_eq!(core, expected);
}

#[test]
fn token_authority_kinds_follow_the_token_2022_authority_types() {
    // Arrange
    use anchor_spl::token_2022::spl_token_2022::instruction::AuthorityType;
    let kinds = [
        (TokenAuthorityKind::MintTokens, AuthorityType::MintTokens),
        (
            TokenAuthorityKind::FreezeAccount,
            AuthorityType::FreezeAccount,
        ),
        (
            TokenAuthorityKind::AccountOwner,
            AuthorityType::AccountOwner,
        ),
        (
            TokenAuthorityKind::CloseAccount,
            AuthorityType::CloseAccount,
        ),
        (
            TokenAuthorityKind::TransferFeeConfig,
            AuthorityType::TransferFeeConfig,
        ),
        (
            TokenAuthorityKind::WithheldWithdraw,
            AuthorityType::WithheldWithdraw,
        ),
        (TokenAuthorityKind::CloseMint, AuthorityType::CloseMint),
        (
            TokenAuthorityKind::InterestRate,
            AuthorityType::InterestRate,
        ),
        (
            TokenAuthorityKind::PermanentDelegate,
            AuthorityType::PermanentDelegate,
        ),
        (
            TokenAuthorityKind::ConfidentialTransferMint,
            AuthorityType::ConfidentialTransferMint,
        ),
        (
            TokenAuthorityKind::TransferHookProgramId,
            AuthorityType::TransferHookProgramId,
        ),
        (
            TokenAuthorityKind::ConfidentialTransferFeeConfig,
            AuthorityType::ConfidentialTransferFeeConfig,
        ),
        (
            TokenAuthorityKind::MetadataPointer,
            AuthorityType::MetadataPointer,
        ),
        (
            TokenAuthorityKind::GroupPointer,
            AuthorityType::GroupPointer,
        ),
        (
            TokenAuthorityKind::GroupMemberPointer,
            AuthorityType::GroupMemberPointer,
        ),
        (
            TokenAuthorityKind::ScaledUiAmount,
            AuthorityType::ScaledUiAmount,
        ),
        (TokenAuthorityKind::Pause, AuthorityType::Pause),
        (
            TokenAuthorityKind::PermissionedBurn,
            AuthorityType::PermissionedBurn,
        ),
    ];

    // Act
    let tags: Vec<(u8, u8)> = kinds
        .iter()
        .map(|(kind, authority)| {
            (
                borsh::to_vec(kind).expect("encode")[0],
                authority.clone() as u8,
            )
        })
        .collect();

    // Assert: the same byte for each authority; `MetadataUpdate` comes after them.
    tags.iter()
        .for_each(|(ours, theirs)| assert_eq!(ours, theirs));
    assert_eq!(
        borsh::to_vec(&TokenAuthorityKind::MetadataUpdate).expect("encode"),
        [18]
    );
}

#[test]
fn migration_program_ids_match_the_official_crates() {
    // Arrange
    use anchor_lang::prelude::Clock;
    use anchor_lang::solana_program::bpf_loader_upgradeable;
    use anchor_lang::solana_program::sysvar::SysvarId;
    use squads_multisig_4r_program::migration::*;

    // Act
    let ours = [
        TOKEN_PROGRAM_ID,
        TOKEN_2022_PROGRAM_ID,
        STAKE_PROGRAM_ID,
        BPF_LOADER_UPGRADEABLE_ID,
        CLOCK_SYSVAR_ID,
    ];
    let official = [
        anchor_spl::token::ID,
        anchor_spl::token_2022::ID,
        anchor_spl::compat::solana_stake_interface::program::ID,
        bpf_loader_upgradeable::ID,
        Clock::id(),
    ];

    // Assert: ASSOCIATED_TOKEN_PROGRAM_ID has no crate here; the integration test runs it.
    assert_eq!(ours, official);
}
