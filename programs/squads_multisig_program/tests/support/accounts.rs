// Account generators for the property tests of the account readers (program and planners), with
// `include!` in a module whose parent has `TokenAuthorityKind` in scope. The official crates encode.

use proptest::prelude::*;
use solana_address::Address;
use solana_loader_v3_interface::state::UpgradeableLoaderState;
use solana_program_option::COption;
use solana_stake_interface::stake_flags::StakeFlags;
use solana_stake_interface::state::{Authorized, Lockup, Meta, Stake, StakeStateV2};
use solana_vote_interface::state::{VoteStateV3, VoteStateV4, VoteStateVersions};
use spl_token_2022_interface::extension::{
    confidential_mint_burn::ConfidentialMintBurn, confidential_transfer::ConfidentialTransferMint,
    confidential_transfer_fee::ConfidentialTransferFeeConfig,
    default_account_state::DefaultAccountState, group_member_pointer::GroupMemberPointer,
    group_pointer::GroupPointer, immutable_owner::ImmutableOwner,
    interest_bearing_mint::InterestBearingConfig, memo_transfer::MemoTransfer,
    metadata_pointer::MetadataPointer, mint_close_authority::MintCloseAuthority,
    non_transferable::NonTransferable, pausable::PausableConfig,
    permanent_delegate::PermanentDelegate, permissioned_burn::PermissionedBurnConfig,
    scaled_ui_amount::ScaledUiAmountConfig, transfer_fee::TransferFeeConfig,
    transfer_hook::TransferHook, BaseStateWithExtensions, BaseStateWithExtensionsMut,
    ExtensionType, StateWithExtensionsMut,
};
use spl_token_2022_interface::state::{Account, AccountState, Mint};
use spl_token_metadata_interface::state::TokenMetadata;

use super::TokenAuthorityKind as Kind;

/// The size of a mint and of a token account without extensions.
pub const MINT_LEN: usize = 82;
pub const TOKEN_ACCOUNT_LEN: usize = 165;

/// The v4 vault in every generated account.
pub const VAULT: Address = Address::new_from_array([7; 32]);

/// A key that is neither zero nor the vault.
pub fn other() -> impl Strategy<Value = Address> {
    any::<[u8; 32]>().prop_map(|mut bytes| {
        bytes[0] = 1;
        Address::new_from_array(bytes)
    })
}

/// The vault or another key.
pub fn key() -> impl Strategy<Value = Address> {
    prop_oneof![Just(VAULT), other()]
}

/// The vault, another key, or nobody.
pub fn holder() -> impl Strategy<Value = Option<Address>> {
    prop_oneof![Just(None), Just(Some(VAULT)), other().prop_map(Some)]
}

/// Converts a holder to a Token-2022 nullable key (zero for nobody).
fn nullable<T: TryFrom<Option<Address>>>(holder: Option<Address>) -> T
where
    T::Error: std::fmt::Debug,
{
    T::try_from(holder).expect("generated keys are never zero")
}

fn meta() -> impl Strategy<Value = Meta> {
    (key(), key(), key(), any::<i64>(), any::<u64>()).prop_map(
        |(staker, withdrawer, custodian, unix_timestamp, epoch)| Meta {
            authorized: Authorized { staker, withdrawer },
            lockup: Lockup {
                unix_timestamp,
                epoch,
                custodian,
            },
            ..Meta::default()
        },
    )
}

pub fn stake_state() -> impl Strategy<Value = StakeStateV2> {
    let delegated = (meta(), other(), any::<u64>()).prop_map(|(meta, voter, credits)| {
        let mut stake = Stake {
            credits_observed: credits,
            ..Stake::default()
        };
        stake.delegation.voter_pubkey = voter;
        StakeStateV2::Stake(meta, stake, StakeFlags::default())
    });
    prop_oneof![
        Just(StakeStateV2::Uninitialized),
        Just(StakeStateV2::RewardsPool),
        meta().prop_map(StakeStateV2::Initialized),
        delegated,
    ]
}

/// The `Meta` of a stake state that has one.
pub fn stake_meta_of(state: &StakeStateV2) -> Option<Meta> {
    match state {
        StakeStateV2::Initialized(meta) | StakeStateV2::Stake(meta, _, _) => Some(*meta),
        StakeStateV2::Uninitialized | StakeStateV2::RewardsPool => None,
    }
}

