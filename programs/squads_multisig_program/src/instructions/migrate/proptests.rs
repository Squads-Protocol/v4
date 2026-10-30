//! Property tests of the account readers: no input makes them panic, and they read what the
//! official crates encode (stake, vote, loader-v3, Token-2022).

use anchor_spl::token_2022::spl_token_2022::{extension::StateWithExtensions, state::Mint};
use proptest::prelude::*;
use spl_token_2022_interface::state::AccountState;

use super::programs::program_data_authority;
use super::stakes::stake_meta;
use super::token_authorities::mint_authority;
use super::token_state::read_token_account;
use super::vote_accounts::vote_withdrawer;
use super::TokenAuthorityKind;
use solana_loader_v3_interface::state::UpgradeableLoaderState;

// `include!`, not `#[path]`: the Anchor IDL build reads the module files and cannot follow a path.
#[allow(dead_code)]
mod accounts {
    include!("../../../tests/support/accounts.rs");
}
use accounts::*;

fn bytes(max: usize) -> impl Strategy<Value = Vec<u8>> {
    prop::collection::vec(any::<u8>(), 0..max)
}

/// Every kind: the base mint authorities, the extension authorities, the token account authorities.
fn all_kinds() -> Vec<TokenAuthorityKind> {
    let base = [
        TokenAuthorityKind::MintTokens,
        TokenAuthorityKind::FreezeAccount,
        TokenAuthorityKind::AccountOwner,
        TokenAuthorityKind::CloseAccount,
    ];
    let extensions = Ext::ALL.iter().flat_map(|ext| ext.kinds().iter().copied());
    base.into_iter().chain(extensions).collect()
}

proptest! {
    #[test]
    fn stake_meta_accepts_any_bytes(data in bytes(256)) {
        let _ = stake_meta(&data);
    }

    #[test]
    fn stake_meta_reads_the_stake_program_layout(state in stake_state()) {
        // Arrange
        let data = stake_bytes(&state);

        // Act
        let read = stake_meta(&data).map(|meta| {
            (meta.staker, meta.withdrawer, meta.lockup_unix_timestamp, meta.lockup_epoch, meta.custodian)
        });

        // Assert
        let expected = stake_meta_of(&state).map(|meta| {
            let lockup = meta.lockup;
            (meta.authorized.staker, meta.authorized.withdrawer, lockup.unix_timestamp, lockup.epoch, lockup.custodian)
        });
        prop_assert_eq!(read, expected);
    }

    #[test]
    fn vote_withdrawer_accepts_any_bytes(data in bytes(128)) {
        let _ = vote_withdrawer(&data);
    }

    #[test]
    fn vote_withdrawer_reads_every_vote_state_version(state in vote_state()) {
        // Arrange
        let data = vote_bytes(&state);

        // Act
        let read = vote_withdrawer(&data);

        // Assert
        prop_assert_eq!(read, vote_withdrawer_of(&state));
    }

    #[test]
    fn program_data_authority_accepts_any_bytes(data in bytes(128)) {
        let _ = program_data_authority(&data);
    }

    #[test]
    fn program_data_authority_reads_only_program_data(state in loader_state(), program in bytes(64)) {
        // Arrange
        let data = loader_bytes(&state, &program);

        // Act
        let read = program_data_authority(&data);

        // Assert
        let expected = match state {
            UpgradeableLoaderState::ProgramData { upgrade_authority_address, .. } => Some(upgrade_authority_address),
            _ => None,
        };
        prop_assert_eq!(read, expected);
    }

    #[test]
    fn read_token_account_accepts_any_bytes(data in bytes(256)) {
        let _ = read_token_account(&data);
    }

    #[test]
    fn read_token_account_reads_the_token_layout(spec in token_account()) {
        // Arrange
        let data = token_account_bytes(&spec);

        // Act
        let read = read_token_account(&data).expect("generated token account");

        // Assert
        let account = spec.account;
        prop_assert_eq!(
            (read.mint, read.owner, read.amount, read.frozen, read.close_authority),
            (
                account.mint,
                account.owner,
                account.amount,
                account.state == AccountState::Frozen,
                Option::from(account.close_authority),
            )
        );
        prop_assert!(read.confidential_closable);
    }

    #[test]
    fn read_token_account_closes_only_empty_confidential_balances(spec in confidential_account()) {
        // Arrange
        let data = confidential_account_bytes(&spec);

        // Act
        let read = read_token_account(&data).expect("generated token account");

        // Assert
        prop_assert_eq!(read.confidential_closable, spec.closable());
    }

    #[test]
    fn mint_authority_reads_every_extension_authority(spec in mint_spec()) {
        // Arrange
        let data = mint_bytes(&spec);
        let state = StateWithExtensions::<Mint>::unpack(&data).expect("generated mint");

        // Act
        let read: Vec<_> = all_kinds().into_iter().map(|kind| mint_authority(&state, kind)).collect();

        // Assert
        let expected: Vec<_> = all_kinds().into_iter().map(|kind| spec.authority(kind)).collect();
        prop_assert_eq!(read, expected);
    }
}
