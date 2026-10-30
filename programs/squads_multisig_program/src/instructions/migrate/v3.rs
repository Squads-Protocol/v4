//! Migration from v3: one instruction for each asset class, as for v4. Each runs inside a v3
//! transaction, checks the lineage and the governance (`MigrationAccountsV3`), and calls the shared
//! mover of its class. Assets move only to the successor vault `authority_index - 1`.

#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_spl::token_interface::TokenInterface;

#[cfg(feature = "program")]
use super::common::*;
#[cfg(feature = "program")]
use super::programs::migrate_programs;
#[cfg(feature = "program")]
use super::sol::migrate_sol;
#[cfg(feature = "program")]
use super::stakes::migrate_stakes;
#[cfg(feature = "program")]
use super::token_authorities::migrate_token_authorities;
use super::token_authorities::TokenAuthorityKind;
#[cfg(feature = "program")]
use super::tokens::{migrate_tokens, TokenPrograms, MIGRATE_TOKEN_ACCOUNTS};
#[cfg(feature = "program")]
use super::vote_accounts::migrate_vote_accounts;
#[cfg(feature = "program")]
use crate::events::MigrationScope;
#[cfg(feature = "program")]
use crate::migration::{
    ASSOCIATED_TOKEN_PROGRAM_ID, BPF_LOADER_UPGRADEABLE_ID, CLOCK_SYSVAR_ID, STAKE_PROGRAM_ID,
    VOTE_PROGRAM_ID,
};
#[cfg(not(feature = "program"))]
use crate::prelude::*;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateV3SolArgs {
    /// The v3 authority index (1 to 256). Every v3 migrate instruction starts with this field.
    pub authority_index: u32,
    /// Lamports to leave in the v3 authority: 0, or at least the rent-exempt minimum.
    pub keep: u64,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateV3TokensArgs {
    /// The v3 authority index (1 to 256). Every v3 migrate instruction starts with this field.
    pub authority_index: u32,
    /// Close each source token account after the transfer. Its rent goes to the successor vault.
    pub close_source: bool,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateV3TokenAuthoritiesArgs {
    /// The v3 authority index (1 to 256). Every v3 migrate instruction starts with this field.
    pub authority_index: u32,
    /// One authority for each remaining account (the token account or the mint), in order.
    pub items: Vec<TokenAuthorityKind>,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

/// Arguments of `multisig_migrate_v3_stakes`, `multisig_migrate_v3_vote_accounts` and
/// `multisig_migrate_v3_programs`. The items are the remaining accounts, one account each.
#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateV3AuthoritiesArgs {
    /// The v3 authority index (1 to 256). Every v3 migrate instruction starts with this field.
    pub authority_index: u32,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateV3Sol<'info> {
    pub migration: MigrationAccountsV3<'info>,
    pub system_program: Program<'info, System>,
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateV3Sol<'info> {
    /// Moves the SOL of a v3 authority, minus `keep`, to the successor vault.
    pub fn multisig_migrate_v3_sol(
        ctx: Context<'info, Self>,
        args: MigrateV3SolArgs,
    ) -> Result<()> {
        let migration =
            ctx.accounts
                .migration
                .begin(ctx.remaining_accounts, 0, args.authority_index)?;
        let outcome = migrate_sol(&migration, &ctx.accounts.system_program, args.keep)?;
        migration.emit(MigrationScope::Sol, &[outcome], args.memo)
    }
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateV3Tokens<'info> {
    pub migration: MigrationAccountsV3<'info>,
    /// Token or Token-2022: one token program for each call.
    pub token_program: Interface<'info, TokenInterface>,
    /// CHECK: the address.
    #[account(address = ASSOCIATED_TOKEN_PROGRAM_ID)]
    pub associated_token_program: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    // `remaining_accounts`: for each token, the source token account (writable), the mint and the
    // destination (writable); then the optional event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateV3Tokens<'info> {
    /// Moves the whole balance of each token account at execution time to the successor vault's
    /// associated token account. A token with nothing to move is skipped.
    pub fn multisig_migrate_v3_tokens(
        ctx: Context<'info, Self>,
        args: MigrateV3TokensArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let migration = accounts.migration.begin(
            ctx.remaining_accounts,
            MIGRATE_TOKEN_ACCOUNTS,
            args.authority_index,
        )?;
        let programs = TokenPrograms {
            token: accounts.token_program.to_account_info(),
            associated_token: accounts.associated_token_program.to_account_info(),
            system: accounts.system_program.to_account_info(),
        };
        let outcomes = migrate_tokens(&migration, &programs, args.close_source)?;
        migration.emit(MigrationScope::Tokens, &outcomes, args.memo)
    }
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateV3TokenAuthorities<'info> {
    pub migration: MigrationAccountsV3<'info>,
    /// Token or Token-2022: one token program for each call.
    pub token_program: Interface<'info, TokenInterface>,
    // `remaining_accounts`: one writable account for each item (the token account or the mint);
    // then the optional event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateV3TokenAuthorities<'info> {
    /// Moves token authorities that the v3 authority holds to the successor vault. An authority
    /// that it does not hold, or that does not exist, is skipped.
    pub fn multisig_migrate_v3_token_authorities(
        ctx: Context<'info, Self>,
        args: MigrateV3TokenAuthoritiesArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let migration =
            accounts
                .migration
                .begin(ctx.remaining_accounts, 1, args.authority_index)?;
        let outcomes = migrate_token_authorities(
            &migration,
            &accounts.token_program.to_account_info(),
            &args.items,
        )?;
        migration.emit(MigrationScope::TokenAuthorities, &outcomes, args.memo)
    }
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateV3Stakes<'info> {
    pub migration: MigrationAccountsV3<'info>,
    /// CHECK: the address.
    #[account(address = CLOCK_SYSVAR_ID)]
    pub clock: UncheckedAccount<'info>,
    /// CHECK: the address.
    #[account(address = STAKE_PROGRAM_ID)]
    pub stake_program: UncheckedAccount<'info>,
    // `remaining_accounts`: one writable stake account for each item; then the optional event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateV3Stakes<'info> {
    /// Moves the staker, withdrawer and lockup custodian roles that the v3 authority holds to the
    /// successor vault. The stake stays delegated. A withdrawer under a lockup is skipped.
    pub fn multisig_migrate_v3_stakes(
        ctx: Context<'info, Self>,
        args: MigrateV3AuthoritiesArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let migration =
            accounts
                .migration
                .begin(ctx.remaining_accounts, 1, args.authority_index)?;
        let outcomes = migrate_stakes(&migration, &accounts.clock.to_account_info())?;
        migration.emit(MigrationScope::Stakes, &outcomes, args.memo)
    }
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateV3VoteAccounts<'info> {
    pub migration: MigrationAccountsV3<'info>,
    /// CHECK: the address.
    #[account(address = CLOCK_SYSVAR_ID)]
    pub clock: UncheckedAccount<'info>,
    /// CHECK: the address.
    #[account(address = VOTE_PROGRAM_ID)]
    pub vote_program: UncheckedAccount<'info>,
    // `remaining_accounts`: one writable vote account for each item; then the optional event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateV3VoteAccounts<'info> {
    /// Moves the withdrawer of vote accounts to the successor vault. The authorized voter stays.
    pub fn multisig_migrate_v3_vote_accounts(
        ctx: Context<'info, Self>,
        args: MigrateV3AuthoritiesArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let migration =
            accounts
                .migration
                .begin(ctx.remaining_accounts, 1, args.authority_index)?;
        let outcomes = migrate_vote_accounts(&migration, &accounts.clock.to_account_info())?;
        migration.emit(MigrationScope::VoteAccounts, &outcomes, args.memo)
    }
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateV3Programs<'info> {
    pub migration: MigrationAccountsV3<'info>,
    /// CHECK: the address.
    #[account(address = BPF_LOADER_UPGRADEABLE_ID)]
    pub bpf_loader_upgradeable: UncheckedAccount<'info>,
    // `remaining_accounts`: one writable program data account for each item; then the optional
    // event account.
}

#[cfg(feature = "program")]
impl<'info> MultisigMigrateV3Programs<'info> {
    /// Moves the upgrade authority of loader-v3 programs from the v3 authority to the successor vault.
    pub fn multisig_migrate_v3_programs(
        ctx: Context<'info, Self>,
        args: MigrateV3AuthoritiesArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let migration =
            accounts
                .migration
                .begin(ctx.remaining_accounts, 1, args.authority_index)?;
        let outcomes = migrate_programs(
            &migration,
            &accounts.bpf_loader_upgradeable.to_account_info(),
        )?;
        migration.emit(MigrationScope::Programs, &outcomes, args.memo)
    }
}