/// A stake account as the Stake program allocates it (200 bytes).
pub fn stake_bytes(state: &StakeStateV2) -> Vec<u8> {
    let mut data = bincode::serialize(state).expect("stake state encodes");
    data.resize(StakeStateV2::size_of(), 0);
    data
}

pub fn vote_state() -> impl Strategy<Value = VoteStateVersions> {
    (0u8..4, other(), key()).prop_map(|(version, node_pubkey, authorized_withdrawer)| {
        let v3 = VoteStateV3 {
            node_pubkey,
            authorized_withdrawer,
            ..VoteStateV3::default()
        };
        match version {
            0 => VoteStateVersions::Uninitialized,
            1 => VoteStateVersions::V1_14_11(Box::new(v3.into())),
            2 => VoteStateVersions::new_v3(v3),
            _ => VoteStateVersions::new_v4(VoteStateV4 {
                node_pubkey,
                authorized_withdrawer,
                ..VoteStateV4::default()
            }),
        }
    })
}

pub fn vote_withdrawer_of(state: &VoteStateVersions) -> Option<Address> {
    match state {
        VoteStateVersions::Uninitialized => None,
        VoteStateVersions::V1_14_11(state) => Some(state.authorized_withdrawer),
        VoteStateVersions::V3(state) => Some(state.authorized_withdrawer),
        VoteStateVersions::V4(state) => Some(state.authorized_withdrawer),
    }
}

/// A vote account as the Vote program allocates it (3762 bytes).
pub fn vote_bytes(state: &VoteStateVersions) -> Vec<u8> {
    let mut data = bincode::serialize(state).expect("vote state encodes");
    data.resize(VoteStateV4::size_of(), 0);
    data
}

pub fn loader_state() -> impl Strategy<Value = UpgradeableLoaderState> {
    prop_oneof![
        Just(UpgradeableLoaderState::Uninitialized),
        holder().prop_map(|authority_address| UpgradeableLoaderState::Buffer { authority_address }),
        other().prop_map(|programdata_address| UpgradeableLoaderState::Program {
            programdata_address
        }),
        (any::<u64>(), holder()).prop_map(|(slot, upgrade_authority_address)| {
            UpgradeableLoaderState::ProgramData {
                slot,
                upgrade_authority_address,
            }
        }),
    ]
}

/// A loader-v3 account: the state, then `program` (the program bytes of a buffer or program data).
pub fn loader_bytes(state: &UpgradeableLoaderState, program: &[u8]) -> Vec<u8> {
    let mut data = bincode::serialize(state).expect("loader state encodes");
    data.extend_from_slice(program);
    data
}

/// A token account and whether it has Token-2022 account extensions (more than 165 bytes).
#[derive(Clone, Debug)]
pub struct TokenAccountSpec {
    pub account: Account,
    pub extended: bool,
}

pub fn token_account() -> impl Strategy<Value = TokenAccountSpec> {
    let state = prop_oneof![Just(AccountState::Initialized), Just(AccountState::Frozen)];
    let native = prop_oneof![3 => Just(None), 1 => any::<u64>().prop_map(Some)];
    (
        (other(), key(), any::<u64>(), holder(), any::<u64>()),
        (state, native, holder(), any::<bool>()),
    )
        .prop_map(
            |(
                (mint, owner, amount, delegate, delegated_amount),
                (state, native, close_authority, extended),
            )| TokenAccountSpec {
                account: Account {
                    mint,
                    owner,
                    amount,
                    delegate: COption::from(delegate),
                    state,
                    is_native: COption::from(native),
                    delegated_amount,
                    close_authority: COption::from(close_authority),
                },
                extended,
            },
        )
}

pub fn token_account_bytes(spec: &TokenAccountSpec) -> Vec<u8> {
    let extensions = [ExtensionType::ImmutableOwner, ExtensionType::MemoTransfer];
    let len = match spec.extended {
        true => ExtensionType::try_calculate_account_len::<Account>(&extensions)
            .expect("account length"),
        false => TOKEN_ACCOUNT_LEN,
    };
    let mut data = vec![0; len];
    let mut state =
        StateWithExtensionsMut::<Account>::unpack_uninitialized(&mut data).expect("account");
    if spec.extended {
        state
            .init_extension::<ImmutableOwner>(true)
            .expect("immutable owner");
        state
            .init_extension::<MemoTransfer>(true)
            .expect("memo transfer");
        state.init_account_type().expect("account type");
    }
    state.base = spec.account;
    state.pack_base();
    data
}

