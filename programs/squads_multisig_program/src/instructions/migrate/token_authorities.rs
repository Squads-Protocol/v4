#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_lang::solana_program::program::invoke;
#[cfg(feature = "program")]
use anchor_spl::compat::spl_token_metadata_interface::{
    instruction::update_authority, state::TokenMetadata,
};
#[cfg(feature = "program")]
use anchor_spl::token_2022::spl_token_2022::extension::{
    confidential_transfer::ConfidentialTransferMint,
    confidential_transfer_fee::ConfidentialTransferFeeConfig,
    group_member_pointer::GroupMemberPointer, group_pointer::GroupPointer,
    immutable_owner::ImmutableOwner, interest_bearing_mint::InterestBearingConfig,
    metadata_pointer::MetadataPointer, mint_close_authority::MintCloseAuthority,
    pausable::PausableConfig, permanent_delegate::PermanentDelegate,
    permissioned_burn::PermissionedBurnConfig, scaled_ui_amount::ScaledUiAmountConfig,
    transfer_fee::TransferFeeConfig, transfer_hook::TransferHook, BaseStateWithExtensions,
    StateWithExtensions,
};
#[cfg(feature = "program")]
use anchor_spl::token_2022::spl_token_2022::instruction::AuthorityType;
#[cfg(feature = "program")]
use anchor_spl::token_2022::spl_token_2022::state::{Account as TokenAccount, Mint};
#[cfg(feature = "program")]
use anchor_spl::token_2022::{self as token, SetAuthority};
#[cfg(feature = "program")]
use anchor_spl::token_interface::TokenInterface;

#[cfg(feature = "program")]
use super::common::*;
#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(feature = "program")]
use crate::events::{MigrationAssetKind, MigrationOutcome, MigrationScope, MigrationSkipReason};
#[cfg(feature = "program")]
use crate::migration;
#[cfg(not(feature = "program"))]
use crate::prelude::*;

/// An authority that a v4 vault can hold over a token account or a mint. The first 18 values are
/// the Token-2022 `AuthorityType` values, in the same order; Token supports the first four.
#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TokenAuthorityKind {
    MintTokens,
    FreezeAccount,
    /// The owner of a token account that is not the vault's associated token account.
    AccountOwner,
    CloseAccount,
    TransferFeeConfig,
    WithheldWithdraw,
    CloseMint,
    InterestRate,
    PermanentDelegate,
    ConfidentialTransferMint,
    TransferHookProgramId,
    ConfidentialTransferFeeConfig,
    MetadataPointer,
    GroupPointer,
    GroupMemberPointer,
    ScaledUiAmount,
    Pause,
    PermissionedBurn,
    /// The update authority of the Token-2022 metadata stored in the mint.
    MetadataUpdate,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateTokenAuthoritiesArgs {
    /// The v4 vault index. Every migrate instruction starts its arguments with this field.
    pub vault_index: u8,
    /// Set if the v4 `config_authority` is the v4 vault with this index (see `multisig_create_from`).
    pub config_authority_vault_index: Option<u8>,
    /// One authority for each remaining account (the token account or the mint), in order.
    pub items: Vec<TokenAuthorityKind>,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateTokenAuthorities<'info> {
    pub migration: MigrationAccounts<'info>,
    /// Token or Token-2022: one token program for each call.
    pub token_program: Interface<'info, TokenInterface>,
    // `remaining_accounts`: one writable account for each item (the token account or the mint);
    // then the optional event account.
}

/// What the program finds before an authority change.
#[cfg(feature = "program")]
enum Current {
    Authority(Option<Pubkey>),
    Skip(MigrationSkipReason),
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateTokenAuthorities<'info> {
    /// Moves token authorities that the v4 vault holds to the successor vault. An authority that the
    /// vault does not hold, or that does not exist, is skipped.
    pub fn multisig_migrate_token_authorities(
        ctx: Context<'info, Self>,
        args: MigrateTokenAuthoritiesArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let items = accounts.migration.begin(
            ctx.remaining_accounts,
            1,
            args.config_authority_vault_index,
        )?;
        require_eq!(
            items.accounts.len(),
            args.items.len(),
            MultisigError::MigrationInvalidAssetAccounts
        );
        let outcomes = items
            .accounts
            .iter()
            .zip(&args.items)
            .map(|(account, kind)| accounts.migrate_authority(account, *kind))
            .collect::<Result<Vec<_>>>()?;
        accounts.migration.emit(
            items.events,
            MigrationScope::TokenAuthorities,
            args.vault_index,
            &outcomes,
            args.memo,
        )
    }

