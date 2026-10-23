//! Migration from v4. Every instruction goes inside a v4 vault transaction, so that v4 signs for
//! `source_vault`.

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};

use super::{data, meta, SYSTEM_PROGRAM_ID};
use crate::discriminator;
use crate::error::CoreResult;
use crate::instructions::{
    MigrateAuthoritiesArgs, MigrateSolArgs, MigrateTokenAuthoritiesArgs, MigrateTokensArgs,
    MultisigCreateFromArgs,
};
use crate::migration::{
    get_successor_pda, item_metas, TokenItem, ASSOCIATED_TOKEN_PROGRAM_ID,
    BPF_LOADER_UPGRADEABLE_ID, CLOCK_SYSVAR_ID, STAKE_PROGRAM_ID, VOTE_PROGRAM_ID,
};
use crate::pda::{get_program_config_pda, get_vault_pda};
use crate::LEGACY_V4_PROGRAM_ID;

/// Accounts for `multisig_create_from`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigCreateFrom {
    pub program_config: Address,
    pub treasury: Address,
    /// The v4 multisig.
    pub source_multisig: Address,
    /// A vault of the v4 multisig. It signs and pays.
    pub source_vault: Address,
    /// The successor ([`get_successor_pda`]).
    pub multisig: Address,
    pub system_program: Address,
}

impl MultisigCreateFrom {
    /// Derives every account except the treasury (read it from the program config).
    pub fn new(
        source_multisig: Address,
        vault_index: u8,
        treasury: Address,
        program_id: Option<&Address>,
    ) -> Self {
        Self {
            program_config: get_program_config_pda(program_id).0,
            treasury,
            source_multisig,
            source_vault: get_vault_pda(&source_multisig, vault_index, Some(&LEGACY_V4_PROGRAM_ID))
                .0,
            multisig: get_successor_pda(&source_multisig, program_id).0,
            system_program: SYSTEM_PROGRAM_ID,
        }
    }

    pub fn instruction(
        &self,
        args: MultisigCreateFromArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        Ok(Instruction {
            program_id: *program_id.unwrap_or(&crate::ID),
            accounts: vec![
                meta(self.program_config, false, false),
                meta(self.treasury, true, false),
                meta(self.source_multisig, false, false),
                meta(self.source_vault, true, true),
                meta(self.multisig, true, false),
                meta(self.system_program, false, false),
            ],
            data: data(discriminator::instruction::MULTISIG_CREATE_FROM, &args)?,
        })
    }
}

/// The accounts that every `multisig_migrate_*` instruction starts with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrationAccounts {
    /// The v4 multisig.
    pub source_multisig: Address,
    /// The v4 vault. It signs and pays for new token accounts.
    pub source_vault: Address,
    /// The successor ([`get_successor_pda`]).
    pub multisig: Address,
    /// The successor vault with the same index.
    pub vault: Address,
}

impl MigrationAccounts {
    /// Derives every account for the v4 vault `vault_index`.
    pub fn new(source_multisig: Address, vault_index: u8, program_id: Option<&Address>) -> Self {
        let multisig = get_successor_pda(&source_multisig, program_id).0;
        Self {
            source_multisig,
            source_vault: get_vault_pda(&source_multisig, vault_index, Some(&LEGACY_V4_PROGRAM_ID))
                .0,
            multisig,
            vault: get_vault_pda(&multisig, vault_index, program_id).0,
        }
    }

    fn metas(&self) -> [AccountMeta; 4] {
        [
            meta(self.source_multisig, false, false),
            meta(self.source_vault, true, true),
            meta(self.multisig, false, false),
            meta(self.vault, true, false),
        ]
    }
}

fn migrate_instruction(
    data: Vec<u8>,
    accounts: impl IntoIterator<Item = AccountMeta>,
    program_id: Option<&Address>,
) -> Instruction {
    Instruction {
        program_id: *program_id.unwrap_or(&crate::ID),
        accounts: accounts.into_iter().collect(),
        data,
    }
}

/// Accounts for `multisig_migrate_sol`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigMigrateSol {
    pub migration: MigrationAccounts,
    pub system_program: Address,
}

impl MultisigMigrateSol {
    pub fn new(migration: MigrationAccounts) -> Self {
        Self {
            migration,
            system_program: SYSTEM_PROGRAM_ID,
        }
    }

    pub fn instruction(
        &self,
        args: MigrateSolArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = discriminator::instruction::MULTISIG_MIGRATE_SOL;
        let accounts =
            self.migration
                .metas()
                .into_iter()
                .chain([meta(self.system_program, false, false)]);
        Ok(migrate_instruction(
            data(discriminator, &args)?,
            accounts,
            program_id,
        ))
    }
}

/// Accounts for `multisig_migrate_tokens`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigMigrateTokens {
    pub migration: MigrationAccounts,
    /// Token or Token-2022: one token program for each call.
    pub token_program: Address,
    pub associated_token_program: Address,
    pub system_program: Address,
}

