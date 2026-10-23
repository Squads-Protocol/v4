#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_lang::solana_program::instruction::Instruction;
#[cfg(feature = "program")]
use anchor_lang::solana_program::program::invoke;

#[cfg(feature = "program")]
use super::common::*;
#[cfg(feature = "program")]
use crate::events::{MigrationAssetKind, MigrationOutcome, MigrationScope, MigrationSkipReason};
#[cfg(feature = "program")]
use crate::migration::BPF_LOADER_UPGRADEABLE_ID;

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigratePrograms<'info> {
    pub migration: MigrationAccounts<'info>,
    /// CHECK: the address.
    #[account(address = BPF_LOADER_UPGRADEABLE_ID)]
    pub bpf_loader_upgradeable: UncheckedAccount<'info>,
    // `remaining_accounts`: one writable program data account for each item; then the optional
    // event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigratePrograms<'info> {
    /// Moves the upgrade authority of loader-v3 programs from the v4 vault to the successor vault.
    ///
    /// Loader-v4 programs are not supported: their `TransferAuthority` needs the new authority to
    /// sign, and the successor vault cannot sign while v4 executes this call.
    pub fn multisig_migrate_programs(
        ctx: Context<'info, Self>,
        args: MigrateAuthoritiesArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let items = accounts.migration.begin(
            ctx.remaining_accounts,
            1,
            args.config_authority_vault_index,
        )?;
        let outcomes = items
            .accounts
            .iter()
            .map(|program_data| accounts.migrate_upgrade_authority(program_data))
            .collect::<Result<Vec<_>>>()?;
        accounts.migration.emit(
            items.events,
            MigrationScope::Programs,
            args.vault_index,
            &outcomes,
            args.memo,
        )
    }

    fn migrate_upgrade_authority(
        &self,
        program_data: &AccountInfo<'info>,
    ) -> Result<MigrationOutcome> {
        let outcome = |result| MigrationOutcome {
            kind: MigrationAssetKind::UpgradeAuthority,
            account: program_data.key(),
            result,
        };
        let authority = match *program_data.owner == BPF_LOADER_UPGRADEABLE_ID {
            true => program_data_authority(&program_data.try_borrow_data()?),
            false => None,
        };
        let source_vault = self.migration.source_vault.to_account_info();
        match authority {
            None => return Ok(outcome(skipped(MigrationSkipReason::Missing))),
            Some(authority) if authority != Some(source_vault.key()) => {
                return Ok(outcome(skipped(MigrationSkipReason::NotAuthority)))
            }
            Some(_) => {}
        }
        // `SetAuthority` (bincode variant 4), not the checked variant: the new authority cannot sign
        // during v4 execution, and the program derives it.
        let vault = self.migration.vault.to_account_info();
        invoke(
            &Instruction {
                program_id: BPF_LOADER_UPGRADEABLE_ID,
                accounts: vec![
                    AccountMeta::new(program_data.key(), false),
                    AccountMeta::new_readonly(source_vault.key(), true),
                    AccountMeta::new_readonly(vault.key(), false),
                ],
                data: vec![4, 0, 0, 0],
            },
            &[
                program_data.clone(),
                source_vault,
                vault,
                self.bpf_loader_upgradeable.to_account_info(),
            ],
        )?;
        Ok(outcome(moved(0, false)))
    }
}

/// The upgrade authority of a loader-v3 `ProgramData` account: bincode tag `3` (u32), slot (u64),
/// then `Option<Pubkey>`. `None` if the data is not `ProgramData`.
#[cfg(feature = "program")]
pub(super) fn program_data_authority(data: &[u8]) -> Option<Option<Pubkey>> {
    if data.get(..4)? != 3u32.to_le_bytes() {
        return None;
    }
    match data.get(12)? {
        0 => Some(None),
        1 => Some(Some(Pubkey::try_from(data.get(13..45)?).ok()?)),
        _ => None,
    }
}
