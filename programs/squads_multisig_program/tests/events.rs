//! Event encoding and decoding, the 10 KiB size guard, the opt-in event account and the
//! `log_event` helpers. Runs with and without the `program` feature.

mod common;

use std::borrow::Cow;
use std::str::FromStr;

use common::{fixtures, ACCOUNTS};
use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};
use squads_multisig_4r_program::account::ProgramAccount;
use squads_multisig_4r_program::discriminator::{account, instruction::LOG_EVENT};
use squads_multisig_4r_program::error::CoreError;
use squads_multisig_4r_program::events::*;
use squads_multisig_4r_program::instructions::LogEventArgs;
use squads_multisig_4r_program::state::{
    Batch, ConfigAction, ConfigTransaction, Member, Multisig, Permission, Permissions,
    ProgramConfig, Proposal, ProposalStatus, SpendingLimit, VaultBatchTransaction,
    VaultTransaction,
};
use squads_multisig_4r_program::{builders, ID, LEGACY_V4_PROGRAM_ID};

fn key(byte: u8) -> Address {
    Address::new_from_array([byte; 32])
}

/// The first mainnet fixture of type `T`, with its address.
fn fixture<T: ProgramAccount>(label: &str) -> (Address, T) {
    fixtures(ACCOUNTS)
        .find(|(l, _, _)| *l == label)
        .map(|(_, id, data)| {
            let address = Address::from_str(id).expect("address");
            let account = T::try_from_account_data(&address, &data).expect("fixture decodes");
            (address, account)
        })
        .expect("fixture")
}

/// One event per variant, in variant order, with mainnet snapshots.
fn one_of_each() -> Vec<MultisigEvent<'static>> {
    let (program_config_key, program_config) = fixture::<ProgramConfig>("ProgramConfig");
    let (multisig_key, multisig) = fixture::<Multisig>("Multisig");
    let (spending_limit_key, spending_limit) = fixture::<SpendingLimit>("SpendingLimit");
    let (transaction_key, transaction) = fixture::<VaultTransaction>("VaultTransaction");
    let (batch_key, batch) = fixture::<Batch>("Batch");
    let (_, config_transaction) = fixture::<ConfigTransaction>("ConfigTransaction");
    let (batch_transaction_key, batch_transaction) =
        fixture::<VaultBatchTransaction>("VaultBatchTransaction");
    let (proposal_key, proposal) = fixture::<Proposal>("Proposal");
    let source = ConfigSource::ConfigTransaction {
        transaction: transaction_key,
        transaction_index: 3,
    };
    vec![
        MultisigEvent::ProgramConfig(ProgramConfigEvent {
            kind: ProgramConfigEventKind::SetTreasury,
            program_config: program_config_key,
            authority: program_config.authority,
            snapshot: Cow::Owned(program_config),
        }),
        MultisigEvent::MultisigCreate(MultisigCreateEvent {
            multisig: multisig_key,
            create_key: multisig.create_key,
            creator: key(1),
            memo: Some("create".into()),
            snapshot: Some(Cow::Owned(multisig.clone())),
        }),
        MultisigEvent::MultisigConfig(MultisigConfigEvent {
            multisig: multisig_key,
            source: ConfigSource::ConfigAuthority { authority: key(2) },
            actions: config_transaction.actions.clone().into(),
            memo: None,
            snapshot: Some(Cow::Owned(multisig.clone())),
        }),
        MultisigEvent::ConfigAuthorityChange(ConfigAuthorityChangeEvent {
            multisig: multisig_key,
            authority: key(2),
            new_config_authority: key(3),
            memo: None,
            snapshot: Some(Cow::Owned(multisig)),
        }),
        MultisigEvent::SpendingLimit(SpendingLimitEvent {
            kind: SpendingLimitEventKind::Remove,
            multisig: multisig_key,
            spending_limit: spending_limit_key,
            source,
            memo: None,
            snapshot: Some(Cow::Owned(spending_limit.clone())),
        }),
        MultisigEvent::SpendingLimitUse(SpendingLimitUseEvent {
            multisig: multisig_key,
            spending_limit: spending_limit_key,
            member: key(4),
            vault: key(5),
            destination: key(6),
            mint: None,
            decimals: 9,
            amount: 1_000_000_000,
            memo: Some("pay".into()),
            snapshot: Some(Cow::Owned(spending_limit)),
        }),
        MultisigEvent::Transaction(TransactionEvent {
            kind: TransactionEventKind::Create,
            multisig: multisig_key,
            transaction: transaction_key,
            transaction_index: transaction.index,
            member: Some(transaction.creator),
            memo: None,
            content: Some(TransactionContent::Vault(Cow::Owned(transaction))),
        }),
        MultisigEvent::BatchTransaction(BatchTransactionEvent {
            kind: BatchTransactionEventKind::Add,
            multisig: multisig_key,
            batch: batch_key,
            transaction: batch_transaction_key,
            batch_index: batch.index,
            transaction_index: 1,
            member: Some(batch.creator),
            snapshot: Some(Cow::Owned(batch_transaction)),
        }),
        MultisigEvent::Proposal(ProposalEvent {
            kind: ProposalEventKind::Close,
            multisig: proposal.multisig,
            proposal: proposal_key,
            transaction_index: proposal.transaction_index,
            member: None,
            memo: None,
            snapshot: Some(Cow::Owned(proposal)),
        }),
    ]
}