    fn migrate_authority(
        &self,
        account: &AccountInfo<'info>,
        kind: TokenAuthorityKind,
    ) -> Result<MigrationOutcome> {
        let outcome = |result| MigrationOutcome {
            kind: MigrationAssetKind::TokenAuthority(kind),
            account: account.key(),
            result,
        };
        let source_vault = self.migration.source_vault.key();
        match self.current(account, kind) {
            Current::Skip(reason) => return Ok(outcome(skipped(reason))),
            Current::Authority(authority) if authority != Some(source_vault) => {
                return Ok(outcome(skipped(MigrationSkipReason::NotAuthority)))
            }
            Current::Authority(_) => {}
        }
        let new_authority = self.migration.vault.key();
        match authority_type(kind) {
            Some(authority_type) => token::set_authority(
                CpiContext::new(
                    self.token_program.key(),
                    SetAuthority {
                        current_authority: self.migration.source_vault.to_account_info(),
                        account_or_mint: account.clone(),
                    },
                ),
                authority_type,
                Some(new_authority),
            )?,
            None => {
                let new_authority = Some(new_authority)
                    .try_into()
                    .map_err(|_| error!(MultisigError::InvalidAccount))?;
                let instruction = update_authority(
                    &self.token_program.key(),
                    account.key,
                    &source_vault,
                    new_authority,
                );
                invoke(
                    &instruction,
                    &[
                        account.clone(),
                        self.migration.source_vault.to_account_info(),
                    ],
                )?;
            }
        }
        Ok(outcome(moved(0, false)))
    }

    /// The current holder of `kind` on `account`, or why there is nothing to move.
    fn current(&self, account: &AccountInfo<'info>, kind: TokenAuthorityKind) -> Current {
        let token_program = self.token_program.key();
        if *account.owner != token_program {
            return Current::Skip(MigrationSkipReason::Missing);
        }
        let Ok(data) = account.try_borrow_data() else {
            return Current::Skip(MigrationSkipReason::Missing);
        };
        match kind {
            TokenAuthorityKind::AccountOwner | TokenAuthorityKind::CloseAccount => {
                let Ok(state) = StateWithExtensions::<TokenAccount>::unpack(&data) else {
                    return Current::Skip(MigrationSkipReason::Missing);
                };
                if kind == TokenAuthorityKind::CloseAccount {
                    return Current::Authority(state.base.close_authority.into());
                }
                // An associated token account belongs to its owner by its address; Token-2022
                // associated token accounts also have `ImmutableOwner`.
                let associated = migration::get_associated_token_address(
                    &state.base.owner,
                    &state.base.mint,
                    &token_program,
                ) == *account.key;
                match associated || state.get_extension::<ImmutableOwner>().is_ok() {
                    true => Current::Skip(MigrationSkipReason::Unsupported),
                    false => Current::Authority(Some(state.base.owner)),
                }
            }
            _ => {
                let Ok(state) = StateWithExtensions::<Mint>::unpack(&data) else {
                    return Current::Skip(MigrationSkipReason::Missing);
                };
                mint_authority(&state, kind).map_or(
                    Current::Skip(MigrationSkipReason::Missing),
                    Current::Authority,
                )
            }
        }
    }
}

