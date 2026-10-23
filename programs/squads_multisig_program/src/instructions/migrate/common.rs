#[cfg(feature = "program")]
use std::borrow::Cow;

#[cfg(feature = "program")]
use anchor_lang::prelude::*;

#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(feature = "program")]
use crate::events::{
    self, LogAuthority, MigrationEvent, MigrationOutcome, MigrationResult, MigrationScope,
    MigrationSkipReason, MultisigEvent,
};
#[cfg(feature = "program")]
use crate::migration::{self, MAX_MIGRATE_ITEMS};
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

/// The item accounts of one migrate call, and whether events are on.
#[cfg(feature = "program")]
pub struct MigrationItems<'a, 'info> {
    pub accounts: &'a [AccountInfo<'info>],
    pub events: bool,
}

#[cfg(feature = "program")]
impl<'info> MigrationAccounts<'info> {
    /// Checks the governance, then splits off the optional trailing event account. Each item has
    /// `per_item` accounts (0: the call has no items).
    pub fn begin<'a>(
        &self,
        remaining: &'a [AccountInfo<'info>],
        per_item: usize,
        config_authority_vault_index: Option<u8>,
    ) -> Result<MigrationItems<'a, 'info>> {
        let source = migration::load_v4_multisig(&self.source_multisig)?;
        migration::check_same_governance(
            &source,
            &self.multisig,
            &self.source_multisig.key(),
            &self.multisig.key(),
            config_authority_vault_index,
            None,
        )?;
        let (accounts, events) = match remaining.split_last() {
            Some((last, rest)) if *last.key == crate::ID => (rest, true),
            _ => (remaining, false),
        };
        let (whole, items) = match per_item {
            0 => (accounts.is_empty(), 0),
            n => (accounts.len() % n == 0, accounts.len() / n),
        };
        require!(whole, MultisigError::MigrationInvalidAssetAccounts);
        require!(
            items <= MAX_MIGRATE_ITEMS,
            MultisigError::InvalidInstructionArgs
        );
        Ok(MigrationItems { accounts, events })
    }

    /// Emits the `Migration` event of this call, if events are on.
    pub fn emit(
        &self,
        events_enabled: bool,
        scope: MigrationScope,
        vault_index: u8,
        outcomes: &[MigrationOutcome],
        memo: Option<String>,
    ) -> Result<()> {
        let multisig = &self.multisig;
        events::emit(
            events_enabled,
            || LogAuthority::multisig(multisig),
            || {
                vec![MultisigEvent::Migration(MigrationEvent {
                    scope,
                    multisig: multisig.key(),
                    source_multisig: self.source_multisig.key(),
                    vault_index,
                    source_vault: self.source_vault.key(),
                    vault: self.vault.key(),
                    outcomes: Cow::Borrowed(outcomes),
                    memo,
                })]
            },
        )
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
