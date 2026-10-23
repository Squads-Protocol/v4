import {
  AccountRole,
  address,
  createNoopSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  type AccountMeta,
  type Address,
  type Instruction,
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
  getMultisigMigrateVoteAccountsInstruction,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  type TokenAuthorityKind,
} from "./generated";

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
export type MigrationSource = {
  readonly sourceMultisig: Address;
  readonly vaultIndex?: number;
  /** Set when the v4 config authority is the v4 vault with this index. */
  readonly configAuthorityVaultIndex?: number | null;
  readonly memo?: string | null;
  /** The 4r program (default: mainnet). */
  readonly programAddress?: Address;
};

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

/** The accounts and arguments that every `multisigMigrate*` instruction starts with. */
export async function getMigrationAccounts(source: MigrationSource) {
  const programAddress = source.programAddress ?? SQUADS_MULTISIG4R_PROGRAM_ADDRESS;
  const vaultIndex = source.vaultIndex ?? 0;
  const [sourceVault] = await findVaultPda(
    { multisig: source.sourceMultisig, index: vaultIndex },
    { programAddress: LEGACY_V4_PROGRAM_ADDRESS },
  );
  const [multisig] = await findSuccessorPda({ sourceMultisig: source.sourceMultisig }, { programAddress });
  const [vault] = await findVaultPda({ multisig, index: vaultIndex }, { programAddress });
  return {
    accounts: { sourceMultisig: source.sourceMultisig, sourceVault: createNoopSigner(sourceVault), multisig, vault },
    args: {
      vaultIndex,
      configAuthorityVaultIndex: source.configAuthorityVaultIndex ?? null,
      memo: source.memo ?? null,
    },
    config: { programAddress },
  };
}

const withItems = (instruction: Instruction, items: readonly AccountMeta[]): Instruction => ({
  ...instruction,
  accounts: [...(instruction.accounts ?? []), ...items],
});

/** `multisigMigrateSol`: the SOL of the v4 vault minus `keep` (0, or at least the rent minimum). */
export async function getMigrateSolInstruction(source: MigrationSource, keep: bigint = 0n): Promise<Instruction> {
  const { accounts, args, config } = await getMigrationAccounts(source);
  return getMultisigMigrateSolInstruction({ ...accounts, ...args, keep }, config);
}

/** `multisigMigrateTokens`: the whole balance of each token account, all of `tokenProgram`. */
export async function getMigrateTokensInstruction(
  source: MigrationSource,
  input: { tokenProgram: Address; closeSource: boolean; items: readonly TokenItem[] },
): Promise<Instruction> {
  const { accounts, args, config } = await getMigrationAccounts(source);
  const instruction = getMultisigMigrateTokensInstruction(
    { ...accounts, ...args, tokenProgram: input.tokenProgram, closeSource: input.closeSource },
    config,
  );
  const metas = await Promise.all(input.items.map((item) => getTokenItemAccountMetas(item, accounts.vault, input.tokenProgram)));
  return withItems(instruction, metas.flat());
}

/** `multisigMigrateTokenAuthorities`: token authorities of `tokenProgram` accounts and mints. */
export async function getMigrateTokenAuthoritiesInstruction(
  source: MigrationSource,
  input: { tokenProgram: Address; items: readonly TokenAuthorityItem[] },
): Promise<Instruction> {
  const { accounts, args, config } = await getMigrationAccounts(source);
  const instruction = getMultisigMigrateTokenAuthoritiesInstruction(
    { ...accounts, ...args, tokenProgram: input.tokenProgram, items: input.items.map((item) => item.kind) },
    config,
  );
  return withItems(instruction, input.items.map((item) => writable(item.account)));
}

/** `multisigMigrateStakes`: the staker and withdrawer roles of stake accounts. */
export async function getMigrateStakesInstruction(source: MigrationSource, stakes: readonly Address[]): Promise<Instruction> {
  const { accounts, args, config } = await getMigrationAccounts(source);
  return withItems(getMultisigMigrateStakesInstruction({ ...accounts, ...args }, config), stakes.map(writable));
}

/** `multisigMigrateVoteAccounts`: the withdrawer role of vote accounts. */
export async function getMigrateVoteAccountsInstruction(
  source: MigrationSource,
  voteAccounts: readonly Address[],
): Promise<Instruction> {
  const { accounts, args, config } = await getMigrationAccounts(source);
  return withItems(getMultisigMigrateVoteAccountsInstruction({ ...accounts, ...args }, config), voteAccounts.map(writable));
}

/** `multisigMigratePrograms`: the upgrade authority of loader-v3 programs (program data accounts). */
export async function getMigrateProgramsInstruction(
  source: MigrationSource,
  programData: readonly Address[],
): Promise<Instruction> {
  const { accounts, args, config } = await getMigrationAccounts(source);
  return withItems(getMultisigMigrateProgramsInstruction({ ...accounts, ...args }, config), programData.map(writable));
}
