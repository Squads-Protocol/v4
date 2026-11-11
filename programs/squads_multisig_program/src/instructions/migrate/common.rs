#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(feature = "program")]
use crate::events::{
    self, LogAuthority, MigrationEvent, MigrationOutcome, MigrationResult, MigrationScope,
    MigrationSkipReason, MigrationSourceVault, MultisigEvent,
};
#[cfg(feature = "program")]
use crate::migration;
#[cfg(feature = "program")]
use crate::migration::v3::{self, LEGACY_V3_PROGRAM_ID, MAX_AUTHORITY_INDEX};
#[cfg(not(feature = "program"))]
use crate::prelude::*;
#[cfg(feature = "program")]
use crate::state::*;
#[cfg(feature = "program")]
use crate::LEGACY_V4_PROGRAM_ID;

/// Arguments of `multisig_migrate_stakes`, `multisig_migrate_vote_accounts` and
/// `multisig_migrate_programs`. The items are the remaining accounts, one account each.
#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateAuthoritiesArgs {
    /// The v4 vault index. Every migrate instruction starts its arguments with this field.
    pub vault_index: u8,
    /// Set if the v4 `config_authority` is the v4 vault with this index (see `multisig_create_from`).
    pub config_authority_vault_index: Option<u8>,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

/// The accounts of every migrate instruction. Each instruction's arguments start with
/// `vault_index`, which the seeds read.
#[cfg(feature = "program")]
#[derive(Accounts)]
#[instruction(vault_index: u8)]
pub struct MigrationAccounts<'info> {
    /// The v4 multisig.
    /// CHECK: the owner here; the discriminator and layout when it is decoded.
    #[account(owner = LEGACY_V4_PROGRAM_ID @ MultisigError::IllegalAccountOwner)]
    pub source_multisig: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            source_multisig.key().as_ref(),
            SEED_VAULT,
            &vault_index.to_le_bytes(),
        ],
        bump,
        seeds::program = LEGACY_V4_PROGRAM_ID,
    )]
    /// The v4 vault. Only v4 signs for it, in a vault transaction that the v4 members approved.
    pub source_vault: Signer<'info>,

    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, source_multisig.key().as_ref()],
        bump = multisig.bump,
        constraint = multisig.create_key == source_multisig.key() @ MultisigError::InvalidAccount,
    )]
    /// The successor of `source_multisig`.
    pub multisig: Box<Account<'info, Multisig>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_VAULT,
            &vault_index.to_le_bytes(),
        ],
        bump
    )]
    /// The successor vault with the same index: the destination of every asset.
    /// CHECK: the seeds.
    pub vault: UncheckedAccount<'info>,
}

/// One migrate call after its lineage and governance checks: the source vault that signs, the
/// successor vault that receives every asset, and the item accounts. Both lineages build it, and
/// the asset movers read only it.
#[cfg(feature = "program")]
pub struct MigrationCall<'a, 'info> {
    pub source_multisig: Pubkey,
    pub source_vault: AccountInfo<'info>,
    pub multisig: &'a Account<'info, Multisig>,
    pub vault: AccountInfo<'info>,
    pub source: MigrationSourceVault,
    /// The index of the successor `vault`.
    pub vault_index: u8,
    pub items: &'a [AccountInfo<'info>],
    pub events: bool,
}

#[cfg(feature = "program")]
impl MigrationCall<'_, '_> {
    /// Emits the `Migration` event of this call, if events are on.
    pub fn emit(
        &self,
        scope: MigrationScope,
        outcomes: &[MigrationOutcome],
        memo: Option<String>,
    ) -> Result<()> {
        let multisig = self.multisig;
        events::emit(
            self.events,
            || LogAuthority::multisig(multisig),
            || {
                vec![MultisigEvent::Migration(MigrationEvent {
                    scope,
                    multisig: multisig.key(),
                    source_multisig: self.source_multisig,
                    source: self.source,
                    vault_index: self.vault_index,
                    source_vault: self.source_vault.key(),
                    vault: self.vault.key(),
                    outcomes: Cow::Borrowed(outcomes),
                    memo,
                })]
            },
        )
    }
}

/// Splits off the optional trailing event account, then checks that the rest holds whole items of
/// `per_item` accounts (0: the call has no items), at most `MAX_MIGRATE_ITEMS`.
#[cfg(feature = "program")]
fn split_items<'a, 'info>(
    remaining: &'a [AccountInfo<'info>],
    per_item: usize,
) -> Result<(&'a [AccountInfo<'info>], bool)> {
    let (accounts, events) = match remaining.split_last() {
        Some((last, rest)) if *last.key == crate::ID => (rest, true),
        _ => (remaining, false),
    };
    migration::migrate_item_count(accounts.len(), per_item)?;
    Ok((accounts, events))
}