impl MultisigMigrateTokens {
    pub fn new(migration: MigrationAccounts, token_program: Address) -> Self {
        Self {
            migration,
            token_program,
            associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
            system_program: SYSTEM_PROGRAM_ID,
        }
    }

    /// `items` are the tokens to move, all of `token_program`.
    pub fn instruction(
        &self,
        args: MigrateTokensArgs,
        items: &[TokenItem],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = discriminator::instruction::MULTISIG_MIGRATE_TOKENS;
        let accounts = self
            .migration
            .metas()
            .into_iter()
            .chain([
                meta(self.token_program, false, false),
                meta(self.associated_token_program, false, false),
                meta(self.system_program, false, false),
            ])
            .chain(
                items
                    .iter()
                    .flat_map(|item| item.metas(&self.migration.vault, &self.token_program)),
            );
        Ok(migrate_instruction(
            data(discriminator, &args)?,
            accounts,
            program_id,
        ))
    }
}

/// Accounts for `multisig_migrate_token_authorities`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigMigrateTokenAuthorities {
    pub migration: MigrationAccounts,
    /// Token or Token-2022: one token program for each call.
    pub token_program: Address,
}

impl MultisigMigrateTokenAuthorities {
    pub fn new(migration: MigrationAccounts, token_program: Address) -> Self {
        Self {
            migration,
            token_program,
        }
    }

    /// `accounts` holds the token account or mint of each `args.items` entry, in order.
    pub fn instruction(
        &self,
        args: MigrateTokenAuthoritiesArgs,
        accounts: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = discriminator::instruction::MULTISIG_MIGRATE_TOKEN_AUTHORITIES;
        let metas = self
            .migration
            .metas()
            .into_iter()
            .chain([meta(self.token_program, false, false)])
            .chain(item_metas(accounts));
        Ok(migrate_instruction(
            data(discriminator, &args)?,
            metas,
            program_id,
        ))
    }
}

/// Accounts for `multisig_migrate_stakes`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigMigrateStakes {
    pub migration: MigrationAccounts,
    pub clock: Address,
    pub stake_program: Address,
}

impl MultisigMigrateStakes {
    pub fn new(migration: MigrationAccounts) -> Self {
        Self {
            migration,
            clock: CLOCK_SYSVAR_ID,
            stake_program: STAKE_PROGRAM_ID,
        }
    }

    /// `stakes` are the stake accounts.
    pub fn instruction(
        &self,
        args: MigrateAuthoritiesArgs,
        stakes: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = discriminator::instruction::MULTISIG_MIGRATE_STAKES;
        let metas = self
            .migration
            .metas()
            .into_iter()
            .chain([
                meta(self.clock, false, false),
                meta(self.stake_program, false, false),
            ])
            .chain(item_metas(stakes));
        Ok(migrate_instruction(
            data(discriminator, &args)?,
            metas,
            program_id,
        ))
    }
}

/// Accounts for `multisig_migrate_vote_accounts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigMigrateVoteAccounts {
    pub migration: MigrationAccounts,
    pub clock: Address,
    pub vote_program: Address,
}

impl MultisigMigrateVoteAccounts {
    pub fn new(migration: MigrationAccounts) -> Self {
        Self {
            migration,
            clock: CLOCK_SYSVAR_ID,
            vote_program: VOTE_PROGRAM_ID,
        }
    }

    /// `vote_accounts` are the vote accounts.
    pub fn instruction(
        &self,
        args: MigrateAuthoritiesArgs,
        vote_accounts: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = discriminator::instruction::MULTISIG_MIGRATE_VOTE_ACCOUNTS;
        let metas = self
            .migration
            .metas()
            .into_iter()
            .chain([
                meta(self.clock, false, false),
                meta(self.vote_program, false, false),
            ])
            .chain(item_metas(vote_accounts));
        Ok(migrate_instruction(
            data(discriminator, &args)?,
            metas,
            program_id,
        ))
    }
}

/// Accounts for `multisig_migrate_programs`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigMigratePrograms {
    pub migration: MigrationAccounts,
    pub bpf_loader_upgradeable: Address,
}

impl MultisigMigratePrograms {
    pub fn new(migration: MigrationAccounts) -> Self {
        Self {
            migration,
            bpf_loader_upgradeable: BPF_LOADER_UPGRADEABLE_ID,
        }
    }

    /// `program_data` are the loader-v3 program data accounts.
    pub fn instruction(
        &self,
        args: MigrateAuthoritiesArgs,
        program_data: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = discriminator::instruction::MULTISIG_MIGRATE_PROGRAMS;
        let metas = self
            .migration
            .metas()
            .into_iter()
            .chain([meta(self.bpf_loader_upgradeable, false, false)])
            .chain(item_metas(program_data));
        Ok(migrate_instruction(
            data(discriminator, &args)?,
            metas,
            program_id,
        ))
    }
}