/// The holder of a mint authority; `None` if the mint does not have the extension.
#[cfg(feature = "program")]
pub(super) fn mint_authority(
    state: &StateWithExtensions<Mint>,
    kind: TokenAuthorityKind,
) -> Option<Option<Pubkey>> {
    use TokenAuthorityKind as K;
    match kind {
        K::MintTokens => Some(state.base.mint_authority.into()),
        K::FreezeAccount => Some(state.base.freeze_authority.into()),
        K::CloseMint => state
            .get_extension::<MintCloseAuthority>()
            .ok()
            .map(|e| e.close_authority.get()),
        K::TransferFeeConfig => state
            .get_extension::<TransferFeeConfig>()
            .ok()
            .map(|e| e.transfer_fee_config_authority.get()),
        K::WithheldWithdraw => state
            .get_extension::<TransferFeeConfig>()
            .ok()
            .map(|e| e.withdraw_withheld_authority.get()),
        K::InterestRate => state
            .get_extension::<InterestBearingConfig>()
            .ok()
            .map(|e| e.rate_authority.get()),
        K::PermanentDelegate => state
            .get_extension::<PermanentDelegate>()
            .ok()
            .map(|e| e.delegate.get()),
        K::ConfidentialTransferMint => state
            .get_extension::<ConfidentialTransferMint>()
            .ok()
            .map(|e| e.authority.get()),
        K::TransferHookProgramId => state
            .get_extension::<TransferHook>()
            .ok()
            .map(|e| e.authority.get()),
        K::ConfidentialTransferFeeConfig => state
            .get_extension::<ConfidentialTransferFeeConfig>()
            .ok()
            .map(|e| e.authority.get()),
        K::MetadataPointer => state
            .get_extension::<MetadataPointer>()
            .ok()
            .map(|e| e.authority.get()),
        K::GroupPointer => state
            .get_extension::<GroupPointer>()
            .ok()
            .map(|e| e.authority.get()),
        K::GroupMemberPointer => state
            .get_extension::<GroupMemberPointer>()
            .ok()
            .map(|e| e.authority.get()),
        K::ScaledUiAmount => state
            .get_extension::<ScaledUiAmountConfig>()
            .ok()
            .map(|e| e.authority.get()),
        K::Pause => state
            .get_extension::<PausableConfig>()
            .ok()
            .map(|e| e.authority.get()),
        K::PermissionedBurn => state
            .get_extension::<PermissionedBurnConfig>()
            .ok()
            .map(|e| e.authority.get()),
        K::MetadataUpdate => state
            .get_variable_len_extension::<TokenMetadata>()
            .ok()
            .map(|metadata| metadata.update_authority.get()),
        K::AccountOwner | K::CloseAccount => None,
    }
}

/// The token `SetAuthority` type of `kind`; `None` for the metadata update authority.
#[cfg(feature = "program")]
fn authority_type(kind: TokenAuthorityKind) -> Option<AuthorityType> {
    use TokenAuthorityKind as K;
    Some(match kind {
        K::MintTokens => AuthorityType::MintTokens,
        K::FreezeAccount => AuthorityType::FreezeAccount,
        K::AccountOwner => AuthorityType::AccountOwner,
        K::CloseAccount => AuthorityType::CloseAccount,
        K::TransferFeeConfig => AuthorityType::TransferFeeConfig,
        K::WithheldWithdraw => AuthorityType::WithheldWithdraw,
        K::CloseMint => AuthorityType::CloseMint,
        K::InterestRate => AuthorityType::InterestRate,
        K::PermanentDelegate => AuthorityType::PermanentDelegate,
        K::ConfidentialTransferMint => AuthorityType::ConfidentialTransferMint,
        K::TransferHookProgramId => AuthorityType::TransferHookProgramId,
        K::ConfidentialTransferFeeConfig => AuthorityType::ConfidentialTransferFeeConfig,
        K::MetadataPointer => AuthorityType::MetadataPointer,
        K::GroupPointer => AuthorityType::GroupPointer,
        K::GroupMemberPointer => AuthorityType::GroupMemberPointer,
        K::ScaledUiAmount => AuthorityType::ScaledUiAmount,
        K::Pause => AuthorityType::Pause,
        K::PermissionedBurn => AuthorityType::PermissionedBurn,
        K::MetadataUpdate => return None,
    })
}