fn large_multisig(members: u8) -> Multisig {
    let (_, multisig) = fixture::<Multisig>("Multisig");
    let permissions = Permissions::from_vec(&[Permission::Vote]);
    Multisig {
        members: (0..=members)
            .flat_map(|a| [a, a.wrapping_add(128)])
            .map(|byte| Member {
                key: Address::new_from_array([byte; 32]),
                permissions,
            })
            .collect(),
        ..multisig
    }
}

#[test]
fn every_variant_round_trips_through_log_event_data() {
    // Arrange
    let events = one_of_each();

    // Act
    let decoded: Vec<Option<MultisigEvent>> = events
        .iter()
        .map(|event| decode_log_event(&log_event_data(event).expect("encode")).expect("decode"))
        .collect();

    // Assert
    events
        .iter()
        .zip(decoded)
        .for_each(|(event, decoded)| assert_eq!(decoded.as_ref(), Some(event)));
}

#[test]
fn variant_tags_are_pinned_to_their_position() {
    // Arrange
    let events = one_of_each();

    // Act
    let tags: Vec<u8> = events
        .iter()
        .map(|event| borsh::to_vec(event).expect("encode")[0])
        .collect();

    // Assert: tags are the wire format; new variants go at the end.
    assert_eq!(tags, (0..=8).collect::<Vec<u8>>());
}

#[test]
fn log_event_data_is_the_log_event_instruction_data() {
    // Arrange
    let event = one_of_each().remove(8);
    let args = LogEventArgs {
        event: borsh::to_vec(&event).expect("encode"),
    };

    // Act
    let instruction = builders::LogEvent {
        log_authority: key(9),
    }
    .instruction(args, None)
    .expect("builder");

    // Assert: one buffer of the exact size (the program heap never frees).
    let data = log_event_data(&event).expect("encode");
    assert_eq!(data.capacity(), data.len());
    assert_eq!(instruction.data, data);
    assert_eq!(instruction.data[..8], LOG_EVENT);
    assert_eq!(
        instruction.accounts,
        vec![AccountMeta::new_readonly(key(9), true)]
    );
}

/// The same bytes are checked by `sdk/multisig-4r/test/unit/events.test.ts`.
#[test]
fn log_event_data_matches_the_shared_cross_sdk_vector() {
    // Arrange
    let event = MultisigEvent::Proposal(ProposalEvent {
        kind: ProposalEventKind::Approve,
        multisig: key(1),
        proposal: key(2),
        transaction_index: 7,
        member: Some(key(3)),
        memo: Some("hi".into()),
        snapshot: Some(Cow::Owned(Proposal {
            multisig: key(1),
            transaction_index: 7,
            status: ProposalStatus::Approved {
                timestamp: 1_700_000_000,
            },
            bump: 254,
            approved: vec![key(3)],
            rejected: vec![],
            cancelled: vec![],
        })),
    });

    // Act
    let hex: String = log_event_data(&event)
        .expect("encode")
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();

    // Assert
    assert_eq!(hex, SHARED_VECTOR);
}

const SHARED_VECTOR: &str = concat!(
    "05095a8ddf8639d9d10000000802010101010101010101010101010101010101010101010101010101010101",
    "0101020202020202020202020202020202020202020202020202020202020202020207000000000000000103",
    "0303030303030303030303030303030303030303030303030303030303030301020000006869010101010101",
    "01010101010101010101010101010101010101010101010101010107000000000000000300f1536500000000",
    "fe01000000030303030303030303030303030303030303030303030303030303030303030300000000000000",
    "00",
);

