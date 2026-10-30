//! Migration from v4 and v3. Every instruction goes inside a source transaction (a v4 vault
//! transaction or a v3 transaction), so that the source program signs for `source_vault`.

use solana_address::Address;
use solana_instruction::{AccountMeta, Instruction};

use super::{data, meta, SYSTEM_PROGRAM_ID};
use crate::discriminator::{self, instruction as ix};
use crate::error::CoreResult;
use crate::instructions::{
    MigrateAuthoritiesArgs, MigrateSolArgs, MigrateTokenAuthoritiesArgs, MigrateTokensArgs,
    MigrateV3AuthoritiesArgs, MigrateV3SolArgs, MigrateV3TokenAuthoritiesArgs, MigrateV3TokensArgs,
    MultisigCreateFromArgs, MultisigCreateFromV3Args,
};
use crate::migration::v3::get_v3_authority_pda;
use crate::migration::{
    get_successor_pda, item_metas, TokenItem, ASSOCIATED_TOKEN_PROGRAM_ID,
    BPF_LOADER_UPGRADEABLE_ID, CLOCK_SYSVAR_ID, STAKE_PROGRAM_ID, VOTE_PROGRAM_ID,
};
use crate::pda::{get_program_config_pda, get_vault_pda};
use crate::prelude::BorshSerialize;
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
}

/// The discriminators of the six migrate instructions of one lineage.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrateDiscriminators {
    pub sol: [u8; 8],
    pub tokens: [u8; 8],
    pub token_authorities: [u8; 8],
    pub stakes: [u8; 8],
    pub vote_accounts: [u8; 8],
    pub programs: [u8; 8],
}

/// The source of a migration: [`MigrationAccounts`] (v4) or [`MigrationAccountsV3`] (v3). It
/// sets the instruction and the arguments of each class, so the two never mix.
pub trait MigrationLineage: Copy {
    type SolArgs: BorshSerialize;
    type TokensArgs: BorshSerialize;
    type TokenAuthoritiesArgs: BorshSerialize;
    type AuthoritiesArgs: BorshSerialize;
    const DISCRIMINATORS: MigrateDiscriminators;

    /// The successor vault: the destination of every asset.
    fn vault(&self) -> Address;
    /// The four accounts that every migrate instruction of the lineage starts with.
    fn metas(&self) -> [AccountMeta; 4];
}

fn source_metas(
    source_multisig: Address,
    source_vault: Address,
    multisig: Address,
    vault: Address,
) -> [AccountMeta; 4] {
    [
        meta(source_multisig, false, false),
        meta(source_vault, true, true),
        meta(multisig, false, false),
        meta(vault, true, false),
    ]
}

impl MigrationLineage for MigrationAccounts {
    type SolArgs = MigrateSolArgs;
    type TokensArgs = MigrateTokensArgs;
    type TokenAuthoritiesArgs = MigrateTokenAuthoritiesArgs;
    type AuthoritiesArgs = MigrateAuthoritiesArgs;
    const DISCRIMINATORS: MigrateDiscriminators = MigrateDiscriminators {
        sol: ix::MULTISIG_MIGRATE_SOL,
        tokens: ix::MULTISIG_MIGRATE_TOKENS,
        token_authorities: ix::MULTISIG_MIGRATE_TOKEN_AUTHORITIES,
        stakes: ix::MULTISIG_MIGRATE_STAKES,
        vote_accounts: ix::MULTISIG_MIGRATE_VOTE_ACCOUNTS,
        programs: ix::MULTISIG_MIGRATE_PROGRAMS,
    };

    fn vault(&self) -> Address {
        self.vault
    }

    fn metas(&self) -> [AccountMeta; 4] {
        source_metas(
            self.source_multisig,
            self.source_vault,
            self.multisig,
            self.vault,
        )
    }
}

/// The accounts that every `multisig_migrate_v3_*` instruction starts with.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MigrationAccountsV3 {
    /// The v3 multisig.
    pub source_multisig: Address,
    /// The v3 authority. It signs and pays for new token accounts.
    pub source_vault: Address,
    /// The successor ([`get_successor_pda`]).
    pub multisig: Address,
    /// The successor vault `authority_index - 1`.
    pub vault: Address,
}

impl MigrationAccountsV3 {
    /// Derives every account for the v3 authority `authority_index`; `None` outside 1 to 256.
    pub fn new(
        source_multisig: Address,
        authority_index: u32,
        program_id: Option<&Address>,
    ) -> Option<Self> {
        let vault_index = crate::migration::v3::v3_vault_index(authority_index).ok()?;
        let multisig = get_successor_pda(&source_multisig, program_id).0;
        Some(Self {
            source_multisig,
            source_vault: get_v3_authority_pda(&source_multisig, authority_index).0,
            multisig,
            vault: get_vault_pda(&multisig, vault_index, program_id).0,
        })
    }
}

impl MigrationLineage for MigrationAccountsV3 {
    type SolArgs = MigrateV3SolArgs;
    type TokensArgs = MigrateV3TokensArgs;
    type TokenAuthoritiesArgs = MigrateV3TokenAuthoritiesArgs;
    type AuthoritiesArgs = MigrateV3AuthoritiesArgs;
    const DISCRIMINATORS: MigrateDiscriminators = MigrateDiscriminators {
        sol: ix::MULTISIG_MIGRATE_V3_SOL,
        tokens: ix::MULTISIG_MIGRATE_V3_TOKENS,
        token_authorities: ix::MULTISIG_MIGRATE_V3_TOKEN_AUTHORITIES,
        stakes: ix::MULTISIG_MIGRATE_V3_STAKES,
        vote_accounts: ix::MULTISIG_MIGRATE_V3_VOTE_ACCOUNTS,
        programs: ix::MULTISIG_MIGRATE_V3_PROGRAMS,
    };