/// A Token-2022 mint extension that the generator can add.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Ext {
    TransferFee,
    CloseMint,
    ConfidentialTransfer,
    NonTransferable,
    DefaultAccountState,
    InterestBearing,
    PermanentDelegate,
    TransferHook,
    ConfidentialTransferFee,
    MetadataPointer,
    Metadata,
    GroupPointer,
    GroupMemberPointer,
    ConfidentialMintBurn,
    ScaledUiAmount,
    Pausable,
    PermissionedBurn,
}

impl Ext {
    pub const ALL: [Ext; 17] = [
        Ext::TransferFee,
        Ext::CloseMint,
        Ext::ConfidentialTransfer,
        Ext::NonTransferable,
        Ext::DefaultAccountState,
        Ext::InterestBearing,
        Ext::PermanentDelegate,
        Ext::TransferHook,
        Ext::ConfidentialTransferFee,
        Ext::MetadataPointer,
        Ext::Metadata,
        Ext::GroupPointer,
        Ext::GroupMemberPointer,
        Ext::ConfidentialMintBurn,
        Ext::ScaledUiAmount,
        Ext::Pausable,
        Ext::PermissionedBurn,
    ];

    /// The authorities of the extension, in field order.
    pub fn kinds(self) -> &'static [Kind] {
        match self {
            Ext::TransferFee => &[Kind::TransferFeeConfig, Kind::WithheldWithdraw],
            Ext::CloseMint => &[Kind::CloseMint],
            Ext::ConfidentialTransfer => &[Kind::ConfidentialTransferMint],
            Ext::InterestBearing => &[Kind::InterestRate],
            Ext::PermanentDelegate => &[Kind::PermanentDelegate],
            Ext::TransferHook => &[Kind::TransferHookProgramId],
            Ext::ConfidentialTransferFee => &[Kind::ConfidentialTransferFeeConfig],
            Ext::MetadataPointer => &[Kind::MetadataPointer],
            Ext::Metadata => &[Kind::MetadataUpdate],
            Ext::GroupPointer => &[Kind::GroupPointer],
            Ext::GroupMemberPointer => &[Kind::GroupMemberPointer],
            Ext::ScaledUiAmount => &[Kind::ScaledUiAmount],
            Ext::Pausable => &[Kind::Pause],
            Ext::PermissionedBurn => &[Kind::PermissionedBurn],
            Ext::NonTransferable | Ext::DefaultAccountState | Ext::ConfidentialMintBurn => &[],
        }
    }
}

/// A mint: base authorities, then extensions in TLV order with one holder for each authority.
#[derive(Clone, Debug)]
pub struct MintSpec {
    pub mint_authority: Option<Address>,
    pub freeze_authority: Option<Address>,
    pub extensions: Vec<(Ext, Vec<Option<Address>>)>,
}

pub fn mint_spec() -> impl Strategy<Value = MintSpec> {
    let extensions = prop::sample::subsequence(Ext::ALL.to_vec(), 0..=Ext::ALL.len())
        .prop_shuffle()
        .prop_flat_map(|extensions| {
            extensions
                .into_iter()
                .map(|ext| {
                    prop::collection::vec(holder(), ext.kinds().len())
                        .prop_map(move |holders| (ext, holders))
                })
                .collect::<Vec<_>>()
        });
    (holder(), holder(), extensions).prop_map(|(mint_authority, freeze_authority, extensions)| {
        MintSpec {
            mint_authority,
            freeze_authority,
            extensions,
        }
    })
}

impl MintSpec {
    fn authorities(&self) -> impl Iterator<Item = (Kind, Option<Address>)> + '_ {
        let base = [
            (Kind::MintTokens, self.mint_authority),
            (Kind::FreezeAccount, self.freeze_authority),
        ];
        let extensions = self
            .extensions
            .iter()
            .flat_map(|(ext, holders)| ext.kinds().iter().copied().zip(holders.iter().copied()));
        base.into_iter().chain(extensions)
    }

    /// The authorities that `holder` holds: base fields first, then the extensions in TLV order.
    pub fn held_by(&self, holder: Address) -> Vec<Kind> {
        self.authorities()
            .filter(|(_, held)| *held == Some(holder))
            .map(|(kind, _)| kind)
            .collect()
    }

    /// The holder of `kind`, or `None` if the mint does not have its extension.
    pub fn authority(&self, kind: Kind) -> Option<Option<Address>> {
        self.authorities()
            .find(|(found, _)| *found == kind)
            .map(|(_, held)| held)
    }
}