#[test]
fn oversized_events_drop_their_snapshots_and_fit_the_cpi_limit() {
    // Arrange: 2 * 201 members of 33 bytes, plus a vault transaction with 400 account keys.
    let multisig = large_multisig(200);
    let (_, mut transaction) = fixture::<VaultTransaction>("VaultTransaction");
    transaction.message.account_keys = (0..400u32)
        .map(|i| Address::new_from_array([(i % 251) as u8; 32]))
        .collect();
    let config = MultisigEvent::MultisigConfig(MultisigConfigEvent {
        multisig: key(1),
        source: ConfigSource::ConfigAuthority { authority: key(2) },
        actions: vec![ConfigAction::ChangeThreshold { new_threshold: 2 }].into(),
        memo: Some("big".into()),
        snapshot: Some(Cow::Owned(multisig)),
    });
    let create = MultisigEvent::Transaction(TransactionEvent {
        kind: TransactionEventKind::Create,
        multisig: key(1),
        transaction: key(3),
        transaction_index: 1,
        member: Some(key(4)),
        memo: None,
        content: Some(TransactionContent::Vault(Cow::Owned(transaction))),
    });

    // Act + Assert
    [config, create].into_iter().for_each(|event| {
        assert!(borsh::to_vec(&event).expect("encode").len() > MAX_LOG_EVENT_DATA_LEN);
        let data = log_event_data(&event).expect("encode");
        assert!(data.len() <= MAX_LOG_EVENT_DATA_LEN);
        assert_eq!(
            decode_log_event(&data).expect("decode"),
            Some(event.without_snapshots())
        );
    });
}

#[test]
fn events_under_the_limit_keep_their_snapshots() {
    // Arrange: 2 * 151 members, about 10 KB with the event header.
    let event = MultisigEvent::MultisigCreate(MultisigCreateEvent {
        multisig: key(1),
        create_key: key(2),
        creator: key(3),
        memo: None,
        snapshot: Some(Cow::Owned(large_multisig(150))),
    });

    // Act
    let data = log_event_data(&event).expect("encode");

    // Assert
    assert!(data.len() <= MAX_LOG_EVENT_DATA_LEN);
    assert_eq!(decode_log_event(&data).expect("decode"), Some(event));
}

#[test]
fn decode_log_event_ignores_other_instructions_and_rejects_bad_data() {
    // Arrange
    let other = [1, 219, 215, 108, 184, 229, 214, 8, 0];
    let truncated = [LOG_EVENT.as_slice(), &[4, 0, 0, 0, 8]].concat();
    let unknown_variant = [LOG_EVENT.as_slice(), &[1, 0, 0, 0, 200]].concat();

    // Act + Assert
    assert_eq!(decode_log_event(&other), Ok(None));
    assert_eq!(decode_log_event(&[]), Ok(None));
    assert_eq!(
        decode_log_event(&truncated),
        Err(CoreError::InvalidEventData)
    );
    assert_eq!(
        decode_log_event(&unknown_variant),
        Err(CoreError::InvalidEventData)
    );
}

#[test]
fn with_events_appends_the_program_account_except_for_legacy_v4() {
    // Arrange
    let builder = builders::ProposalActivate {
        multisig: key(1),
        member: key(2),
        proposal: key(3),
    };
    let target = Address::new_unique();

    // Act
    let default = builders::with_events(builder.instruction(None));
    let custom = builders::with_events(builder.instruction(Some(&target)));
    let legacy = builders::with_events(builder.instruction(Some(&LEGACY_V4_PROGRAM_ID)));

    // Assert
    assert_eq!(
        default.accounts.last(),
        Some(&AccountMeta::new_readonly(ID, false))
    );
    assert_eq!(default.accounts.len(), 4);
    assert_eq!(
        custom.accounts.last(),
        Some(&AccountMeta::new_readonly(target, false))
    );
    assert_eq!(legacy, builder.instruction(Some(&LEGACY_V4_PROGRAM_ID)));
}

#[test]
fn split_event_account_strips_only_one_extra_trailing_program_account() {
    // Arrange
    let others = [key(1), key(2), key(3)];
    let with_event = [key(1), key(2), key(3), ID];
    let with_other_extra = [key(1), key(2), key(3), key(4)];
    let message_calls_program = [key(1), ID, key(3)];
    let split = |accounts: &[Address]| {
        let (rest, enabled) = split_event_account(accounts, 3, &ID, |a| a);
        (rest.to_vec(), enabled)
    };

    // Act + Assert
    assert_eq!(split(&others), (others.to_vec(), false));
    assert_eq!(split(&with_event), (others.to_vec(), true));
    assert_eq!(split(&with_other_extra), (with_other_extra.to_vec(), false));
    assert_eq!(
        split(&message_calls_program),
        (message_calls_program.to_vec(), true)
    );
}

