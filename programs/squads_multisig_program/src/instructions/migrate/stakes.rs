#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_lang::solana_program::instruction::Instruction;
#[cfg(feature = "program")]
use anchor_lang::solana_program::program::invoke;

#[cfg(feature = "program")]
use super::common::*;
#[cfg(feature = "program")]
use crate::events::{
    MigrationAssetKind, MigrationOutcome, MigrationResult, MigrationScope, MigrationSkipReason,
};
#[cfg(feature = "program")]
use crate::migration::{CLOCK_SYSVAR_ID, STAKE_PROGRAM_ID};

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateStakes<'info> {
    pub migration: MigrationAccounts<'info>,
    /// CHECK: the address.
    #[account(address = CLOCK_SYSVAR_ID)]
    pub clock: UncheckedAccount<'info>,
    /// CHECK: the address.
    #[account(address = STAKE_PROGRAM_ID)]
    pub stake_program: UncheckedAccount<'info>,
    // `remaining_accounts`: one writable stake account for each item; then the optional event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateStakes<'info> {
    /// Moves the staker, withdrawer and lockup custodian roles that the v4 vault holds to the
    /// successor vault. The stake stays delegated. A withdrawer under a lockup is skipped.
    pub fn multisig_migrate_stakes(
        ctx: Context<'info, Self>,
        args: MigrateAuthoritiesArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let migration = accounts.migration.begin(
            ctx.remaining_accounts,
            1,
            args.vault_index,
            args.config_authority_vault_index,
        )?;
        let outcomes = migrate_stakes(&migration, &accounts.clock.to_account_info())?;
        migration.emit(MigrationScope::Stakes, &outcomes, args.memo)
    }
}

/// Moves the stake roles of each item account (a stake account) of `migration`: three outcomes
/// each (staker, withdrawer, custodian).
#[cfg(feature = "program")]
pub(crate) fn migrate_stakes<'info>(
    migration: &MigrationCall<'_, 'info>,
    clock: &AccountInfo<'info>,
) -> Result<Vec<MigrationOutcome>> {
    let stake = StakeMover { migration, clock };
    Ok(migration
        .items
        .iter()
        .map(|account| stake.migrate(account))
        .collect::<Result<Vec<_>>>()?
        .concat())
}

/// The source vault, the successor vault and the clock sysvar of one stake migration.
#[cfg(feature = "program")]
struct StakeMover<'a, 'b, 'info> {
    migration: &'a MigrationCall<'b, 'info>,
    clock: &'a AccountInfo<'info>,
}

#[cfg(feature = "program")]
impl<'info> StakeMover<'_, '_, 'info> {
    fn migrate(&self, stake: &AccountInfo<'info>) -> Result<Vec<MigrationOutcome>> {
        let outcomes = |[staker, withdrawer, custodian]: [MigrationResult; 3]| {
            [
                (MigrationAssetKind::StakeStaker, staker),
                (MigrationAssetKind::StakeWithdrawer, withdrawer),
                (MigrationAssetKind::StakeCustodian, custodian),
            ]
            .map(|(kind, result)| MigrationOutcome {
                kind,
                account: stake.key(),
                result,
            })
            .to_vec()
        };
        let meta = match *stake.owner == STAKE_PROGRAM_ID {
            true => stake_meta(&stake.try_borrow_data()?),
            false => None,
        };
        let Some(meta) = meta else {
            return Ok(outcomes([skipped(MigrationSkipReason::Missing); 3]));
        };
        let source_vault = self.migration.source_vault.key();
        let now = Clock::get()?;
        let in_force =
            meta.lockup_unix_timestamp > now.unix_timestamp || meta.lockup_epoch > now.epoch;
        let is_custodian = meta.custodian == source_vault;
        let is_withdrawer = meta.withdrawer == source_vault;

        let staker = match meta.staker == source_vault {
            true => {
                self.authorize(stake, StakeRole::Staker, false)?;
                moved(0, false)
            }
            false => skipped(MigrationSkipReason::NotAuthority),
        };
        // `SetLockup` needs the custodian while the lockup is in force, else the withdrawer. The
        // successor cannot sign, so the custodian moves before the withdrawer when no lockup is in force.
        let custodian_first = !in_force && is_custodian && is_withdrawer;
        if custodian_first {
            self.set_custodian(stake)?;
        }
        // The vault as custodian signs too, so its own lockup does not block it.
        let withdrawer = match (is_withdrawer, in_force && !is_custodian) {
            (false, _) => skipped(MigrationSkipReason::NotAuthority),
            (true, true) => skipped(MigrationSkipReason::Locked),
            (true, false) => {
                self.authorize(
                    stake,
                    StakeRole::Withdrawer,
                    is_custodian && !custodian_first,
                )?;
                moved(0, false)
            }
        };
        let custodian = match (is_custodian, in_force || custodian_first) {
            (false, _) | (true, false) => skipped(MigrationSkipReason::NotAuthority),
            (true, true) => {
                if !custodian_first {
                    self.set_custodian(stake)?;
                }
                moved(0, false)
            }
        };
        Ok(outcomes([staker, withdrawer, custodian]))
    }

