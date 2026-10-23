//! Property tests of the planner's account readers, and the fixture that the TS planner test reads
//! (`tests/fixtures/account_readers.json`). `UPDATE_FIXTURES=1 cargo test` rewrites the fixture.

use proptest::prelude::*;
use proptest::strategy::ValueTree;
use proptest::test_runner::TestRunner;
use serde_json::{json, Value};
use solana_address::Address;
use solana_stake_interface::state::StakeStateV2;
use spl_token_2022_interface::state::AccountState;
use squads_multisig_4r::instructions::TokenAuthorityKind;
use squads_multisig_4r::migration::{TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID};
use squads_multisig_4r::planner::*;

#[allow(dead_code)]
mod accounts {
    include!("../../../programs/squads_multisig_program/tests/support/accounts.rs");
}
use accounts::*;

const ACCOUNT: Address = Address::new_from_array([3; 32]);

fn bytes(len: std::ops::Range<usize>) -> impl Strategy<Value = Vec<u8>> {
    prop::collection::vec(any::<u8>(), len)
}

/// Data that passes the Token-2022 account type check, so the readers walk the TLV entries.
fn extended(account_type: u8) -> impl Strategy<Value = Vec<u8>> {
    bytes(167..700).prop_map(move |mut data| {
        data[165] = account_type;
        data
    })
}

fn expected_role(spec: &TokenAccountSpec) -> Option<(bool, Option<u64>)> {
    let account = spec.account;
    let close_authority = Option::from(account.close_authority) == Some(VAULT);
    let delegate = Option::from(account.delegate) == Some(VAULT);
    let delegated_amount = delegate.then_some(account.delegated_amount);
    (close_authority || delegate).then_some((close_authority, delegated_amount))
}

fn expected_stake(state: &StakeStateV2) -> Option<InventoryStake> {
    stake_meta_of(state).map(|meta| InventoryStake {
        stake: ACCOUNT,
        staker: meta.authorized.staker == VAULT,
        withdrawer: meta.authorized.withdrawer == VAULT,
        custodian: meta.lockup.custodian == VAULT,
    })
}

proptest! {
    #[test]
    fn readers_accept_any_bytes(data in bytes(0..400)) {
        let _ = parse_mint_authorities(&data, &VAULT);
        let _ = parse_token_account(ACCOUNT, TOKEN_PROGRAM_ID, &data);
        let _ = parse_token_role(ACCOUNT, TOKEN_PROGRAM_ID, &VAULT, &data);
        let _ = parse_stake(ACCOUNT, &VAULT, &data);
        let _ = parse_vote_withdrawer(&data);
    }

    #[test]
    fn readers_accept_any_extension_entries(mint in extended(1), account in extended(2)) {
        let _ = parse_mint_authorities(&mint, &VAULT);
        let _ = parse_token_account(ACCOUNT, TOKEN_2022_PROGRAM_ID, &account);
        let _ = parse_token_role(ACCOUNT, TOKEN_2022_PROGRAM_ID, &VAULT, &account);
    }

    #[test]
    fn mint_authorities_match_the_token_2022_layout(spec in mint_spec()) {
        // Arrange
        let data = mint_bytes(&spec);

        // Act
        let read = parse_mint_authorities(&data, &VAULT);

        // Assert
        prop_assert_eq!(read, Some(spec.held_by(VAULT)));
        prop_assert_eq!(parse_token_account(ACCOUNT, TOKEN_2022_PROGRAM_ID, &data), None);
    }

    #[test]
    fn token_accounts_match_the_token_layout(spec in token_account()) {
        // Arrange
        let data = token_account_bytes(&spec);
        let program = if spec.extended { TOKEN_2022_PROGRAM_ID } else { TOKEN_PROGRAM_ID };

        // Act
        let token = parse_token_account(ACCOUNT, program, &data).expect("a token account");
        let role = parse_token_role(ACCOUNT, program, &VAULT, &data);

        // Assert
        prop_assert_eq!(token.mint, spec.account.mint);
        prop_assert_eq!(token.amount, spec.account.amount);
        prop_assert_eq!(token.frozen, spec.account.state == AccountState::Frozen);
        prop_assert_eq!(
            role.map(|role| (role.close_authority, role.delegated_amount)),
            expected_role(&spec)
        );
        prop_assert_eq!(parse_mint_authorities(&data, &VAULT), None);
    }

    #[test]
    fn stakes_match_the_stake_layout(state in stake_state()) {
        prop_assert_eq!(parse_stake(ACCOUNT, &VAULT, &stake_bytes(&state)), expected_stake(&state));
    }

    #[test]
    fn vote_withdrawers_match_every_vote_state_version(state in vote_state()) {
        prop_assert_eq!(parse_vote_withdrawer(&vote_bytes(&state)), vote_withdrawer_of(&state));
    }
}

