/**
 * The v3 to 4r planner: refuses roles delegate members, plans one v3 transaction (the successor
 * creation first, then one migrate instruction per item), and builds its proposal and executes.
 */
import {
  createNoopSigner,
  type Address,
  type Base64EncodedDataResponse,
  type Instruction,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from "@solana/kit";

import { withEvents } from "./events";
import { fetchMultisigChecked, fetchProgramConfigChecked } from "./fetch";
import {
  fetchMaybeMultisig,
  findProgramConfigPda,
  findSuccessorPda,
  findVaultPda,
  getMultisigCreateFromV3Instruction,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  type Multisig,
} from "./generated";
import type { AddressLookupTables } from "./message";
import {
  ATA_RENT_ESTIMATE,
  chunkMigrationGroups,
  countNewTokenAccounts,
  getVaultInventory,
  inventoryGroups,
  memberReportWarnings,
  memberSigningReport,
  V3_MIGRATION_LIMITS,
  vaultAddresses,
  type InventoryScans,
  type MemberSigningReport,
  type MigrationGroup,
  type MigrationItem,
  type MigrationLimits,
  type MigrationOptions,
  type V4VaultInventory,
} from "./planner";
import {
  decodeV3Instruction,
  decodeV3Multisig,
  decodeV3RolesManager,
  decodeV3RolesUser,
  decodeV3Transaction,
  findV3AuthorityPda,
  findV3DelegatePda,
  findV3InstructionPda,
  findV3RolesManagerPda,
  findV3RolesUserPda,
  findV3TransactionPda,
  getV3ActivateTransactionInstruction,
  getV3AddInstructionInstruction,
  getV3ApproveTransactionInstruction,
  getV3CreateTransactionInstruction,
  getV3ExecuteInstructionInstruction,
  LEGACY_V3_PROGRAM_ADDRESS,
  V3_ROLES_PROGRAM_ADDRESS,
  v3VaultIndex,
  V3Role,
  type V3Multisig,
} from "./v3";

/** A v3 member that is a roles delegate: only the roles program signs for it. */
export type V3DelegateMember = {
  readonly delegate: Address;
  /** The roles `User` account. */
  readonly user: Address;
  /** The wallet that signs for the delegate in v3; the member that replaces it. */
  readonly originKey: Address;
  readonly role: V3Role;
  readonly name: string;
};

/** The v3 multisig has roles delegate members. They can never sign 4r instructions. */
export class V3DelegateMembersError extends Error {
  constructor(
    readonly sourceMultisig: Address,
    readonly delegates: readonly V3DelegateMember[],
  ) {
    const lines = delegates.map(
      (member) => `  - ${member.delegate} -> ${member.originKey} (role ${V3Role[member.role]}, user "${member.name}")`,
    );
    super(
      [
        `v3 multisig ${sourceMultisig} has ${delegates.length} roles delegate member(s). A delegate signs only through`,
        "the v3 roles program, so it can never sign in 4r, and the successor would copy it as a member.",
        "Before you migrate, change the v3 members in a v3 transaction of authority 0: for each delegate,",
        "add_member(wallet) and remove_member(delegate); then check the threshold, which counts each member once.",
        "Delegate -> wallet:",
        ...lines,
      ].join("\n"),
    );
    this.name = "V3DelegateMembersError";
  }
}

const decodeBase64 = (data: Base64EncodedDataResponse) => Uint8Array.from(Buffer.from(data[0], "base64"));

async function fetchAccountsInChunks(rpc: Rpc<SolanaRpcApi>, addresses: readonly Address[]) {
  const chunks = Array.from({ length: Math.ceil(addresses.length / 100) }, (_, i) => addresses.slice(i * 100, i * 100 + 100));
  const values = await Promise.all(chunks.map((chunk) => rpc.getMultipleAccounts([...chunk], { encoding: "base64" }).send()));
  return values.flatMap(({ value }) => value);
}

/**
 * The roles delegates among `keys`, from every roles user (1 to `role_index`) of `sourceMultisig`.
 * Users cannot be removed or change their wallet, so this finds every delegate.
 */
export async function findV3DelegateMembers(
  rpc: Rpc<SolanaRpcApi>,
  sourceMultisig: Address,
  keys: readonly Address[],
): Promise<V3DelegateMember[]> {
  const { value: manager } = await rpc.getAccountInfo(await findV3RolesManagerPda(sourceMultisig), { encoding: "base64" }).send();
  const decoded = manager?.owner === V3_ROLES_PROGRAM_ADDRESS ? decodeV3RolesManager(decodeBase64(manager.data)) : null;
  if (!decoded || decoded.ms !== sourceMultisig) return [];
  const users = await Promise.all(Array.from({ length: decoded.roleIndex }, (_, i) => findV3RolesUserPda(sourceMultisig, i + 1)));
  const accounts = await fetchAccountsInChunks(rpc, users);
  const members = new Set(keys);
  const found = await Promise.all(
    users.map(async (user, i) => {
      const account = accounts[i];
      const data = account?.owner === V3_ROLES_PROGRAM_ADDRESS ? decodeV3RolesUser(decodeBase64(account.data)) : null;
      if (!data || data.ms !== sourceMultisig) return null;
      const delegate = await findV3DelegatePda(user, data.originKey);
      return members.has(delegate) ? { delegate, user, originKey: data.originKey, role: data.role, name: data.name } : null;
    }),
  );
  return found.filter((member): member is V3DelegateMember => member !== null);
}

/** The successor governance that `multisig_create_from_v3` writes and every v3 migrate compares. */
function sameGovernanceV3(source: V3Multisig, successor: Multisig): boolean {
  const expected = [...source.keys].sort().map((key) => `${key}:7`).join();
  const members = successor.members.map((member) => `${member.key}:${member.permissions.mask}`).join();
  return (
    members === expected &&
    successor.threshold === source.threshold &&
    successor.timeLock === 0 &&
    successor.configAuthority === "11111111111111111111111111111111"
  );
}

export type V3MigrationPlan = {
  readonly lineage: "v3";
  readonly sourceMultisig: Address;
  readonly authorityIndex: number;
  /** The v3 authority that signs and pays. */
  readonly sourceVault: Address;
  readonly successor: Address;
  /** The successor vault `authorityIndex - 1`. */
  readonly vaultIndex: number;
  readonly vault: Address;
  readonly programAddress: Address;
  readonly events: boolean;
  /** `multisigCreateFromV3`, when the successor does not exist yet. It runs first. */
  readonly createSuccessor: Instruction | null;
  readonly creationFee: bigint | null;
  /** `null` until the successor exists. `false`: every migrate instruction fails until both agree. */
  readonly governanceMatches: boolean | null;
  readonly inventory: V4VaultInventory;
  readonly groups: readonly MigrationGroup[];
  readonly items: readonly MigrationItem[];
  /** The lookup tables of the execute transactions (the attached instructions cannot use them). */
  readonly addressLookupTables: AddressLookupTables;
  readonly memberReport: MemberSigningReport;
  readonly warnings: readonly string[];
};

export type V3PlanInput = MigrationOptions & {
  readonly sourceMultisig: Address;
  /** The v3 authority (1 to 256); default 1, the v3 default vault. */
  readonly authorityIndex?: number;
  readonly programAddress?: Address;
  readonly events?: boolean;
  /** Default: {@link V3_MIGRATION_LIMITS}. */
  readonly limits?: MigrationLimits;
  readonly addressLookupTables?: AddressLookupTables;
  readonly scans?: InventoryScans;
  readonly extraMints?: readonly Address[];
  readonly inventory?: V4VaultInventory;
};

/**
 * Plans the move of one v3 authority to its successor vault. Throws {@link V3DelegateMembersError}
 * when a v3 member is a roles delegate: change the v3 members first.
 */
export async function planV3Migration(rpc: Rpc<SolanaRpcApi>, input: V3PlanInput): Promise<V3MigrationPlan> {
  const { sourceMultisig } = input;
  const authorityIndex = input.authorityIndex ?? 1;
  const vaultIndex = v3VaultIndex(authorityIndex);
  const programAddress = input.programAddress ?? SQUADS_MULTISIG4R_PROGRAM_ADDRESS;
  const events = input.events ?? true;
  const r4 = { programAddress };
  const { value: account } = await rpc.getAccountInfo(sourceMultisig, { encoding: "base64" }).send();
  const source = account?.owner === LEGACY_V3_PROGRAM_ADDRESS ? decodeV3Multisig(decodeBase64(account.data)) : null;
  if (!source) throw new Error(`${sourceMultisig} is not a v3 multisig`);
  const delegates = await findV3DelegateMembers(rpc, sourceMultisig, source.keys);
  if (delegates.length > 0) throw new V3DelegateMembersError(sourceMultisig, delegates);

  const [successor] = await findSuccessorPda({ sourceMultisig }, r4);
  const sourceVault = await findV3AuthorityPda(sourceMultisig, authorityIndex);
  const [vault] = await findVaultPda({ multisig: successor, index: vaultIndex }, r4);
  const existing = await fetchMaybeMultisig(rpc, successor);
  const governanceMatches = existing.exists ? sameGovernanceV3(source, (await fetchMultisigChecked(rpc, successor, r4)).data) : null;
  let createSuccessor: Instruction | null = null;
  let creationFee: bigint | null = null;
  if (!existing.exists) {
    const [programConfig] = await findProgramConfigPda(r4);
    const { data: config } = await fetchProgramConfigChecked(rpc, programConfig, r4);
    const create = getMultisigCreateFromV3Instruction(
      {
        programConfig,
        treasury: config.treasury,
        sourceMultisig,
        sourceVault: createNoopSigner(sourceVault),
        multisig: successor,
        authorityIndex,
        // The members approve the fee that the plan sees; a higher fee at execution fails.
        maxCreationFee: config.multisigCreationFee,
        memo: null,
      },
      r4,
    );
    createSuccessor = events ? withEvents(create) : create;
    creationFee = config.multisigCreationFee;
  }

  const inventory = input.inventory ?? (await getVaultInventory(rpc, { vault: sourceVault, vaultIndex, scans: input.scans, extraMints: input.extraMints }));
  const { groups, notes } = inventoryGroups(inventory, input);
  const addressLookupTables = input.addressLookupTables ?? {};
  const items = await chunkMigrationGroups(groups, {
    lineage: "v3",
    sourceMultisig,
    authorityIndex,
    programAddress,
    events,
    addressLookupTables,
    limits: input.limits ?? V3_MIGRATION_LIMITS,
  });
  const knownVaults = new Set([
    ...(await Promise.all(Array.from({ length: 256 }, (_, i) => findV3AuthorityPda(sourceMultisig, i + 1)))),
    ...(await vaultAddresses(successor, programAddress)),
  ]);
  const memberReport = memberSigningReport(
    source.keys.map((key) => ({ key, votes: true })),
    source.threshold,
    knownVaults,
  );
  const newTokenAccounts = await countNewTokenAccounts(rpc, groups, vault);
  const needed = newTokenAccounts * ATA_RENT_ESTIMATE + (creationFee ?? 0n);
  const warnings = [
    ...inventory.warnings,
    ...notes,
    ...memberReportWarnings(memberReport),
    ...(governanceMatches === false ? ["the successor governance differs from v3: the migrate instructions fail until they agree"] : []),
    ...(inventory.lamports < needed
      ? [`the v3 authority has too little SOL for ${newTokenAccounts} new token accounts and the creation fee; fund it first`]
      : []),
  ];
  return {
    lineage: "v3",
    sourceMultisig,
    authorityIndex,
    sourceVault,
    successor,
    vaultIndex,
    vault,
    programAddress,
    events,
    createSuccessor,
    creationFee,
    governanceMatches,
    inventory,
    groups,
    items,
    addressLookupTables,
    memberReport,
    warnings,
  };
}

/** The v3 proposal of a plan: the transactions to send in order, and the v3 transaction index. */
export type V3MigrationProposal = {
  readonly transactions: readonly Instruction[][];
  readonly transactionIndex: number;
  /** The attached instructions, in execution order: the successor creation first, if any. */
  readonly instructions: readonly Instruction[];
};

/**
 * One v3 transaction of the plan's authority: the creation (if needed), then every item. `member`
 * creates, attaches, activates and (by default) approves it; members execute it one by one.
 */
export async function getV3MigrationProposal(
  rpc: Rpc<SolanaRpcApi>,
  plan: V3MigrationPlan,
  input: { member: TransactionSigner; approve?: boolean },
): Promise<V3MigrationProposal> {
  const { member } = input;
  const multisig = plan.sourceMultisig;
  const { value: account } = await rpc.getAccountInfo(multisig, { encoding: "base64" }).send();
  const source = account ? decodeV3Multisig(decodeBase64(account.data)) : null;
  if (!source) throw new Error(`${multisig} is not a v3 multisig`);
  const instructions = [...(plan.createSuccessor ? [plan.createSuccessor] : []), ...plan.items.map((item) => item.instruction)];
  if (instructions.length > 255) throw new Error("a v3 transaction holds at most 255 instructions; split the plan");
  const transactionIndex = source.transactionIndex + 1;
  const transaction = await findV3TransactionPda(multisig, transactionIndex);
  const attach = await Promise.all(
    instructions.map(async (instruction, i) => [
      getV3AddInstructionInstruction({
        multisig,
        transaction,
        instructionAccount: await findV3InstructionPda(transaction, i + 1),
        creator: member,
        instruction,
      }),
    ]),
  );
  const vote = { multisig, transaction, member };
  return {
    transactionIndex,
    instructions,
    transactions: [
      [getV3CreateTransactionInstruction({ multisig, transaction, creator: member, authorityIndex: plan.authorityIndex })],
      ...attach,
      [getV3ActivateTransactionInstruction(vote), ...(input.approve === false ? [] : [getV3ApproveTransactionInstruction(vote)])],
    ],
  };
}

/**
 * The `execute_instruction` call of each attached instruction of an approved v3 transaction that
 * has not run yet, in order. Send them one at a time: a later one needs the earlier ones.
 */
export async function getV3ExecuteInstructions(
  rpc: Rpc<SolanaRpcApi>,
  input: { sourceMultisig: Address; transactionIndex: number; member: TransactionSigner },
): Promise<Instruction[]> {
  const multisig = input.sourceMultisig;
  const transaction = await findV3TransactionPda(multisig, input.transactionIndex);
  const { value: account } = await rpc.getAccountInfo(transaction, { encoding: "base64" }).send();
  const data = account?.owner === LEGACY_V3_PROGRAM_ADDRESS ? decodeV3Transaction(decodeBase64(account.data)) : null;
  if (!data) throw new Error(`${transaction} is not a v3 transaction`);
  const pending = Array.from({ length: data.instructionIndex - data.executedIndex }, (_, i) => data.executedIndex + i + 1);
  const instructionAccounts = await Promise.all(pending.map((index) => findV3InstructionPda(transaction, index)));
  const attached = await fetchAccountsInChunks(rpc, instructionAccounts);
  return instructionAccounts.map((instructionAccount, i) => {
    const decoded = attached[i] ? decodeV3Instruction(decodeBase64(attached[i].data)) : null;
    if (!decoded) throw new Error(`${instructionAccount} is not a v3 instruction`);
    return getV3ExecuteInstructionInstruction({ multisig, transaction, instructionAccount, member: input.member, attached: decoded });
  });
}
