#[cfg(feature = "program")]
use anchor_lang::prelude::*;
#[cfg(feature = "program")]
use anchor_lang::solana_program::instruction::Instruction;
#[cfg(feature = "program")]
use anchor_lang::solana_program::program::invoke;
#[cfg(feature = "program")]
use anchor_spl::token_2022::{self as token, CloseAccount, TransferChecked};
#[cfg(feature = "program")]
use anchor_spl::token_interface::TokenInterface;

#[cfg(feature = "program")]
use super::common::*;
#[cfg(feature = "program")]
use super::token_state::{mint_state, token_account_state};
#[cfg(feature = "program")]
use crate::errors::MultisigError;
#[cfg(feature = "program")]
use crate::events::{MigrationAssetKind, MigrationOutcome, MigrationScope, MigrationSkipReason};
#[cfg(feature = "program")]
use crate::migration::{self, ASSOCIATED_TOKEN_PROGRAM_ID};
#[cfg(not(feature = "program"))]
use crate::prelude::*;

/// The accounts of each token: source token account, mint, destination (the successor vault's ATA).
pub const MIGRATE_TOKEN_ACCOUNTS: usize = 3;

#[cfg_attr(feature = "program", derive(AnchorSerialize, AnchorDeserialize))]
#[cfg_attr(not(feature = "program"), derive(BorshSerialize, BorshDeserialize))]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrateTokensArgs {
    /// The v4 vault index. Every migrate instruction starts its arguments with this field.
    pub vault_index: u8,
    /// Set if the v4 `config_authority` is the v4 vault with this index (see `multisig_create_from`).
    pub config_authority_vault_index: Option<u8>,
    /// Close each source token account after the transfer. Its rent goes to the successor vault.
    pub close_source: bool,
    /// Memo is used for indexing only.
    pub memo: Option<String>,
}

#[cfg(feature = "program")]
#[derive(Accounts)]
pub struct MultisigMigrateTokens<'info> {
    pub migration: MigrationAccounts<'info>,
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
impl<'info> MultisigMigrateTokens<'info> {
    /// Moves the whole balance of each token account at execution time to the successor vault's
    /// associated token account. A token with nothing to move is skipped.
    pub fn multisig_migrate_tokens(
        ctx: Context<'info, Self>,
        args: MigrateTokensArgs,
    ) -> Result<()> {
        let accounts = &ctx.accounts;
        let migration = accounts.migration.begin(
            ctx.remaining_accounts,
            MIGRATE_TOKEN_ACCOUNTS,
            args.vault_index,
            args.config_authority_vault_index,
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

/// The programs that a token move calls: Token or Token-2022, the associated token program, System.
#[cfg(feature = "program")]
pub(crate) struct TokenPrograms<'info> {
    pub token: AccountInfo<'info>,
    pub associated_token: AccountInfo<'info>,
    pub system: AccountInfo<'info>,
}

/// Moves each token item (`MIGRATE_TOKEN_ACCOUNTS` accounts) of `migration`.
#[cfg(feature = "program")]
pub(crate) fn migrate_tokens<'info>(
    migration: &MigrationCall<'_, 'info>,
    programs: &TokenPrograms<'info>,
    close_source: bool,
) -> Result<Vec<MigrationOutcome>> {
    migration
        .items
        .as_chunks::<MIGRATE_TOKEN_ACCOUNTS>()
        .0
        .iter()
        .map(|item| migrate_token(migration, programs, item, close_source))
        .collect()
}

#[cfg(feature = "program")]
fn migrate_token<'info>(
    migration: &MigrationCall<'_, 'info>,
    programs: &TokenPrograms<'info>,
    [source, mint, destination]: &[AccountInfo<'info>; MIGRATE_TOKEN_ACCOUNTS],
    close_source: bool,
) -> Result<MigrationOutcome> {
    let token_program = programs.token.key();
    let source_vault = migration.source_vault.key();
    require_keys_eq!(
        *destination.key,
        migration::get_associated_token_address(migration.vault.key, mint.key, &token_program),
        MultisigError::MigrationInvalidAssetAccounts
    );
    let outcome = |result| MigrationOutcome {
        kind: MigrationAssetKind::Token,
        account: source.key(),
        result,
    };

    let Some(state) = token_account_state(source, &token_program) else {
        return Ok(outcome(skipped(MigrationSkipReason::Missing)));
    };
    require_keys_eq!(
        state.mint,
        mint.key(),
        MultisigError::MigrationInvalidAssetAccounts
    );
    // A closed mint (Token-2022 close authority) leaves nothing to move.
    let Some(mint_state) = mint_state(mint, &token_program) else {
        return Ok(outcome(skipped(MigrationSkipReason::Missing)));
    };
    if state.owner != source_vault {
        return Ok(outcome(skipped(MigrationSkipReason::NotAuthority)));
    }
    if state.frozen {
        return Ok(outcome(skipped(MigrationSkipReason::Frozen)));
    }
    // A vault signs only in CPIs, so it cannot turn on a CPI guard; the check is a safety net.
    if state.cpi_guard || mint_state.unsupported {
        return Ok(outcome(skipped(MigrationSkipReason::Unsupported)));
    }

    let tokens = state.amount;
    let close = close_source
        && state.withheld == 0
        && state.confidential_closable
        && state
            .close_authority
            .is_none_or(|authority| authority == source_vault);
    if tokens == 0 && !close {
        return Ok(outcome(skipped(MigrationSkipReason::Empty)));
    }
    if tokens > 0 {
        let destination_frozen = match token_account_state(destination, &token_program) {
            Some(destination) => destination.frozen,
            None => mint_state.default_frozen,
        };
        if destination_frozen {
            return Ok(outcome(skipped(MigrationSkipReason::Frozen)));
        }
        create_associated_token_account(migration, programs, destination, mint)?;
        token::transfer_checked(
            CpiContext::new(
                token_program,
                TransferChecked {
                    from: source.clone(),
                    mint: mint.clone(),
                    to: destination.clone(),
                    authority: migration.source_vault.clone(),
                },
            ),
            tokens,
            mint_state.decimals,
        )?;
    }
    if close {
        token::close_account(CpiContext::new(
            token_program,
            CloseAccount {
                account: source.clone(),
                destination: migration.vault.clone(),
                authority: migration.source_vault.clone(),
            },
        ))?;
    }
    Ok(outcome(moved(tokens, close)))
}

/// ATA `CreateIdempotent` (instruction data `[1]`), paid by the source vault.
#[cfg(feature = "program")]
fn create_associated_token_account<'info>(
    migration: &MigrationCall<'_, 'info>,
    programs: &TokenPrograms<'info>,
    destination: &AccountInfo<'info>,
    mint: &AccountInfo<'info>,
) -> Result<()> {
    let instruction = Instruction {
        program_id: ASSOCIATED_TOKEN_PROGRAM_ID,
        accounts: vec![
            AccountMeta::new(migration.source_vault.key(), true),
            AccountMeta::new(destination.key(), false),
            AccountMeta::new_readonly(migration.vault.key(), false),
            AccountMeta::new_readonly(mint.key(), false),
            AccountMeta::new_readonly(programs.system.key(), false),
            AccountMeta::new_readonly(programs.token.key(), false),
        ],
        data: vec![1],
    };
    invoke(
        &instruction,
        &[
            migration.source_vault.clone(),
            destination.clone(),
            migration.vault.clone(),
            mint.clone(),
            programs.system.clone(),
            programs.token.clone(),
            programs.associated_token.clone(),
        ],
    )
    .map_err(Into::into)
}