fn hex(data: &[u8]) -> String {
    data.iter().map(|byte| format!("{byte:02x}")).collect()
}

/// `count` deterministic values of `strategy`.
fn samples<S: Strategy>(strategy: S, count: usize) -> Vec<S::Value> {
    let mut runner = TestRunner::deterministic();
    (0..count)
        .map(|_| strategy.new_tree(&mut runner).expect("a sample").current())
        .collect()
}

/// The cases for the TS readers, with the values that the official crates encoded.
fn fixture() -> Value {
    let mints = samples(mint_spec(), 48).into_iter().map(|spec| {
        let kinds: Vec<u8> = spec.held_by(VAULT).iter().map(|kind| *kind as u8).collect();
        json!({ "data": hex(&mint_bytes(&spec)), "authorities": kinds })
    });
    let tokens = samples(token_account(), 32).into_iter().map(|spec| {
        let role = expected_role(&spec);
        json!({
            "data": hex(&token_account_bytes(&spec)),
            "mint": spec.account.mint.to_string(),
            "owner": spec.account.owner.to_string(),
            "amount": spec.account.amount.to_string(),
            "frozen": spec.account.state == AccountState::Frozen,
            "closeAuthority": role.is_some_and(|(close, _)| close),
            "delegatedAmount": role.and_then(|(_, amount)| amount).map(|amount| amount.to_string()),
        })
    });
    let stakes = samples(stake_state(), 24).into_iter().map(|state| {
        let roles = expected_stake(&state).map(|stake| {
            json!({ "staker": stake.staker, "withdrawer": stake.withdrawer, "custodian": stake.custodian })
        });
        json!({ "data": hex(&stake_bytes(&state)), "roles": roles })
    });
    // The readers use the first 68 bytes of the 3762; the rest is zero.
    let votes = samples(vote_state(), 16).into_iter().map(|state| {
        json!({
            "data": hex(&vote_bytes(&state)[..100]),
            "withdrawer": vote_withdrawer_of(&state).map(|key| key.to_string()),
        })
    });
    json!({
        "vault": VAULT.to_string(),
        "mints": mints.collect::<Vec<_>>(),
        "tokenAccounts": tokens.collect::<Vec<_>>(),
        "stakes": stakes.collect::<Vec<_>>(),
        "voteAccounts": votes.collect::<Vec<_>>(),
    })
}

#[test]
fn the_ts_fixture_matches_the_generators() {
    // Arrange
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/tests/fixtures/account_readers.json"
    );
    let expected = serde_json::to_string_pretty(&fixture()).expect("json") + "\n";
    if std::env::var_os("UPDATE_FIXTURES").is_some() {
        std::fs::write(path, &expected).expect("write the fixture");
    }

    // Act
    let stored = std::fs::read_to_string(path).unwrap_or_default();

    // Assert
    assert!(
        stored == expected,
        "{path} is stale: run with UPDATE_FIXTURES=1"
    );
}
