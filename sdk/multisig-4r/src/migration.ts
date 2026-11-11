import {
  AccountRole,
  address,
  createNoopSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  type AccountMeta,
  type Address,
  type Instruction,
  type NoopSigner,
} from "@solana/kit";

import { LEGACY_V4_PROGRAM_ADDRESS } from "./events";
import {
  findSuccessorPda,
  findVaultPda,
  getMultisigMigrateProgramsInstruction,
  getMultisigMigrateSolInstruction,
  getMultisigMigrateStakesInstruction,
  getMultisigMigrateTokenAuthoritiesInstruction,
  getMultisigMigrateTokensInstruction,
  getMultisigMigrateV3ProgramsInstruction,
  getMultisigMigrateV3SolInstruction,
  getMultisigMigrateV3StakesInstruction,
  getMultisigMigrateV3TokenAuthoritiesInstruction,
  getMultisigMigrateV3TokensInstruction,
  getMultisigMigrateV3VoteAccountsInstruction,
  getMultisigMigrateVoteAccountsInstruction,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  type TokenAuthorityKind,
} from "./generated";
import { findV3AuthorityPda, v3VaultIndex } from "./v3";

export const TOKEN_PROGRAM_ADDRESS = address("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const TOKEN_2022_PROGRAM_ADDRESS = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
export const ASSOCIATED_TOKEN_PROGRAM_ADDRESS = address("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const BPF_LOADER_UPGRADEABLE_ADDRESS = address("BPFLoaderUpgradeab1e11111111111111111111111");
export const STAKE_PROGRAM_ADDRESS = address("Stake11111111111111111111111111111111111111");
export const VOTE_PROGRAM_ADDRESS = address("Vote111111111111111111111111111111111111111");
export const CLOCK_SYSVAR_ADDRESS = address("SysvarC1ock11111111111111111111111111111111");

/** One token of `multisigMigrateTokens`: a token account of the v4 vault and its mint. */
export type TokenItem = { readonly sourceTokenAccount: Address; readonly mint: Address };

/** One item of `multisigMigrateTokenAuthorities`: the token account or mint, and the authority. */
export type TokenAuthorityItem = { readonly account: Address; readonly kind: TokenAuthorityKind };

/** The v4 multisig and vault that a migrate instruction moves from. */
export type V4MigrationSource = {
  readonly lineage?: "v4";
  readonly sourceMultisig: Address;
  readonly vaultIndex?: number;
  /** Set when the v4 config authority is the v4 vault with this index. */
  readonly configAuthorityVaultIndex?: number | null;
  readonly memo?: string | null;
  /** The 4r program (default: mainnet). */
  readonly programAddress?: Address;
};

/** The v3 multisig and authority (1 to 256) that a `multisigMigrateV3*` instruction moves from. */
export type V3MigrationSource = {
  readonly lineage: "v3";
  readonly sourceMultisig: Address;
  readonly authorityIndex: number;
  readonly memo?: string | null;
  /** The 4r program (default: mainnet). */
  readonly programAddress?: Address;
};

/** The source of a migrate instruction: a v4 vault (the default) or a v3 authority. */
export type MigrationSource = V4MigrationSource | V3MigrationSource;

/** The successor vault index of `source`: the v4 vault index, or the v3 authority index - 1. */
export const migrationVaultIndex = (source: MigrationSource): number =>
  source.lineage === "v3" ? v3VaultIndex(source.authorityIndex) : (source.vaultIndex ?? 0);

export async function findAssociatedTokenAddress(owner: Address, mint: Address, tokenProgram: Address): Promise<Address> {
  const encoder = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    seeds: [encoder.encode(owner), encoder.encode(tokenProgram), encoder.encode(mint)],
  });
  return ata;
}

const writable = (address: Address): AccountMeta => ({ address, role: AccountRole.WRITABLE });
const readonly = (address: Address): AccountMeta => ({ address, role: AccountRole.READONLY });

/** The remaining accounts of one token: source, mint, and the successor vault's token account. */
export async function getTokenItemAccountMetas(item: TokenItem, vault: Address, tokenProgram: Address): Promise<AccountMeta[]> {
  return [
    writable(item.sourceTokenAccount),
    readonly(item.mint),
    writable(await findAssociatedTokenAddress(vault, item.mint, tokenProgram)),
  ];
}

type MigrationAccountsOf<TLineage extends "v4" | "v3", TArgs> = {
  readonly lineage: TLineage;
  readonly accounts: { sourceMultisig: Address; sourceVault: NoopSigner; multisig: Address; vault: Address };
  readonly args: TArgs;
  readonly config: { programAddress: Address };
};
export type V4MigrationAccounts = MigrationAccountsOf<
  "v4",
  { vaultIndex: number; configAuthorityVaultIndex: number | null; memo: string | null }
>;
export type V3MigrationAccounts = MigrationAccountsOf<"v3", { authorityIndex: number; memo: string | null }>;