    fn vault(&self) -> Address {
        self.vault
    }

    fn metas(&self) -> [AccountMeta; 4] {
        source_metas(
            self.source_multisig,
            self.source_vault,
            self.multisig,
            self.vault,
        )
    }
}

/// Accounts for `multisig_create_from_v3`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct MultisigCreateFromV3 {
    pub program_config: Address,
    pub treasury: Address,
    /// The v3 multisig.
    pub source_multisig: Address,
    /// An authority of the v3 multisig. It signs and pays.
    pub source_vault: Address,
    /// The successor ([`get_successor_pda`]).
    pub multisig: Address,
    pub system_program: Address,
}

impl MultisigCreateFromV3 {
    /// Derives every account except the treasury (read it from the program config).
    pub fn new(
        source_multisig: Address,
        authority_index: u32,
        treasury: Address,
        program_id: Option<&Address>,
    ) -> Self {
        Self {
            program_config: get_program_config_pda(program_id).0,
            treasury,
            source_multisig,
            source_vault: get_v3_authority_pda(&source_multisig, authority_index).0,
            multisig: get_successor_pda(&source_multisig, program_id).0,
            system_program: SYSTEM_PROGRAM_ID,
        }
    }

    pub fn instruction(
        &self,
        args: MultisigCreateFromV3Args,
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
            data: data(ix::MULTISIG_CREATE_FROM_V3, &args)?,
        })
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
pub struct MultisigMigrateSol<S: MigrationLineage = MigrationAccounts> {
    pub migration: S,
    pub system_program: Address,
}

impl<S: MigrationLineage> MultisigMigrateSol<S> {
    pub fn new(migration: S) -> Self {
        Self {
            migration,
            system_program: SYSTEM_PROGRAM_ID,
        }
    }

    pub fn instruction(
        &self,
        args: S::SolArgs,
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = S::DISCRIMINATORS.sol;
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
pub struct MultisigMigrateTokens<S: MigrationLineage = MigrationAccounts> {
    pub migration: S,
    /// Token or Token-2022: one token program for each call.
    pub token_program: Address,
    pub associated_token_program: Address,
    pub system_program: Address,
}

impl<S: MigrationLineage> MultisigMigrateTokens<S> {
    pub fn new(migration: S, token_program: Address) -> Self {
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
        args: S::TokensArgs,
        items: &[TokenItem],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = S::DISCRIMINATORS.tokens;
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
                    .flat_map(|item| item.metas(&self.migration.vault(), &self.token_program)),
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
pub struct MultisigMigrateTokenAuthorities<S: MigrationLineage = MigrationAccounts> {
    pub migration: S,
    /// Token or Token-2022: one token program for each call.
    pub token_program: Address,
}

impl<S: MigrationLineage> MultisigMigrateTokenAuthorities<S> {
    pub fn new(migration: S, token_program: Address) -> Self {
        Self {
            migration,
            token_program,
        }
    }

    /// `accounts` holds the token account or mint of each `args.items` entry, in order.
    pub fn instruction(
        &self,
        args: S::TokenAuthoritiesArgs,
        accounts: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = S::DISCRIMINATORS.token_authorities;
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
pub struct MultisigMigrateStakes<S: MigrationLineage = MigrationAccounts> {
    pub migration: S,
    pub clock: Address,
    pub stake_program: Address,
}

impl<S: MigrationLineage> MultisigMigrateStakes<S> {
    pub fn new(migration: S) -> Self {
        Self {
            migration,
            clock: CLOCK_SYSVAR_ID,
            stake_program: STAKE_PROGRAM_ID,
        }
    }

    /// `stakes` are the stake accounts.
    pub fn instruction(
        &self,
        args: S::AuthoritiesArgs,
        stakes: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = S::DISCRIMINATORS.stakes;
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
pub struct MultisigMigrateVoteAccounts<S: MigrationLineage = MigrationAccounts> {
    pub migration: S,
    pub clock: Address,
    pub vote_program: Address,
}

impl<S: MigrationLineage> MultisigMigrateVoteAccounts<S> {
    pub fn new(migration: S) -> Self {
        Self {
            migration,
            clock: CLOCK_SYSVAR_ID,
            vote_program: VOTE_PROGRAM_ID,
        }
    }

    /// `vote_accounts` are the vote accounts.
    pub fn instruction(
        &self,
        args: S::AuthoritiesArgs,
        vote_accounts: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = S::DISCRIMINATORS.vote_accounts;
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
pub struct MultisigMigratePrograms<S: MigrationLineage = MigrationAccounts> {
    pub migration: S,
    pub bpf_loader_upgradeable: Address,
}

impl<S: MigrationLineage> MultisigMigratePrograms<S> {
    pub fn new(migration: S) -> Self {
        Self {
            migration,
            bpf_loader_upgradeable: BPF_LOADER_UPGRADEABLE_ID,
        }
    }

    /// `program_data` are the loader-v3 program data accounts.
    pub fn instruction(
        &self,
        args: S::AuthoritiesArgs,
        program_data: &[Address],
        program_id: Option<&Address>,
    ) -> CoreResult<Instruction> {
        let discriminator = S::DISCRIMINATORS.programs;
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
