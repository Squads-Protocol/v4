#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_lang::system_program;

#[cfg(feature = "program")]
use super::common::*;
#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(feature = "program")]
use crate::events::{MigrationAssetKind, MigrationOutcome, MigrationScope, MigrationSkipReason};
#[cfg(not(feature = "program"))]
use crate::prelude::*;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateSolArgs {
    /// The v4 vault index. Every migrate instruction starts its arguments with this field.
    pub vault_index: u8,
    /// Set if the v4 `config_authority` is the v4 vault with this index (see `multisig_create_from`).
    pub config_authority_vault_index: Option<u8>,
    /// Lamports to leave in the v4 vault: 0, or at least the rent-exempt minimum.
    pub keep: u64,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateSol<'info> {
    pub migration: MigrationAccounts<'info>,
    pub system_program: Program<'info, System>,
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateSol<'info> {
    /// Moves the SOL of a v4 vault, minus `keep`, to the successor vault.
    pub fn multisig_migrate_sol(ctx: Context<'info, Self>, args: MigrateSolArgs) -> Result<()> {
        let migration = &ctx.accounts.migration;
        let items =
            migration.begin(ctx.remaining_accounts, 0, args.config_authority_vault_index)?;
        let rent = Rent::get()?.minimum_balance(0);
        require!(
            args.keep == 0 || args.keep >= rent,
            MultisigError::MigrationInvalidAmount
        );
        let lamports = migration.source_vault.lamports().saturating_sub(args.keep);
        // An empty destination needs at least the rent minimum.
        let result = match lamports == 0 || (migration.vault.lamports() == 0 && lamports < rent) {
            true => skipped(MigrationSkipReason::Empty),
            false => {
                system_program::transfer(
                    CpiContext::new(
                        ctx.accounts.system_program.key(),
                        system_program::Transfer {
                            from: migration.source_vault.to_account_info(),
                            to: migration.vault.to_account_info(),
                        },
                    ),
                    lamports,
                )?;
                moved(lamports, false)
            }
        };
        let outcome = MigrationOutcome {
            kind: MigrationAssetKind::Sol,
            account: migration.source_vault.key(),
            result,
        };
        migration.emit(
            items.events,
            MigrationScope::Sol,
            args.vault_index,
            &[outcome],
            args.memo,
        )
    }
}
