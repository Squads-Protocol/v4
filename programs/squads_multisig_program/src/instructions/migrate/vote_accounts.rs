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
use crate::migration::{CLOCK_SYSVAR_ID, VOTE_PROGRAM_ID};

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateVoteAccounts<'info> {
    pub migration: MigrationAccounts<'info>,
    /// CHECK: the address.
    #[account(address = CLOCK_SYSVAR_ID)]
    pub clock: UncheckedAccount<'info>,
    /// CHECK: the address.
    #[account(address = VOTE_PROGRAM_ID)]
    pub vote_program: UncheckedAccount<'info>,
    // `remaining_accounts`: one writable vote account for each item; then the optional event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateVoteAccounts<'info> {
    /// Moves the withdrawer of vote accounts to the successor vault. The authorized voter (a Vote
    /// program role) stays: its changes have per-epoch rules, and the withdrawer can change it later.
    pub fn multisig_migrate_vote_accounts(
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
            .map(|vote| accounts.migrate_withdrawer(vote))
            .collect::<Result<Vec<_>>>()?;
        accounts.migration.emit(
            items.events,
            MigrationScope::VoteAccounts,
            args.vault_index,
            &outcomes,
            args.memo,
        )
    }

    fn migrate_withdrawer(&self, vote: &AccountInfo<'info>) -> Result<MigrationOutcome> {
        let outcome = |result| MigrationOutcome {
            kind: MigrationAssetKind::VoteWithdrawer,
            account: vote.key(),
            result,
        };
        let withdrawer = match *vote.owner == VOTE_PROGRAM_ID {
            true => vote_withdrawer(&vote.try_borrow_data()?),
            false => None,
        };
        let source_vault = self.migration.source_vault.to_account_info();
        match withdrawer {
            None => return Ok(outcome(skipped(MigrationSkipReason::Missing))),
            Some(withdrawer) if withdrawer != source_vault.key() => {
                return Ok(outcome(skipped(MigrationSkipReason::NotAuthority)))
            }
            Some(_) => {}
        }
        // Vote `Authorize` (bincode: variant 1, new authority, `VoteAuthorize::Withdrawer` = 1). The
        // unchecked variant: the new authority cannot sign during v4 execution.
        let data = [
            1u32.to_le_bytes().as_slice(),
            self.migration.vault.key.as_ref(),
            1u32.to_le_bytes().as_slice(),
        ]
        .concat();
        invoke(
            &Instruction {
                program_id: VOTE_PROGRAM_ID,
                accounts: vec![
                    AccountMeta::new(vote.key(), false),
                    AccountMeta::new_readonly(self.clock.key(), false),
                    AccountMeta::new_readonly(source_vault.key(), true),
                ],
                data,
            },
            &[vote.clone(), self.clock.to_account_info(), source_vault],
        )?;
        Ok(outcome(moved(0, false)))
    }
}

/// The authorized withdrawer of a vote account. `VoteStateVersions` tags 1 (`V1_14_11`), 2 (`V3`) and
/// 3 (`V4`) store it after the tag (u32) and `node_pubkey`; tag 0 (`Uninitialized`) has none.
#[cfg(feature = "program")]
pub(super) fn vote_withdrawer(data: &[u8]) -> Option<Pubkey> {
    let tag = u32::from_le_bytes(data.get(..4)?.try_into().ok()?);
    match tag {
        1..=3 => Pubkey::try_from(data.get(36..68)?).ok(),
        _ => None,
    }
}