// Grows `data` by one fixed-length extension (the library computes the length) and fills it.
macro_rules! add_extension {
    ($data:expr, $ty:ty, |$extension:ident| $fill:block) => {{
        let len = StateWithExtensionsMut::<Mint>::unpack_uninitialized($data)
            .and_then(|state| state.try_get_new_account_len::<$ty>())
            .expect("extension length");
        $data.resize(len, 0);
        let mut state =
            StateWithExtensionsMut::<Mint>::unpack_uninitialized($data).expect("mint state");
        let $extension = state.init_extension::<$ty>(true).expect("extension");
        $fill
    }};
}

fn add_metadata(data: &mut Vec<u8>, update_authority: Option<Address>) {
    let metadata = TokenMetadata {
        update_authority: nullable(update_authority),
        name: "Token".into(),
        symbol: "TKN".into(),
        ..TokenMetadata::default()
    };
    let len = StateWithExtensionsMut::<Mint>::unpack_uninitialized(data)
        .and_then(|state| state.try_get_new_account_len_for_variable_len_extension(&metadata))
        .expect("metadata length");
    data.resize(len, 0);
    StateWithExtensionsMut::<Mint>::unpack_uninitialized(data)
        .and_then(|mut state| state.init_variable_len_extension(&metadata, true))
        .expect("metadata");
}

fn add(data: &mut Vec<u8>, ext: Ext, holders: &[Option<Address>]) {
    let holder = |index: usize| holders[index];
    match ext {
        Ext::TransferFee => add_extension!(data, TransferFeeConfig, |e| {
            e.transfer_fee_config_authority = nullable(holder(0));
            e.withdraw_withheld_authority = nullable(holder(1));
        }),
        Ext::CloseMint => add_extension!(data, MintCloseAuthority, |e| {
            e.close_authority = nullable(holder(0));
        }),
        Ext::ConfidentialTransfer => add_extension!(data, ConfidentialTransferMint, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::NonTransferable => add_extension!(data, NonTransferable, |_e| {}),
        Ext::DefaultAccountState => add_extension!(data, DefaultAccountState, |e| {
            e.state = AccountState::Frozen as u8;
        }),
        Ext::InterestBearing => add_extension!(data, InterestBearingConfig, |e| {
            e.rate_authority = nullable(holder(0));
        }),
        Ext::PermanentDelegate => add_extension!(data, PermanentDelegate, |e| {
            e.delegate = nullable(holder(0));
        }),
        Ext::TransferHook => add_extension!(data, TransferHook, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::ConfidentialTransferFee => add_extension!(data, ConfidentialTransferFeeConfig, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::MetadataPointer => add_extension!(data, MetadataPointer, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::Metadata => add_metadata(data, holder(0)),
        Ext::GroupPointer => add_extension!(data, GroupPointer, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::GroupMemberPointer => add_extension!(data, GroupMemberPointer, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::ConfidentialMintBurn => add_extension!(data, ConfidentialMintBurn, |_e| {}),
        Ext::ScaledUiAmount => add_extension!(data, ScaledUiAmountConfig, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::Pausable => add_extension!(data, PausableConfig, |e| {
            e.authority = nullable(holder(0));
        }),
        Ext::PermissionedBurn => add_extension!(data, PermissionedBurnConfig, |e| {
            e.authority = nullable(holder(0));
        }),
    }
}

/// The mint bytes: 82 bytes without extensions, else the base, the account type and the TLV entries.
pub fn mint_bytes(spec: &MintSpec) -> Vec<u8> {
    let mut data = vec![0; MINT_LEN];
    spec.extensions
        .iter()
        .for_each(|(ext, holders)| add(&mut data, *ext, holders));
    let mut state = StateWithExtensionsMut::<Mint>::unpack_uninitialized(&mut data).expect("mint");
    state.base = Mint {
        mint_authority: COption::from(spec.mint_authority),
        supply: 1_000,
        decimals: 6,
        is_initialized: true,
        freeze_authority: COption::from(spec.freeze_authority),
    };
    state.pack_base();
    if !spec.extensions.is_empty() {
        state.init_account_type().expect("account type");
    }
    data
}
