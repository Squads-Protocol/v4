import {
  createNoopSigner,
  getAddressDecoder,
  getAddressEncoder,
  getBase58Decoder,
  type Address,
  type Base58EncodedBytes,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from "@solana/kit";

import { LEGACY_V4_PROGRAM_ADDRESS, withEvents } from "./events";
import {
  fetchBatchChecked,
  fetchMultisigChecked,
  fetchProgramConfigChecked,
  fetchVaultBatchTransactionChecked,
  fetchVaultTransactionChecked,
} from "./fetch";
import {
  fetchMaybeMultisig,
  findBatchTransactionPda,
  findProgramConfigPda,
  findProposalPda,
  findSuccessorPda,
  findTransactionPda,
  findVaultPda,
  getBatchAddTransactionInstruction,
  getBatchCreateInstruction,
  getBatchExecuteTransactionInstruction,
  getMultisigCreateFromInstruction,
  getProposalActivateInstruction,
  getProposalApproveInstruction,
  getProposalCreateInstruction,
  getVaultTransactionCreateInstruction,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  TokenAuthorityKind,
  type Multisig,
} from "./generated";
import { getLookupTableAddresses } from "./lookupTables";
import {
  compileTransactionMessage,
  getAccountsForExecute,
  getTransactionMessageBytes,
  getVaultTransactionExecuteInstructionWithAccounts,
  type AddressLookupTables,
} from "./message";
import {
  BPF_LOADER_UPGRADEABLE_ADDRESS,
  findAssociatedTokenAddress,
  getMigrateProgramsInstruction,
  getMigrateSolInstruction,
  getMigrateStakesInstruction,
  getMigrateTokenAuthoritiesInstruction,
  getMigrateTokensInstruction,
  getMigrateVoteAccountsInstruction,
  STAKE_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  VOTE_PROGRAM_ADDRESS,
  type MigrationSource,
  type TokenAuthorityItem,
  type TokenItem,
} from "./migration";

export type InventoryToken = {
  readonly account: Address;
  readonly mint: Address;
  readonly tokenProgram: Address;
  readonly amount: bigint;
  readonly frozen: boolean;
  /** The vault's associated token account for this mint. */
  readonly associated: boolean;
};
/** A token account where the vault is the close authority or the delegate. The owner may be anyone. */
export type InventoryTokenRole = {
  readonly account: Address;
  readonly tokenProgram: Address;
  readonly mint: Address;
  readonly owner: Address;
  readonly frozen: boolean;
  /** The vault is the close authority. */
  readonly closeAuthority: boolean;
  /** The amount that the vault can spend as the delegate, or `null` if it is not the delegate. */
  readonly delegatedAmount: bigint | null;
};
export type InventoryStake = {
  readonly stake: Address;
  readonly staker: boolean;
  readonly withdrawer: boolean;
  /** The vault is the lockup custodian. */
  readonly custodian: boolean;
};
export type InventoryMint = {
  readonly mint: Address;
  readonly tokenProgram: Address;
  /** The authorities that the vault holds: mint, freeze, Token-2022 extension and metadata authorities. */
  readonly authorities: readonly TokenAuthorityKind[];
};

/** What one v4 vault holds or controls. */
export type V4VaultInventory = {
  readonly vaultIndex: number;
  readonly vault: Address;
  readonly lamports: bigint;
  readonly tokens: readonly InventoryToken[];
  /** Token accounts where the vault is the close authority or the delegate. */
  readonly tokenRoles: readonly InventoryTokenRole[];
  readonly stakes: readonly InventoryStake[];
  /** Vote accounts whose withdrawer is the vault. */
  readonly voteAccounts: readonly Address[];
  /** Program data accounts whose upgrade authority is the vault. */
  readonly programData: readonly Address[];
  readonly mints: readonly InventoryMint[];
  /** Scans that failed, for example on an RPC that refuses `getProgramAccounts`. */
  readonly warnings: readonly string[];
};

/** The `getProgramAccounts` scans to run (all by default). Some RPC providers refuse them. */
export type InventoryScans = {
  /** Token accounts where the vault is the close authority or the delegate. */
  readonly tokenRoles?: boolean;
  readonly stakes?: boolean;
  readonly voteAccounts?: boolean;
  readonly programs?: boolean;
  readonly mints?: boolean;
};

/** Limits for one batch item. The defaults fit a v4 batch without address lookup tables. */
export type MigrationLimits = {
  /** Bytes of the vault transaction message (the data of `batch_add_transaction`). */
  readonly maxMessageBytes?: number;
  /** Accounts of the vault transaction message. The execute transaction adds about 8 more. */
  readonly maxMessageAccounts?: number;
  /** Instructions of the execute transaction, CPIs included (the runtime allows 64). */
  readonly maxInstructionTrace?: number;
};

export const DEFAULT_MIGRATION_LIMITS: Required<MigrationLimits> = {
  maxMessageBytes: 800,
  maxMessageAccounts: 30,
  maxInstructionTrace: 64,
};
/** Limits with lookup tables: the 64 account locks of the execute transaction bind first. */
export const LOOKUP_TABLE_MIGRATION_LIMITS: Required<MigrationLimits> = {
  maxMessageBytes: 800,
  maxMessageAccounts: 52,
  maxInstructionTrace: 64,
};

// Worst-case CPIs for each item. A token: ATA creation (up to 7 when someone pre-funds the
// address), the transfer and the close. A stake: two `Authorize` and `SetLockup`.
const TRACE_PER_ITEM: Readonly<Record<MigrationGroup["class"], number>> = {
  tokens: 9,
  tokenAuthorities: 1,
  stakes: 3,
  voteAccounts: 1,
  programs: 1,
  sol: 1,
};
// Compute unit price and limit, the v4 execute, the migrate instruction.
const TRACE_PER_EXECUTE = 4;

/** The worst-case instruction trace of the execute transaction of one batch item. */
export function migrationInstructionTrace(group: MigrationGroup, events: boolean): number {
  const items = "items" in group ? group.items.length : 1;
  return TRACE_PER_EXECUTE + (events ? 1 : 0) + items * TRACE_PER_ITEM[group.class];
}

/** Rent of one new associated token account, with margin for Token-2022 account extensions. */
export const ATA_RENT_ESTIMATE = 2_200_000n;

const v4 = { programAddress: LEGACY_V4_PROGRAM_ADDRESS };
const addressEncoder = getAddressEncoder();
const base58 = getBase58Decoder();
const addressAt = (data: Uint8Array, offset: number) => getAddressDecoder().decode(data.slice(offset, offset + 32));
const view = (data: Uint8Array) => new DataView(data.buffer, data.byteOffset, data.byteLength);
const u16At = (data: Uint8Array, offset: number) => view(data).getUint16(offset, true);
const u32At = (data: Uint8Array, offset: number) => view(data).getUint32(offset, true);
const u64At = (data: Uint8Array, offset: number) => view(data).getBigUint64(offset, true);
const memcmp = (offset: number, bytes: ArrayLike<number>) => ({
  memcmp: {
    offset: BigInt(offset),
    bytes: base58.decode(Uint8Array.from(bytes)) as Base58EncodedBytes,
    encoding: "base58" as const,
  },
});
const fromBase64 = (data: string) => Uint8Array.from(Buffer.from(data, "base64"));

async function vaultOf(multisig: Address, index: number, programAddress: Address) {
  return (await findVaultPda({ multisig, index }, { programAddress }))[0];
}

/** The index of the v4 vault `address` of `sourceMultisig`, or `null`. Checks all 256 indexes. */
export async function findV4VaultIndex(sourceMultisig: Address, address: Address): Promise<number | null> {
  for (let index = 0; index < 256; index++) {
    if ((await vaultOf(sourceMultisig, index, LEGACY_V4_PROGRAM_ADDRESS)) === address) return index;
  }
  return null;
}

// Token-2022 extension type -> the authorities in its value, with their offsets.
const EXTENSION_AUTHORITIES: Readonly<Record<number, readonly (readonly [TokenAuthorityKind, number])[]>> = {
  1: [
    [TokenAuthorityKind.TransferFeeConfig, 0],
    [TokenAuthorityKind.WithheldWithdraw, 32],
  ],
  3: [[TokenAuthorityKind.CloseMint, 0]],
  4: [[TokenAuthorityKind.ConfidentialTransferMint, 0]],
  10: [[TokenAuthorityKind.InterestRate, 0]],
  12: [[TokenAuthorityKind.PermanentDelegate, 0]],
  14: [[TokenAuthorityKind.TransferHookProgramId, 0]],
  16: [[TokenAuthorityKind.ConfidentialTransferFeeConfig, 0]],
  18: [[TokenAuthorityKind.MetadataPointer, 0]],
  19: [[TokenAuthorityKind.MetadataUpdate, 0]],
  20: [[TokenAuthorityKind.GroupPointer, 0]],
  22: [[TokenAuthorityKind.GroupMemberPointer, 0]],
  25: [[TokenAuthorityKind.ScaledUiAmount, 0]],
  26: [[TokenAuthorityKind.Pause, 0]],
  28: [[TokenAuthorityKind.PermissionedBurn, 0]],
};

/**
 * The authorities that `vault` holds on a mint, or `null` if `data` is not a mint. Base fields
 * first, then the Token-2022 extensions (account type 1 at byte 165, entries from byte 166).
 */
export function parseMintAuthorities(data: Uint8Array, vault: Address): TokenAuthorityKind[] | null {
  const extended = data.length > 166 && data[165] === 1;
  if (data.length !== 82 && !extended) return null;
  const base = (
    [
      [TokenAuthorityKind.MintTokens, 0],
      [TokenAuthorityKind.FreezeAccount, 46],
    ] as const
  )
    .filter(([, tag]) => u32At(data, tag) === 1 && addressAt(data, tag + 4) === vault)
    .map(([kind]) => kind);
  const extensions: TokenAuthorityKind[] = [];
  for (let offset = 166; extended && offset + 4 <= data.length; ) {
    const type = u16At(data, offset);
    if (type === 0) break;
    const value = offset + 4;
    (EXTENSION_AUTHORITIES[type] ?? [])
      .filter(([, at]) => value + at + 32 <= data.length && addressAt(data, value + at) === vault)
      .forEach(([kind]) => extensions.push(kind));
    offset = value + u16At(data, offset + 2);
  }
  return [...base, ...extensions];
}

// Layouts: token account (165 bytes, or Token-2022 type 2 at byte 165), stake `Meta`, vote state.
const isTokenAccount = (data: Uint8Array) => data.length === 165 || (data.length > 165 && data[165] === 2);

/** The base fields of a token account, or `null` for other data (a Token-2022 mint has the same owner program). */
export function parseTokenAccount(
  data: Uint8Array,
): { mint: Address; owner: Address; amount: bigint; frozen: boolean } | null {
  if (!isTokenAccount(data)) return null;
  return { mint: addressAt(data, 0), owner: addressAt(data, 32), amount: u64At(data, 64), frozen: data[108] === 2 };
}

/**
 * The roles of `vault` in a token account: close authority (`COption` at 129) and delegate
 * (`COption` at 72, amount at 121). `null` if `data` is not a token account or `vault` has neither.
 */
export function parseTokenRole(account: Address, tokenProgram: Address, vault: Address, data: Uint8Array): InventoryTokenRole | null {
  const token = parseTokenAccount(data);
  if (!token) return null;
  const holds = (tag: number) => u32At(data, tag) === 1 && addressAt(data, tag + 4) === vault;
  const closeAuthority = holds(129);
  const delegatedAmount = holds(72) ? u64At(data, 121) : null;
  if (!closeAuthority && delegatedAmount === null) return null;
  return { account, tokenProgram, mint: token.mint, owner: token.owner, frozen: token.frozen, closeAuthority, delegatedAmount };
}

/** The roles that `vault` holds in an `Initialized` (1) or `Stake` (2) stake account: staker at 12, withdrawer at 44, custodian at 92. */
export function parseStake(stake: Address, vault: Address, data: Uint8Array): InventoryStake | null {
  if (data.length < 124 || ![1, 2].includes(u32At(data, 0))) return null;
  return {
    stake,
    staker: addressAt(data, 12) === vault,
    withdrawer: addressAt(data, 44) === vault,
    custodian: addressAt(data, 92) === vault,
  };
}

/** The withdrawer of a vote account: state versions 1..=3 (`V1_14_11`, `V3`, `V4`) keep it at bytes 36..68. */
export function parseVoteWithdrawer(data: Uint8Array): Address | null {
  if (data.length < 68 || ![1, 2, 3].includes(u32At(data, 0))) return null;
  return addressAt(data, 36);
}

/** Every token account, stake, vote account, program and mint that the v4 vault holds or controls. */
export async function getV4VaultInventory(
  rpc: Rpc<SolanaRpcApi>,
  input: {
    sourceMultisig: Address;
    vaultIndex?: number;
    scans?: InventoryScans;
    /** Mints to check that the scan cannot find: the vault holds only an extension authority. */
    extraMints?: readonly Address[];
  },
): Promise<V4VaultInventory> {
  const vaultIndex = input.vaultIndex ?? 0;
  const scans = { tokenRoles: true, stakes: true, voteAccounts: true, programs: true, mints: true, ...input.scans };
  const extraMints = input.extraMints ?? [];
  const vault = await vaultOf(input.sourceMultisig, vaultIndex, LEGACY_V4_PROGRAM_ADDRESS);
  const vaultBytes = addressEncoder.encode(vault);
  const warnings: string[] = [];
  const scan = async <T>(name: string, enabled: boolean, run: () => Promise<T[]>): Promise<T[]> => {
    if (!enabled) return [];
    try {
      return await run();
    } catch (error) {
      warnings.push(`${name} scan failed: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    }
  };
  const programAccounts = async (program: Address, filters: ReturnType<typeof memcmp>[], dataSize?: bigint) =>
    (
      await rpc
        .getProgramAccounts(program, {
          encoding: "base64",
          filters: dataSize === undefined ? filters : [...filters, { dataSize }],
        })
        .send()
    ).map(({ pubkey, account }) => ({ pubkey, data: fromBase64(account.data[0]) }));

  const { value: lamports } = await rpc.getBalance(vault).send();
  const tokens = (
    await Promise.all(
      [TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS].map((tokenProgram) =>
        scan(`token accounts (${tokenProgram})`, true, async () => {
          const { value } = await rpc.getTokenAccountsByOwner(vault, { programId: tokenProgram }, { encoding: "base64" }).send();
          const parsed = value.flatMap(({ pubkey, account }) => {
            const token = parseTokenAccount(fromBase64(account.data[0]));
            return token ? [{ pubkey, ...token }] : [];
          });
          return Promise.all(
            parsed.map(
              async ({ pubkey, mint, amount, frozen }): Promise<InventoryToken> => ({
                account: pubkey,
                tokenProgram,
                mint,
                amount,
                frozen,
                associated: (await findAssociatedTokenAddress(vault, mint, tokenProgram)) === pubkey,
              }),
            ),
          );
        }),
      ),
    )
  ).flat();

  const tokenRoles = await scan("token role", scans.tokenRoles, async () => {
    // The delegate (72) and the close authority (129): `COption` tag 1, then the key.
    const taggedKey = [1, 0, 0, 0, ...vaultBytes];
    const byAccount = new Map<Address, InventoryTokenRole>();
    for (const tokenProgram of [TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS]) {
      for (const offset of [72, 129]) {
        (await programAccounts(tokenProgram, [memcmp(offset, taggedKey)])).forEach(({ pubkey, data }) => {
          const role = parseTokenRole(pubkey, tokenProgram, vault, data);
          if (role) byAccount.set(pubkey, role);
        });
      }
    }
    return [...byAccount.values()];
  });

  const stakes = await scan("stake", scans.stakes, async () => {
    // Staker at 12, withdrawer at 44, lockup custodian at 92.
    const found = await Promise.all([12, 44, 92].map((offset) => programAccounts(STAKE_PROGRAM_ADDRESS, [memcmp(offset, vaultBytes)])));
    const byStake = new Map<Address, InventoryStake>();
    found.flat().forEach(({ pubkey, data }) => {
      const stake = parseStake(pubkey, vault, data);
      if (stake) byStake.set(pubkey, stake);
    });
    return [...byStake.values()];
  });

  const voteAccounts = await scan("vote", scans.voteAccounts, async () =>
    (await programAccounts(VOTE_PROGRAM_ADDRESS, [memcmp(36, vaultBytes)]))
      .filter(({ data }) => parseVoteWithdrawer(data) === vault)
      .map(({ pubkey }) => pubkey),
  );

  const programData = await scan("program", scans.programs, async () =>
    (
      await rpc
        .getProgramAccounts(BPF_LOADER_UPGRADEABLE_ADDRESS, {
          encoding: "base64",
          dataSlice: { offset: 0, length: 0 },
          filters: [memcmp(0, [3, 0, 0, 0]), memcmp(12, [1, ...vaultBytes])],
        })
        .send()
    ).map(({ pubkey }) => pubkey),
  );

  const mints = await scan("mint", scans.mints, async () => {
    const found = new Map<Address, InventoryMint>();
    const add = (mint: Address, tokenProgram: Address, data: Uint8Array) => {
      const authorities = parseMintAuthorities(data, vault);
      if (authorities && authorities.length > 0) found.set(mint, { mint, tokenProgram, authorities });
    };
    for (const tokenProgram of [TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS]) {
      const dataSize = tokenProgram === TOKEN_PROGRAM_ADDRESS ? 82n : undefined;
      // The RPC reads a filter at offset 0 of a token program as a 32-byte mint, so match the key only.
      for (const offset of [4, 50]) {
        (await programAccounts(tokenProgram, [memcmp(offset, vaultBytes)], dataSize)).forEach(({ pubkey, data }) =>
          add(pubkey, tokenProgram, data),
        );
      }
    }
    if (extraMints.length > 0) {
      const { value } = await rpc.getMultipleAccounts([...extraMints], { encoding: "base64" }).send();
      value.forEach((account, i) => {
        if (account) add(extraMints[i]!, account.owner, fromBase64(account.data[0]));
      });
    }
    return [...found.values()];
  });

  return { vaultIndex, vault, lamports, tokens, tokenRoles, stakes, voteAccounts, programData, mints, warnings };
}

/** The assets of one `multisigMigrate*` instruction, before the split into batch items. */
export type MigrationGroup =
  | { readonly class: "tokens"; readonly tokenProgram: Address; readonly closeSource: boolean; readonly items: readonly TokenItem[] }
  | { readonly class: "tokenAuthorities"; readonly tokenProgram: Address; readonly items: readonly TokenAuthorityItem[] }
  | { readonly class: "stakes"; readonly items: readonly Address[] }
  | { readonly class: "voteAccounts"; readonly items: readonly Address[] }
  | { readonly class: "programs"; readonly items: readonly Address[] }
  | { readonly class: "sol"; readonly keep: bigint };

export type MigrationOptions = {
  /** Close the v4 token accounts after the transfer (default true). The rent goes to the successor vault. */
  readonly closeTokenAccounts?: boolean;
  /** Move token accounts that are not associated token accounts by owner change, so they keep their address. */
  readonly preserveTokenAccountAddresses?: boolean;
  /** Move the SOL of the vault (default true). It is always the last item. */
  readonly sol?: boolean;
};

/**
 * The groups of an inventory, in the order that a migration moves them: tokens, token authorities,
 * stakes, vote accounts, programs, then SOL last (the vault pays the new token accounts first).
 */
export function inventoryGroups(
  inventory: V4VaultInventory,
  options: MigrationOptions = {},
): { groups: MigrationGroup[]; notes: string[] } {
  const close = options.closeTokenAccounts ?? true;
  const movable = inventory.tokens.filter((token) => !token.frozen);
  const keepsAddress = (token: InventoryToken) => options.preserveTokenAccountAddresses === true && !token.associated;
  const notes = [
    ...inventory.tokens.filter((token) => token.frozen).map((token) => `token account ${token.account} is frozen; it cannot move`),
    ...tokenRoleNotes(inventory),
  ];
  const ownerChanges = new Set(movable.filter(keepsAddress).map((token) => token.account));
  const tokenPrograms = [TOKEN_PROGRAM_ADDRESS, TOKEN_2022_PROGRAM_ADDRESS];
  const tokens = tokenPrograms.map(
    (tokenProgram): MigrationGroup => ({
      class: "tokens",
      tokenProgram,
      closeSource: close,
      items: movable
        .filter((token) => token.tokenProgram === tokenProgram && !keepsAddress(token) && (token.amount > 0n || close))
        .map((token) => ({ sourceTokenAccount: token.account, mint: token.mint })),
    }),
  );
  const tokenAuthorities = tokenPrograms.map(
    (tokenProgram): MigrationGroup => ({
      class: "tokenAuthorities",
      tokenProgram,
      items: [
        ...movable
          .filter((token) => token.tokenProgram === tokenProgram && keepsAddress(token))
          .map((token) => ({ account: token.account, kind: TokenAuthorityKind.AccountOwner })),
        ...closeAuthorityItems(inventory, tokenProgram, ownerChanges),
        ...inventory.mints
          .filter((mint) => mint.tokenProgram === tokenProgram)
          .flatMap((mint) => mint.authorities.map((kind) => ({ account: mint.mint, kind }))),
      ],
    }),
  );
  const others: MigrationGroup[] = [
    { class: "stakes", items: inventory.stakes.map((stake) => stake.stake) },
    { class: "voteAccounts", items: inventory.voteAccounts },
    { class: "programs", items: inventory.programData },
  ];
  const sol: MigrationGroup[] = (options.sol ?? true) && inventory.lamports > 0n ? [{ class: "sol", keep: 0n }] : [];
  const groups = [...tokens, ...tokenAuthorities, ...others].filter((group) => group.class !== "sol" && group.items.length > 0);
  return { groups: [...groups, ...sol], notes };
}

/**
 * `CloseAccount` items: accounts of other owners, and the vault's own accounts that move by owner
 * change. The token step closes or keeps the other accounts of the vault. Frozen accounts reject it.
 */
function closeAuthorityItems(
  inventory: V4VaultInventory,
  tokenProgram: Address,
  ownerChanges: ReadonlySet<Address>,
): TokenAuthorityItem[] {
  return inventory.tokenRoles
    .filter((role) => role.tokenProgram === tokenProgram && role.closeAuthority && !role.frozen)
    .filter((role) => role.owner !== inventory.vault || ownerChanges.has(role.account))
    .map((role) => ({ account: role.account, kind: TokenAuthorityKind.CloseAccount }));
}

/** Notes about the roles on accounts of other owners that cannot move. */
function tokenRoleNotes(inventory: V4VaultInventory): string[] {
  return inventory.tokenRoles
    .filter((role) => role.owner !== inventory.vault)
    .flatMap((role) => [
      ...(role.closeAuthority && role.frozen ? [`token account ${role.account} is frozen; its close authority cannot move`] : []),
      ...(role.delegatedAmount === null
        ? []
        : [
            `the vault is the delegate of token account ${role.account} (owner ${role.owner}) for ${role.delegatedAmount} tokens; ` +
              "this role cannot move, only the owner can change it",
          ]),
    ]);
}

/** One batch item: one `multisigMigrate*` instruction for a part of one group, with its measured size. */
export type MigrationItem = {
  readonly group: MigrationGroup;
  readonly instruction: Instruction;
  readonly messageBytes: number;
  readonly messageAccounts: number;
  readonly instructionTrace: number;
};

export type ChunkInput = MigrationSource & {
  readonly events?: boolean;
  readonly addressLookupTables?: AddressLookupTables;
  readonly limits?: MigrationLimits;
};

function groupInstruction(source: MigrationSource, group: MigrationGroup): Promise<Instruction> {
  switch (group.class) {
    case "sol":
      return getMigrateSolInstruction(source, group.keep);
    case "tokens":
      return getMigrateTokensInstruction(source, group);
    case "tokenAuthorities":
      return getMigrateTokenAuthoritiesInstruction(source, group);
    case "stakes":
      return getMigrateStakesInstruction(source, group.items);
    case "voteAccounts":
      return getMigrateVoteAccountsInstruction(source, group.items);
    case "programs":
      return getMigrateProgramsInstruction(source, group.items);
  }
}

async function migrationItem(input: ChunkInput, group: MigrationGroup): Promise<MigrationItem> {
  const sourceVault = await vaultOf(input.sourceMultisig, input.vaultIndex ?? 0, LEGACY_V4_PROGRAM_ADDRESS);
  const migrate = await groupInstruction(input, group);
  const instruction = input.events === false ? migrate : withEvents(migrate);
  const message = { vault: sourceVault, instructions: [instruction], addressLookupTables: input.addressLookupTables };
  const compiled = compileTransactionMessage(message);
  const loaded = compiled.addressTableLookups.reduce(
    (count, lookup) => count + lookup.writableIndexes.length + lookup.readonlyIndexes.length,
    0,
  );
  return {
    group,
    instruction,
    messageBytes: getTransactionMessageBytes(message).length,
    messageAccounts: compiled.accountKeys.length + loaded,
    instructionTrace: migrationInstructionTrace(group, input.events !== false),
  };
}

const withItems = (group: Exclude<MigrationGroup, { class: "sol" }>, items: readonly unknown[]) =>
  ({ ...group, items }) as MigrationGroup;

/**
 * Splits each group into batch items. Each item is the longest run of the group's items whose
 * compiled vault message stays within the limits. The order does not change.
 */
export async function chunkMigrationGroups(groups: readonly MigrationGroup[], input: ChunkInput): Promise<MigrationItem[]> {
  const limits = { ...DEFAULT_MIGRATION_LIMITS, ...input.limits };
  const fits = (item: MigrationItem) =>
    item.messageBytes <= limits.maxMessageBytes &&
    item.messageAccounts <= limits.maxMessageAccounts &&
    item.instructionTrace <= limits.maxInstructionTrace;
  const fitting = async (group: MigrationGroup) => {
    const item = await migrationItem(input, group);
    if (!fits(item)) throw new Error("one asset does not fit in a batch item; raise the limits or use lookup tables");
    return item;
  };
  const items: MigrationItem[] = [];
  for (const group of groups) {
    if (group.class === "sol") {
      items.push(await fitting(group));
      continue;
    }
    let run: unknown[] = [];
    let current: MigrationItem | null = null;
    for (const entry of group.items) {
      const grown = await migrationItem(input, withItems(group, [...run, entry]));
      if (fits(grown)) {
        run = [...run, entry];
        current = grown;
        continue;
      }
      if (current) items.push(current);
      run = [entry];
      current = await fitting(withItems(group, run));
    }
    if (current) items.push(current);
  }
  return items;
}

/** The governance that the migrate instructions compare. `configAuthority` is already mapped. */
function sameGovernance(source: Multisig, successor: Multisig, configAuthority: Address): boolean {
  const members = (multisig: Multisig) => multisig.members.map((m) => `${m.key}:${m.permissions.mask}`).join();
  return (
    members(source) === members(successor) &&
    source.threshold === successor.threshold &&
    source.timeLock === successor.timeLock &&
    successor.configAuthority === configAuthority
  );
}

export type V4MigrationPlan = {
  readonly sourceMultisig: Address;
  readonly vaultIndex: number;
  readonly sourceVault: Address;
  readonly successor: Address;
  readonly vault: Address;
  readonly programAddress: Address;
  readonly configAuthorityVaultIndex: number | null;
  readonly events: boolean;
  /** `multisigCreateFrom`, when the successor does not exist yet. */
  readonly createSuccessor: Instruction | null;
  /** The 4r creation fee in lamports, also the `maxCreationFee` of `createSuccessor`. */
  readonly creationFee: bigint | null;
  /** `null` until the successor exists. `false`: every migrate instruction fails until both agree. */
  readonly governanceMatches: boolean | null;
  readonly inventory: V4VaultInventory;
  readonly groups: readonly MigrationGroup[];
  readonly items: readonly MigrationItem[];
  /** The lookup tables that the vault messages use (empty: none). */
  readonly addressLookupTables: AddressLookupTables;
  readonly warnings: readonly string[];
};

export type PlanInput = MigrationOptions & {
  readonly sourceMultisig: Address;
  readonly vaultIndex?: number;
  readonly programAddress?: Address;
  readonly events?: boolean;
  /** Default: {@link DEFAULT_MIGRATION_LIMITS}, or {@link LOOKUP_TABLE_MIGRATION_LIMITS} with tables. */
  readonly limits?: MigrationLimits;
  readonly addressLookupTables?: AddressLookupTables;
  readonly scans?: InventoryScans;
  readonly extraMints?: readonly Address[];
  readonly inventory?: V4VaultInventory;
};

const hasTables = (tables: AddressLookupTables) => Object.keys(tables).length > 0;

/**
 * Plans the move of one v4 vault to its successor: the successor creation (if needed) and the
 * batch items. It reads the chain and sends nothing.
 */
export async function planV4Migration(rpc: Rpc<SolanaRpcApi>, input: PlanInput): Promise<V4MigrationPlan> {
  const { sourceMultisig } = input;
  const vaultIndex = input.vaultIndex ?? 0;
  const programAddress = input.programAddress ?? SQUADS_MULTISIG4R_PROGRAM_ADDRESS;
  const events = input.events ?? true;
  const r4 = { programAddress };
  const { data: source } = await fetchMultisigChecked(rpc, sourceMultisig, v4);
  const [successor] = await findSuccessorPda({ sourceMultisig }, r4);
  const sourceVault = await vaultOf(sourceMultisig, vaultIndex, LEGACY_V4_PROGRAM_ADDRESS);
  const vault = await vaultOf(successor, vaultIndex, programAddress);
  const configAuthorityVaultIndex = await findV4VaultIndex(sourceMultisig, source.configAuthority);
  const rentCollector = source.rentCollector.__option === "Some" ? source.rentCollector.value : null;
  const rentCollectorVaultIndex = rentCollector ? await findV4VaultIndex(sourceMultisig, rentCollector) : null;
  const mappedConfigAuthority =
    configAuthorityVaultIndex === null ? source.configAuthority : await vaultOf(successor, configAuthorityVaultIndex, programAddress);

  const existing = await fetchMaybeMultisig(rpc, successor);
  const governanceMatches = existing.exists
    ? sameGovernance(source, (await fetchMultisigChecked(rpc, successor, r4)).data, mappedConfigAuthority)
    : null;
  let createSuccessor: Instruction | null = null;
  let creationFee: bigint | null = null;
  if (!existing.exists) {
    const [programConfig] = await findProgramConfigPda(r4);
    const { data: config } = await fetchProgramConfigChecked(rpc, programConfig, r4);
    const create = getMultisigCreateFromInstruction(
      {
        programConfig,
        treasury: config.treasury,
        sourceMultisig,
        sourceVault: createNoopSigner(sourceVault),
        multisig: successor,
        vaultIndex,
        configAuthorityVaultIndex,
        rentCollectorVaultIndex,
        // The members approve the fee that the plan sees; a higher fee at execution fails.
        maxCreationFee: config.multisigCreationFee,
        memo: null,
      },
      r4,
    );
    createSuccessor = events ? withEvents(create) : create;
    creationFee = config.multisigCreationFee;
  }

  const inventory =
    input.inventory ??
    (await getV4VaultInventory(rpc, { sourceMultisig, vaultIndex, scans: input.scans, extraMints: input.extraMints }));
  const { groups, notes } = inventoryGroups(inventory, input);
  const addressLookupTables = input.addressLookupTables ?? {};
  const limits = input.limits ?? (hasTables(addressLookupTables) ? LOOKUP_TABLE_MIGRATION_LIMITS : DEFAULT_MIGRATION_LIMITS);
  const items = await chunkMigrationGroups(groups, {
    sourceMultisig,
    vaultIndex,
    configAuthorityVaultIndex,
    programAddress,
    events,
    addressLookupTables,
    limits,
  });
  const newTokenAccounts = await countNewTokenAccounts(rpc, groups, vault);
  const warnings = [
    ...inventory.warnings,
    ...notes,
    ...(governanceMatches === false ? ["the successor governance differs from v4: the migrate instructions fail until they agree"] : []),
    ...(inventory.lamports < newTokenAccounts * ATA_RENT_ESTIMATE
      ? [`the v4 vault has too little SOL for ${newTokenAccounts} new token accounts of the successor; fund it first`]
      : []),
  ];
  return {
    sourceMultisig,
    vaultIndex,
    sourceVault,
    successor,
    vault,
    programAddress,
    configAuthorityVaultIndex,
    events,
    createSuccessor,
    creationFee,
    governanceMatches,
    inventory,
    groups,
    items,
    addressLookupTables,
    warnings,
  };
}

/** The successor token accounts that the migration creates (the v4 vault pays their rent). */
async function countNewTokenAccounts(rpc: Rpc<SolanaRpcApi>, groups: readonly MigrationGroup[], vault: Address): Promise<bigint> {
  const destinations = await Promise.all(
    groups.flatMap((group) =>
      group.class === "tokens" ? group.items.map((item) => findAssociatedTokenAddress(vault, item.mint, group.tokenProgram)) : [],
    ),
  );
  if (destinations.length === 0) return 0n;
  const { value } = await rpc.getMultipleAccounts([...new Set(destinations)], { encoding: "base64" }).send();
  return BigInt(value.filter((account) => account === null).length);
}

/** The accounts of a plan's items that lookup tables can hold (no signers, no programs). */
export function getMigrationLookupTableAddresses(plan: V4MigrationPlan): Address[] {
  return getLookupTableAddresses(plan.items.map((item) => item.instruction));
}

/** The same plan, split again for `addressLookupTables`. Fewer, larger items. */
export async function withMigrationLookupTables(
  plan: V4MigrationPlan,
  addressLookupTables: AddressLookupTables,
  limits: MigrationLimits = LOOKUP_TABLE_MIGRATION_LIMITS,
): Promise<V4MigrationPlan> {
  const items = await chunkMigrationGroups(plan.groups, {
    sourceMultisig: plan.sourceMultisig,
    vaultIndex: plan.vaultIndex,
    configAuthorityVaultIndex: plan.configAuthorityVaultIndex,
    programAddress: plan.programAddress,
    events: plan.events,
    addressLookupTables,
    limits,
  });
  return { ...plan, items, addressLookupTables };
}

/** The v4 proposals of a plan: the transactions to send in order, and the v4 transaction indexes. */
export type V4MigrationProposal = {
  readonly transactions: readonly Instruction[][];
  /** The v4 vault transaction with `multisigCreateFrom`, if the plan creates the successor. */
  readonly createIndex: bigint | null;
  /** The v4 batch with one migrate instruction in each entry, if the plan moves assets. */
  readonly batchIndex: bigint | null;
};

/** Builds the v4 proposals of a plan, from the current v4 `transaction_index`. Sends nothing. */
export async function getV4MigrationProposal(
  rpc: Rpc<SolanaRpcApi>,
  plan: V4MigrationPlan,
  input: { member: TransactionSigner; rentPayer?: TransactionSigner; approve?: boolean },
): Promise<V4MigrationProposal> {
  const { member } = input;
  const rentPayer = input.rentPayer ?? member;
  const multisig = plan.sourceMultisig;
  const approve = (proposal: Address) =>
    input.approve === false ? [] : [getProposalApproveInstruction({ multisig, member, proposal, memo: null }, v4)];
  const messageOf = (instruction: Instruction) =>
    getTransactionMessageBytes({
      vault: plan.sourceVault,
      instructions: [instruction],
      addressLookupTables: plan.addressLookupTables,
    });
  let index = (await fetchMultisigChecked(rpc, multisig, v4)).data.transactionIndex;
  const transactions: Instruction[][] = [];
  let createIndex: bigint | null = null;

  if (plan.createSuccessor) {
    index += 1n;
    createIndex = index;
    const [transaction] = await findTransactionPda({ multisig, index }, v4);
    const [proposal] = await findProposalPda({ multisig, transactionIndex: index }, v4);
    transactions.push(
      [
        getVaultTransactionCreateInstruction(
          {
            multisig,
            transaction,
            creator: member,
            rentPayer,
            vaultIndex: plan.vaultIndex,
            ephemeralSigners: 0,
            // The creation is small: no lookup tables, so it never waits for them.
            transactionMessage: getTransactionMessageBytes({ vault: plan.sourceVault, instructions: [plan.createSuccessor] }),
            memo: "create the 4r successor",
          },
          v4,
        ),
      ],
      [getProposalCreateInstruction({ multisig, proposal, creator: member, rentPayer, transactionIndex: index, draft: false }, v4), ...approve(proposal)],
    );
  }
  if (plan.items.length === 0) return { transactions, createIndex, batchIndex: null };

  index += 1n;
  const [batch] = await findTransactionPda({ multisig, index }, v4);
  const [proposal] = await findProposalPda({ multisig, transactionIndex: index }, v4);
  transactions.push([
    getBatchCreateInstruction({ multisig, batch, creator: member, rentPayer, vaultIndex: plan.vaultIndex, memo: "migrate to 4r" }, v4),
    getProposalCreateInstruction({ multisig, proposal, creator: member, rentPayer, transactionIndex: index, draft: true }, v4),
  ]);
  for (const [i, item] of plan.items.entries()) {
    const [transaction] = await findBatchTransactionPda({ multisig, batchIndex: index, transactionIndex: i + 1 }, v4);
    transactions.push([
      getBatchAddTransactionInstruction(
        {
          multisig,
          proposal,
          batch,
          transaction,
          member,
          rentPayer,
          ephemeralSigners: 0,
          transactionMessage: messageOf(item.instruction),
        },
        v4,
      ),
    ]);
  }
  transactions.push([getProposalActivateInstruction({ multisig, member, proposal }, v4), ...approve(proposal)]);
  return { transactions, createIndex, batchIndex: index };
}

/** The execute instruction of an approved v4 vault transaction. */
export async function getV4VaultTransactionExecuteInstruction(
  rpc: Rpc<SolanaRpcApi>,
  input: { sourceMultisig: Address; transactionIndex: bigint; member: TransactionSigner; addressLookupTables?: AddressLookupTables },
): Promise<Instruction> {
  const multisig = input.sourceMultisig;
  const [transaction] = await findTransactionPda({ multisig, index: input.transactionIndex }, v4);
  const [proposal] = await findProposalPda({ multisig, transactionIndex: input.transactionIndex }, v4);
  const { data } = await fetchVaultTransactionChecked(rpc, transaction, v4);
  return getVaultTransactionExecuteInstructionWithAccounts(
    {
      multisig,
      proposal,
      transaction,
      member: input.member,
      message: data.message,
      vaultIndex: data.vaultIndex,
      addressLookupTables: input.addressLookupTables,
    },
    v4,
  );
}

/**
 * The execute instruction of each entry of an approved v4 batch that is not executed yet. Send
 * them in order. With lookup tables, compile each execute transaction with the same tables.
 */
export async function getV4BatchExecuteInstructions(
  rpc: Rpc<SolanaRpcApi>,
  input: { sourceMultisig: Address; batchIndex: bigint; member: TransactionSigner; addressLookupTables?: AddressLookupTables },
): Promise<Instruction[]> {
  const multisig = input.sourceMultisig;
  const [batch] = await findTransactionPda({ multisig, index: input.batchIndex }, v4);
  const [proposal] = await findProposalPda({ multisig, transactionIndex: input.batchIndex }, v4);
  const { data } = await fetchBatchChecked(rpc, batch, v4);
  const entries = Array.from({ length: data.size - data.executedTransactionIndex }, (_, i) => data.executedTransactionIndex + i + 1);
  return Promise.all(
    entries.map(async (entryIndex) => {
      const [entry] = await findBatchTransactionPda({ multisig, batchIndex: input.batchIndex, transactionIndex: entryIndex }, v4);
      const { data: entryData } = await fetchVaultBatchTransactionChecked(rpc, entry, v4);
      const execute = getBatchExecuteTransactionInstruction({ multisig, member: input.member, proposal, batch, transaction: entry }, v4);
      const remaining = await getAccountsForExecute({
        message: entryData.message,
        multisig,
        vaultIndex: data.vaultIndex,
        transaction: entry,
        addressLookupTables: input.addressLookupTables,
        programAddress: LEGACY_V4_PROGRAM_ADDRESS,
      });
      return { ...execute, accounts: [...execute.accounts, ...remaining] };
    }),
  );
}