#[cfg(feature = "program")]
impl<'info> MigrationAccounts<'info> {
    /// Checks the governance, then splits the remaining accounts into items (`split_items`).
    pub fn begin<'a>(
        &'a self,
        remaining: &'a [AccountInfo<'info>],
        per_item: usize,
        vault_index: u8,
        config_authority_vault_index: Option<u8>,
    ) -> Result<MigrationCall<'a, 'info>> {
        let source = migration::load_v4_multisig(&self.source_multisig)?;
        migration::check_same_governance(
            &source,
            &self.multisig,
            &self.source_multisig.key(),
            &self.multisig.key(),
            config_authority_vault_index,
            None,
        )?;
        let (items, events) = split_items(remaining, per_item)?;
        Ok(MigrationCall {
            source_multisig: self.source_multisig.key(),
            source_vault: self.source_vault.to_account_info(),
            multisig: &self.multisig,
            vault: self.vault.to_account_info(),
            source: MigrationSourceVault::V4 { vault_index },
            vault_index,
            items,
            events,
        })
    }
}

/// The accounts of every v3 migrate instruction. Each instruction's arguments start with
/// `authority_index` (1 to 256), which the seeds read; the successor vault is `authority_index - 1`.
#[cfg(feature = "program")]
#[derive(Accounts)]
#[instruction(authority_index: u32)]
pub struct MigrationAccountsV3<'info> {
    // The range check runs here, before the `vault` seeds use `authority_index - 1`.
    #[account(
        owner = LEGACY_V3_PROGRAM_ID @ MultisigError::IllegalAccountOwner,
        constraint = (1..=MAX_AUTHORITY_INDEX).contains(&authority_index)
            @ MultisigError::MigrationInvalidAuthorityIndex,
    )]
    /// The v3 multisig.
    /// CHECK: the owner here; the discriminator and layout when it is decoded.
    pub source_multisig: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [
            v3::SEED_SQUAD,
            source_multisig.key().as_ref(),
            &authority_index.to_le_bytes(),
            v3::SEED_AUTHORITY,
        ],
        bump,
        seeds::program = LEGACY_V3_PROGRAM_ID,
    )]
    /// The v3 authority. Only v3 signs for it, in a v3 transaction that the v3 members approved.
    pub source_vault: Signer<'info>,

    #[account(
        seeds = [SEED_PREFIX, SEED_MULTISIG, source_multisig.key().as_ref()],
        bump = multisig.bump,
        constraint = multisig.create_key == source_multisig.key() @ MultisigError::InvalidAccount,
    )]
    /// The successor of `source_multisig`.
    pub multisig: Box<Account<'info, Multisig>>,

    #[account(
        mut,
        seeds = [
            SEED_PREFIX,
            multisig.key().as_ref(),
            SEED_VAULT,
            &v3::v3_vault_seed(authority_index),
        ],
        bump
    )]
    /// The successor vault `authority_index - 1`: the destination of every asset.
    /// CHECK: the seeds.
    pub vault: UncheckedAccount<'info>,
}

#[cfg(feature = "program")]
impl<'info> MigrationAccountsV3<'info> {
    /// Checks the governance, then splits the remaining accounts into items (`split_items`).
    pub fn begin<'a>(
        &'a self,
        remaining: &'a [AccountInfo<'info>],
        per_item: usize,
        authority_index: u32,
    ) -> Result<MigrationCall<'a, 'info>> {
        let source = v3::load_v3_multisig(&self.source_multisig)?;
        v3::check_same_governance_v3(&source, &self.multisig)?;
        let (items, events) = split_items(remaining, per_item)?;
        Ok(MigrationCall {
            source_multisig: self.source_multisig.key(),
            source_vault: self.source_vault.to_account_info(),
            multisig: &self.multisig,
            vault: self.vault.to_account_info(),
            source: MigrationSourceVault::V3 { authority_index },
            vault_index: v3::v3_vault_index(authority_index)?,
            items,
            events,
        })
    }
}

#[cfg(feature = "program")]
pub(crate) fn moved(amount: u64, closed: bool) -> MigrationResult {
    MigrationResult::Moved { amount, closed }
}

#[cfg(feature = "program")]
pub(crate) fn skipped(reason: MigrationSkipReason) -> MigrationResult {
    MigrationResult::Skipped(reason)
}