#[test]
fn only_multisig_and_program_config_accounts_may_sign_log_event() {
    // Arrange
    let data = |discriminator: [u8; 8]| [discriminator.as_slice(), &[0; 32]].concat();

    // Act + Assert
    assert!(is_log_authority_data(&data(account::MULTISIG)));
    assert!(is_log_authority_data(&data(account::PROGRAM_CONFIG)));
    [
        account::PROPOSAL,
        account::VAULT_TRANSACTION,
        account::SPENDING_LIMIT,
        [0; 8],
    ]
    .into_iter()
    .for_each(|discriminator| assert!(!is_log_authority_data(&data(discriminator))));
    assert!(!is_log_authority_data(&[]));
}

#[test]
fn is_log_event_call_matches_only_log_event_of_the_program() {
    // Arrange
    let log_event = Instruction {
        program_id: ID,
        accounts: vec![],
        data: [LOG_EVENT.as_slice(), &[0, 0, 0, 0]].concat(),
    };
    let other_program = key(7);

    // Act + Assert
    assert!(is_log_event_call(
        &log_event.program_id,
        &log_event.data,
        &ID
    ));
    assert!(!is_log_event_call(&other_program, &log_event.data, &ID));
    assert!(!is_log_event_call(&ID, &LOG_EVENT[..7], &ID));
    assert!(!is_log_event_call(
        &ID,
        &[1, 219, 215, 108, 184, 229, 214, 8],
        &ID
    ));
}

#[test]
fn authority_is_the_program_config_or_the_multisig() {
    // Arrange
    let events = one_of_each();
    let (program_config, _) = fixture::<ProgramConfig>("ProgramConfig");
    let (multisig, _) = fixture::<Multisig>("Multisig");
    let (_, proposal) = fixture::<Proposal>("Proposal");

    // Act
    let authorities: Vec<Address> = events.iter().map(MultisigEvent::authority).collect();

    // Assert: the fixture proposal belongs to another multisig than the fixture multisig.
    assert_eq!(authorities[0], program_config);
    assert!(authorities[1..8].iter().all(|a| *a == multisig));
    assert_eq!(authorities[8], proposal.multisig);
}

#[test]
fn decode_verified_log_event_checks_the_program_and_the_signer() {
    // Arrange
    let event = one_of_each().remove(8);
    let data = log_event_data(&event).expect("encode");
    let signer = event.authority();
    let other = key(7);
    let other_instruction = [1, 219, 215, 108, 184, 229, 214, 8];

    // Act + Assert
    assert_eq!(
        decode_verified_log_event(&ID, &ID, &[signer], &data),
        Ok(Some(event))
    );
    assert_eq!(
        decode_verified_log_event(&ID, &other, &[signer], &data),
        Ok(None)
    );
    assert_eq!(
        decode_verified_log_event(&ID, &ID, &[signer], &other_instruction),
        Ok(None)
    );
    assert_eq!(
        decode_verified_log_event(&ID, &ID, &[other], &data),
        Err(CoreError::EventAuthorityMismatch)
    );
    assert_eq!(
        decode_verified_log_event(&ID, &ID, &[], &data),
        Err(CoreError::EventAuthorityMismatch)
    );
}

#[test]
fn borrowed_and_owned_snapshots_encode_the_same_bytes() {
    // Arrange: the program borrows the account; a client decodes an owned copy.
    let (multisig_key, multisig) = fixture::<Multisig>("Multisig");
    let (_, config_transaction) = fixture::<ConfigTransaction>("ConfigTransaction");
    let event = |borrowed: bool| {
        MultisigEvent::MultisigConfig(MultisigConfigEvent {
            multisig: multisig_key,
            source: ConfigSource::ConfigAuthority { authority: key(2) },
            actions: match borrowed {
                true => Cow::Borrowed(config_transaction.actions.as_slice()),
                false => Cow::Owned(config_transaction.actions.clone()),
            },
            memo: None,
            snapshot: Some(match borrowed {
                true => Cow::Borrowed(&multisig),
                false => Cow::Owned(multisig.clone()),
            }),
        })
    };

    // Act
    let borrowed = log_event_data(&event(true)).expect("encode");
    let owned = log_event_data(&event(false)).expect("encode");

    // Assert
    assert_eq!(borrowed, owned);
    assert_eq!(
        decode_log_event(&borrowed).expect("decode"),
        Some(event(false))
    );
}