    /// Stake `SetLockup` (bincode: variant 6, `LockupArgs { None, None, Some(vault) }`), signed by
    /// the source vault as the custodian (lockup in force) or as the withdrawer (no lockup in force).
    fn set_custodian(&self, stake: &AccountInfo<'info>) -> Result<()> {
        let source_vault = self.migration.source_vault.clone();
        let data = [
            6u32.to_le_bytes().as_slice(),
            &[0, 0, 1],
            self.migration.vault.key.as_ref(),
        ]
        .concat();
        invoke(
            &Instruction {
                program_id: STAKE_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(stake.key(), false),
                    AccountMeta::new_readonly(source_vault.key(), true),
                ],
                data,
            },
            &[stake.clone(), source_vault],
        )
        .map_err(Into::into)
    }

    /// Stake `Authorize` (bincode: variant 1, new authority, role), signed by the source vault. The
    /// unchecked variant: the new authority cannot sign during the source execution, and the program
    /// derives it.
    fn authorize(
        &self,
        stake: &AccountInfo<'info>,
        role: StakeRole,
        custodian: bool,
    ) -> Result<()> {
        let source_vault = self.migration.source_vault.clone();
        let data = [
            1u32.to_le_bytes().as_slice(),
            self.migration.vault.key.as_ref(),
            (role as u32).to_le_bytes().as_slice(),
        ]
        .concat();
        let signer = AccountMeta::new_readonly(source_vault.key(), true);
        let accounts = [
            AccountMeta::new(stake.key(), false),
            AccountMeta::new_readonly(self.clock.key(), false),
            signer.clone(),
        ]
        .into_iter()
        .chain(custodian.then_some(signer))
        .collect();
        invoke(
            &Instruction {
                program_id: STAKE_PROGRAM_ID,
                accounts,
                data,
            },
            &[stake.clone(), self.clock.clone(), source_vault],
        )
        .map_err(Into::into)
    }
}

#[cfg(feature = "program")]
#[derive(Clone, Copy)]
enum StakeRole {
    Staker = 0,
    Withdrawer = 1,
}

#[cfg(feature = "program")]
pub(super) struct StakeMeta {
    pub(super) staker: Pubkey,
    pub(super) withdrawer: Pubkey,
    pub(super) lockup_unix_timestamp: i64,
    pub(super) lockup_epoch: u64,
    pub(super) custodian: Pubkey,
}

/// The `Meta` of an `Initialized` (1) or `Stake` (2) stake account. Bincode layout: tag (u32),
/// rent reserve (u64), staker, withdrawer, lockup timestamp (i64), lockup epoch (u64), custodian.
#[cfg(feature = "program")]
pub(super) fn stake_meta(data: &[u8]) -> Option<StakeMeta> {
    let tag = u32::from_le_bytes(data.get(..4)?.try_into().ok()?);
    if !matches!(tag, 1 | 2) {
        return None;
    }
    let key = |range: std::ops::Range<usize>| Pubkey::try_from(data.get(range)?).ok();
    let bytes8 = |start: usize| -> Option<[u8; 8]> { data.get(start..start + 8)?.try_into().ok() };
    Some(StakeMeta {
        staker: key(12..44)?,
        withdrawer: key(44..76)?,
        lockup_unix_timestamp: i64::from_le_bytes(bytes8(76)?),
        lockup_epoch: u64::from_le_bytes(bytes8(84)?),
        custodian: key(92..124)?,
    })
}