/** The accounts and arguments that every migrate instruction of `source`'s lineage starts with. */
export async function getMigrationAccounts(source: V4MigrationSource): Promise<V4MigrationAccounts>;
export async function getMigrationAccounts(source: V3MigrationSource): Promise<V3MigrationAccounts>;
export async function getMigrationAccounts(source: MigrationSource): Promise<V4MigrationAccounts | V3MigrationAccounts>;
export async function getMigrationAccounts(source: MigrationSource): Promise<V4MigrationAccounts | V3MigrationAccounts> {
  const programAddress = source.programAddress ?? SQUADS_MULTISIG4R_PROGRAM_ADDRESS;
  const vaultIndex = migrationVaultIndex(source);
  const [multisig] = await findSuccessorPda({ sourceMultisig: source.sourceMultisig }, { programAddress });
  const [vault] = await findVaultPda({ multisig, index: vaultIndex }, { programAddress });
  const config = { programAddress };
  const memo = source.memo ?? null;
  if (source.lineage === "v3") {
    const sourceVault = await findV3AuthorityPda(source.sourceMultisig, source.authorityIndex);
    return {
      lineage: "v3" as const,
      accounts: { sourceMultisig: source.sourceMultisig, sourceVault: createNoopSigner(sourceVault), multisig, vault },
      args: { authorityIndex: source.authorityIndex, memo },
      config,
    };
  }
  const [sourceVault] = await findVaultPda(
    { multisig: source.sourceMultisig, index: vaultIndex },
    { programAddress: LEGACY_V4_PROGRAM_ADDRESS },
  );
  return {
    lineage: "v4" as const,
    accounts: { sourceMultisig: source.sourceMultisig, sourceVault: createNoopSigner(sourceVault), multisig, vault },
    args: { vaultIndex, configAuthorityVaultIndex: source.configAuthorityVaultIndex ?? null, memo },
    config,
  };
}

const withItems = (instruction: Instruction, items: readonly AccountMeta[]): Instruction => ({
  ...instruction,
  accounts: [...(instruction.accounts ?? []), ...items],
});

/** The SOL of the source vault minus `keep` (0, or at least the rent minimum). */
export async function getMigrateSolInstruction(source: MigrationSource, keep: bigint = 0n): Promise<Instruction> {
  const m = await getMigrationAccounts(source);
  return m.lineage === "v3"
    ? getMultisigMigrateV3SolInstruction({ ...m.accounts, ...m.args, keep }, m.config)
    : getMultisigMigrateSolInstruction({ ...m.accounts, ...m.args, keep }, m.config);
}

/** The whole balance of each token account, all of `tokenProgram`. */
export async function getMigrateTokensInstruction(
  source: MigrationSource,
  input: { tokenProgram: Address; closeSource: boolean; items: readonly TokenItem[] },
): Promise<Instruction> {
  const m = await getMigrationAccounts(source);
  const common = { tokenProgram: input.tokenProgram, closeSource: input.closeSource };
  const instruction =
    m.lineage === "v3"
      ? getMultisigMigrateV3TokensInstruction({ ...m.accounts, ...m.args, ...common }, m.config)
      : getMultisigMigrateTokensInstruction({ ...m.accounts, ...m.args, ...common }, m.config);
  const metas = await Promise.all(input.items.map((item) => getTokenItemAccountMetas(item, m.accounts.vault, input.tokenProgram)));
  return withItems(instruction, metas.flat());
}

/** Token authorities of `tokenProgram` accounts and mints. */
export async function getMigrateTokenAuthoritiesInstruction(
  source: MigrationSource,
  input: { tokenProgram: Address; items: readonly TokenAuthorityItem[] },
): Promise<Instruction> {
  const m = await getMigrationAccounts(source);
  const common = { tokenProgram: input.tokenProgram, items: input.items.map((item) => item.kind) };
  const instruction =
    m.lineage === "v3"
      ? getMultisigMigrateV3TokenAuthoritiesInstruction({ ...m.accounts, ...m.args, ...common }, m.config)
      : getMultisigMigrateTokenAuthoritiesInstruction({ ...m.accounts, ...m.args, ...common }, m.config);
  return withItems(instruction, input.items.map((item) => writable(item.account)));
}

/** The staker, withdrawer and custodian roles of stake accounts. */
export async function getMigrateStakesInstruction(source: MigrationSource, stakes: readonly Address[]): Promise<Instruction> {
  const m = await getMigrationAccounts(source);
  const instruction =
    m.lineage === "v3"
      ? getMultisigMigrateV3StakesInstruction({ ...m.accounts, ...m.args }, m.config)
      : getMultisigMigrateStakesInstruction({ ...m.accounts, ...m.args }, m.config);
  return withItems(instruction, stakes.map(writable));
}

/** The withdrawer role of vote accounts. */
export async function getMigrateVoteAccountsInstruction(
  source: MigrationSource,
  voteAccounts: readonly Address[],
): Promise<Instruction> {
  const m = await getMigrationAccounts(source);
  const instruction =
    m.lineage === "v3"
      ? getMultisigMigrateV3VoteAccountsInstruction({ ...m.accounts, ...m.args }, m.config)
      : getMultisigMigrateVoteAccountsInstruction({ ...m.accounts, ...m.args }, m.config);
  return withItems(instruction, voteAccounts.map(writable));
}

/** The upgrade authority of loader-v3 programs (program data accounts). */
export async function getMigrateProgramsInstruction(
  source: MigrationSource,
  programData: readonly Address[],
): Promise<Instruction> {
  const m = await getMigrationAccounts(source);
  const instruction =
    m.lineage === "v3"
      ? getMultisigMigrateV3ProgramsInstruction({ ...m.accounts, ...m.args }, m.config)
      : getMultisigMigrateProgramsInstruction({ ...m.accounts, ...m.args }, m.config);
  return withItems(instruction, programData.map(writable));
}
