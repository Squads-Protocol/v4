/**
 * A client for the frozen Squads v3 program (Squads MPL) and its roles program, for v3 to 4r
 * migrations. Hand-written from the v3 source (Anchor 0.26); no v3 crate dependency.
 */
import {
  AccountRole,
  address,
  addDecoderSizePrefix,
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  compressTransactionMessageUsingAddressLookupTables,
  createNoopSigner,
  createTransactionMessage,
  getCompiledTransactionMessageEncoder,
  getAddressDecoder,
  getAddressEncoder,
  getArrayDecoder,
  getBooleanDecoder,
  getBytesDecoder,
  getEnumDecoder,
  getProgramDerivedAddress,
  getStructDecoder,
  getU16Decoder,
  getU32Decoder,
  getU32Encoder,
  getU8Decoder,
  getUtf8Decoder,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type AccountMeta,
  type Address,
  type Decoder,
  type Instruction,
  type Blockhash,
  type ReadonlyUint8Array,
  type TransactionSigner,
} from "@solana/kit";

import type { AddressLookupTables } from "./message";

/** The frozen v3 program. It has no upgrade authority. */
export const LEGACY_V3_PROGRAM_ADDRESS = address("SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu");
/** The v3 roles program. Its delegate PDAs can be v3 members; they sign only into v3. */
export const V3_ROLES_PROGRAM_ADDRESS = address("SMPLvKJwsyNGD6xf7Ph6VRpDGPa3DXV4uPHcTAnXe6r");
/** The highest v3 authority index with a 4r successor vault (`authorityIndex - 1` fits a `u8`). */
export const V3_MAX_AUTHORITY_INDEX = 256;

const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");
const RENT_SYSVAR_ADDRESS = address("SysvarRent111111111111111111111111111111111");

const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (byte) => parseInt(byte, 16));

/** Anchor discriminators: `sha256("account:<Name>")[..8]` and `sha256("global:<name>")[..8]`. */
export const V3_DISCRIMINATORS = {
  ms: fromHex("4676096cfed71f78"),
  msTransaction: fromHex("b69768d8ff01139d"),
  msInstruction: fromHex("eeb97e95bd59ff5c"),
  rolesManager: fromHex("3a22647eda3bae08"),
  rolesUser: fromHex("9f755fe3ef973aec"),
  create: fromHex("181ec828051c0777"),
  createTransaction: fromHex("e3c135ef377e7069"),
  addInstruction: fromHex("0b4688a6ca37f64a"),
  activateTransaction: fromHex("381100a3870b8720"),
  approveTransaction: fromHex("e02758b5243b9b7a"),
  executeInstruction: fromHex("301228284b4a936e"),
  executeTransaction: fromHex("e7ad315beb184413"),
  addMember: fromHex("0d747b827ec63922"),
  removeMember: fromHex("ab39e796a7801237"),
  changeThreshold: fromHex("9297d53f794f091d"),
} as const;

/** The 4r successor vault index of v3 authority `authorityIndex`: `authorityIndex - 1`. */
export function v3VaultIndex(authorityIndex: number): number {
  if (!Number.isInteger(authorityIndex) || authorityIndex < 1 || authorityIndex > V3_MAX_AUTHORITY_INDEX) {
    throw new RangeError(`v3 authority index ${authorityIndex} is not between 1 and ${V3_MAX_AUTHORITY_INDEX}`);
  }
  return authorityIndex - 1;
}

const encodeAddress = (value: Address) => getAddressEncoder().encode(value);
const u32 = (value: number) => getU32Encoder().encode(value);
const concat = (...parts: readonly ReadonlyUint8Array[]) => Uint8Array.from(parts.flatMap((part) => [...part]));

async function v3Pda(programAddress: Address, seeds: readonly (string | ReadonlyUint8Array)[]): Promise<Address> {
  const [pda] = await getProgramDerivedAddress({ programAddress, seeds: [...seeds] });
  return pda;
}

export const findV3MultisigPda = (createKey: Address) =>
  v3Pda(LEGACY_V3_PROGRAM_ADDRESS, ["squad", encodeAddress(createKey), "multisig"]);
/** v3 signs for it after the approvals; index 0 is the multisig itself and never signs outside v3. */
export const findV3AuthorityPda = (multisig: Address, authorityIndex: number) =>
  v3Pda(LEGACY_V3_PROGRAM_ADDRESS, ["squad", encodeAddress(multisig), u32(authorityIndex), "authority"]);
export const findV3TransactionPda = (multisig: Address, transactionIndex: number) =>
  v3Pda(LEGACY_V3_PROGRAM_ADDRESS, ["squad", encodeAddress(multisig), u32(transactionIndex), "transaction"]);
export const findV3InstructionPda = (transaction: Address, instructionIndex: number) =>
  v3Pda(LEGACY_V3_PROGRAM_ADDRESS, ["squad", encodeAddress(transaction), Uint8Array.of(instructionIndex), "instruction"]);
export const findV3RolesManagerPda = (multisig: Address) =>
  v3Pda(V3_ROLES_PROGRAM_ADDRESS, ["squad", encodeAddress(multisig), "roles-manager"]);
export const findV3RolesUserPda = (multisig: Address, roleIndex: number) =>
  v3Pda(V3_ROLES_PROGRAM_ADDRESS, ["squad", encodeAddress(multisig), u32(roleIndex), "user-role"]);
/** The member key of a roles user: v3 sees it, and only the roles program signs for it. */
export const findV3DelegatePda = (user: Address, originKey: Address) =>
  v3Pda(V3_ROLES_PROGRAM_ADDRESS, ["squad", encodeAddress(user), encodeAddress(originKey), "delegate"]);

export type V3Multisig = {
  readonly threshold: number;
  readonly authorityIndex: number;
  readonly transactionIndex: number;
  readonly msChangeIndex: number;
  readonly bump: number;
  readonly createKey: Address;
  readonly allowExternalExecute: boolean;
  /** The members, sorted by v3. */
  readonly keys: readonly Address[];
};

export enum V3TransactionStatus {
  Draft,
  Active,
  ExecuteReady,
  Executed,
  Rejected,
  Cancelled,
}

export type V3Transaction = {
  readonly creator: Address;
  readonly ms: Address;
  readonly transactionIndex: number;
  readonly authorityIndex: number;
  readonly authorityBump: number;
  readonly status: V3TransactionStatus;
  /** The number of attached instructions. */
  readonly instructionIndex: number;
  readonly bump: number;
  readonly approved: readonly Address[];
  readonly rejected: readonly Address[];
  readonly cancelled: readonly Address[];
  /** The last instruction that `execute_instruction` ran (0: none). */
  readonly executedIndex: number;
};

export type V3AccountMeta = { readonly address: Address; readonly isSigner: boolean; readonly isWritable: boolean };

export type V3Instruction = {
  readonly programAddress: Address;
  readonly keys: readonly V3AccountMeta[];
  readonly data: ReadonlyUint8Array;
  readonly instructionIndex: number;
  readonly bump: number;
  readonly executed: boolean;
};

/** The roles of the v3 roles program. */
export enum V3Role {
  Initiate,
  Vote,
  Execute,
  InitiateAndExecute,
  InitiateAndVote,
  VoteAndExecute,
}

export type V3RolesManager = { readonly ms: Address; readonly roleIndex: number; readonly bump: number };

export type V3RolesUser = {
  readonly name: string;
  readonly role: V3Role;
  /** The wallet that signs for the delegate. */
  readonly originKey: Address;
  readonly bump: number;
  readonly ms: Address;
  readonly roleIndex: number;
};

const addresses = () => getArrayDecoder(getAddressDecoder());

const getV3MultisigDecoder = (): Decoder<V3Multisig> =>
  getStructDecoder([
    ["threshold", getU16Decoder()],
    ["authorityIndex", getU16Decoder()],
    ["transactionIndex", getU32Decoder()],
    ["msChangeIndex", getU32Decoder()],
    ["bump", getU8Decoder()],
    ["createKey", getAddressDecoder()],
    ["allowExternalExecute", getBooleanDecoder()],
    ["keys", addresses()],
  ]);

const getV3TransactionDecoder = (): Decoder<V3Transaction> =>
  getStructDecoder([
    ["creator", getAddressDecoder()],
    ["ms", getAddressDecoder()],
    ["transactionIndex", getU32Decoder()],
    ["authorityIndex", getU32Decoder()],
    ["authorityBump", getU8Decoder()],
    ["status", getEnumDecoder(V3TransactionStatus)],
    ["instructionIndex", getU8Decoder()],
    ["bump", getU8Decoder()],
    ["approved", addresses()],
    ["rejected", addresses()],
    ["cancelled", addresses()],
    ["executedIndex", getU8Decoder()],
  ]);

const getV3InstructionDecoder = (): Decoder<V3Instruction> =>
  getStructDecoder([
    ["programAddress", getAddressDecoder()],
    [
      "keys",
      getArrayDecoder(
        getStructDecoder([
          ["address", getAddressDecoder()],
          ["isSigner", getBooleanDecoder()],
          ["isWritable", getBooleanDecoder()],
        ]),
      ),
    ],
    ["data", addDecoderSizePrefix(getBytesDecoder(), getU32Decoder())],
    ["instructionIndex", getU8Decoder()],
    ["bump", getU8Decoder()],
    ["executed", getBooleanDecoder()],
  ]);

const getV3RolesManagerDecoder = (): Decoder<V3RolesManager> =>
  getStructDecoder([
    ["ms", getAddressDecoder()],
    ["roleIndex", getU32Decoder()],
    ["bump", getU8Decoder()],
  ]);

const getV3RolesUserDecoder = (): Decoder<V3RolesUser> =>
  getStructDecoder([
    ["name", addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder())],
    ["role", getEnumDecoder(V3Role)],
    ["originKey", getAddressDecoder()],
    ["bump", getU8Decoder()],
    ["ms", getAddressDecoder()],
    ["roleIndex", getU32Decoder()],
  ]);

/** Decodes after the discriminator check; `null` for other data. Trailing bytes are ignored. */
function decodeAnchor<T>(decoder: () => Decoder<T>, discriminator: ReadonlyUint8Array) {
  return (data: ReadonlyUint8Array): T | null => {
    if (data.length < 8 || !discriminator.every((byte, i) => data[i] === byte)) return null;
    try {
      return decoder().decode(data, 8);
    } catch {
      return null;
    }
  };
}

export const decodeV3Multisig = decodeAnchor(getV3MultisigDecoder, V3_DISCRIMINATORS.ms);
export const decodeV3Transaction = decodeAnchor(getV3TransactionDecoder, V3_DISCRIMINATORS.msTransaction);
export const decodeV3Instruction = decodeAnchor(getV3InstructionDecoder, V3_DISCRIMINATORS.msInstruction);
export const decodeV3RolesManager = decodeAnchor(getV3RolesManagerDecoder, V3_DISCRIMINATORS.rolesManager);
export const decodeV3RolesUser = decodeAnchor(getV3RolesUserDecoder, V3_DISCRIMINATORS.rolesUser);

const meta = (address: Address, role: AccountRole, signer?: TransactionSigner): AccountMeta =>
  signer ? ({ address, role, signer } as AccountMeta) : { address, role };
const writableSigner = (signer: TransactionSigner) => meta(signer.address, AccountRole.WRITABLE_SIGNER, signer);
const v3Instruction = (accounts: readonly AccountMeta[], data: ReadonlyUint8Array): Instruction => ({
  programAddress: LEGACY_V3_PROGRAM_ADDRESS,
  accounts,
  data,
});
const vec = (items: readonly ReadonlyUint8Array[]) => concat(u32(items.length), ...items);
const string = (value: string) => {
  const bytes = new TextEncoder().encode(value);
  return concat(u32(bytes.length), bytes);
};
const u16 = (value: number) => Uint8Array.of(value & 0xff, value >> 8);

/** `create`: a v3 multisig (for tests). v3 sorts and dedups `members`. */
export function getV3CreateInstruction(input: {
  readonly multisig: Address;
  readonly creator: TransactionSigner;
  readonly threshold: number;
  readonly createKey: Address;
  readonly members: readonly Address[];
  readonly meta?: string;
}): Instruction {
  return v3Instruction(
    [meta(input.multisig, AccountRole.WRITABLE), writableSigner(input.creator), meta(SYSTEM_PROGRAM_ADDRESS, AccountRole.READONLY)],
    concat(
      V3_DISCRIMINATORS.create,
      u16(input.threshold),
      encodeAddress(input.createKey),
      vec(input.members.map(encodeAddress)),
      string(input.meta ?? ""),
    ),
  );
}

/** `create_transaction`: a v3 transaction that `authorityIndex` signs (index 0: the multisig itself). */
export function getV3CreateTransactionInstruction(input: {
  readonly multisig: Address;
  readonly transaction: Address;
  readonly creator: TransactionSigner;
  readonly authorityIndex: number;
}): Instruction {
  return v3Instruction(
    [
      meta(input.multisig, AccountRole.WRITABLE),
      meta(input.transaction, AccountRole.WRITABLE),
      writableSigner(input.creator),
      meta(SYSTEM_PROGRAM_ADDRESS, AccountRole.READONLY),
    ],
    concat(V3_DISCRIMINATORS.createTransaction, u32(input.authorityIndex)),
  );
}

const isSignerRole = (role: AccountRole) => role === AccountRole.READONLY_SIGNER || role === AccountRole.WRITABLE_SIGNER;
const isWritableRole = (role: AccountRole) => role === AccountRole.WRITABLE || role === AccountRole.WRITABLE_SIGNER;

/** The bytes of a v3 `IncomingInstruction`: the program, the account metas and the data. */
export function encodeV3IncomingInstruction(instruction: Instruction): Uint8Array {
  const keys = (instruction.accounts ?? []).map((account) =>
    concat(encodeAddress(account.address), Uint8Array.of(isSignerRole(account.role) ? 1 : 0, isWritableRole(account.role) ? 1 : 0)),
  );
  const data = instruction.data ?? new Uint8Array();
  return concat(encodeAddress(instruction.programAddress), vec(keys), u32(data.length), data);
}

/** `add_instruction`: attach `instruction` to a draft v3 transaction, as its next instruction. */
export function getV3AddInstructionInstruction(input: {
  readonly multisig: Address;
  readonly transaction: Address;
  readonly instructionAccount: Address;
  readonly creator: TransactionSigner;
  readonly instruction: Instruction;
}): Instruction {
  return v3Instruction(
    [
      meta(input.multisig, AccountRole.READONLY),
      meta(input.transaction, AccountRole.WRITABLE),
      meta(input.instructionAccount, AccountRole.WRITABLE),
      writableSigner(input.creator),
      meta(SYSTEM_PROGRAM_ADDRESS, AccountRole.READONLY),
    ],
    concat(V3_DISCRIMINATORS.addInstruction, encodeV3IncomingInstruction(input.instruction)),
  );
}

type V3VoteInput = { readonly multisig: Address; readonly transaction: Address; readonly member: TransactionSigner };
const voteAccounts = (input: V3VoteInput) => [
  meta(input.multisig, AccountRole.READONLY),
  meta(input.transaction, AccountRole.WRITABLE),
  writableSigner(input.member),
];

/** `activate_transaction`: the creator opens a draft v3 transaction for votes. */
export const getV3ActivateTransactionInstruction = (input: V3VoteInput): Instruction =>
  v3Instruction(voteAccounts(input), V3_DISCRIMINATORS.activateTransaction);

/** `approve_transaction`: a member approves an active v3 transaction. */
export const getV3ApproveTransactionInstruction = (input: V3VoteInput): Instruction =>
  v3Instruction(voteAccounts(input), V3_DISCRIMINATORS.approveTransaction);

/**
 * `execute_instruction`: a member runs the next attached instruction of an approved v3
 * transaction. The remaining accounts are its program and its accounts; v3 signs for the authority.
 */
export function getV3ExecuteInstructionInstruction(input: {
  readonly multisig: Address;
  readonly transaction: Address;
  readonly instructionAccount: Address;
  readonly member: TransactionSigner;
  readonly attached: V3Instruction;
}): Instruction {
  const remaining = input.attached.keys.map((key) => meta(key.address, key.isWritable ? AccountRole.WRITABLE : AccountRole.READONLY));
  return v3Instruction(
    [
      meta(input.multisig, AccountRole.WRITABLE),
      meta(input.transaction, AccountRole.WRITABLE),
      meta(input.instructionAccount, AccountRole.WRITABLE),
      writableSigner(input.member),
      meta(input.attached.programAddress, AccountRole.READONLY),
      ...remaining,
    ],
    V3_DISCRIMINATORS.executeInstruction,
  );
}

/**
 * `execute_transaction`: a member runs every attached instruction of an approved v3 transaction at
 * once. The only way to run authority 0; `account_list` maps each attached account to a remaining one.
 */
export function getV3ExecuteTransactionInstruction(input: {
  readonly multisig: Address;
  readonly transaction: Address;
  readonly member: TransactionSigner;
  /** Each attached instruction with its instruction account, in order. */
  readonly attached: readonly { readonly instructionAccount: Address; readonly instruction: V3Instruction }[];
}): Instruction {
  const sequence = input.attached.flatMap(({ instructionAccount, instruction }) => [
    { address: instructionAccount, isWritable: false },
    { address: instruction.programAddress, isWritable: false },
    ...instruction.keys.map((key) => ({ address: key.address, isWritable: key.isWritable })),
  ]);
  const unique = [...new Set(sequence.map((entry) => entry.address))];
  const writableAddresses = new Set(sequence.filter((entry) => entry.isWritable).map((entry) => entry.address));
  const accountList = sequence.map((entry) => unique.indexOf(entry.address));
  return v3Instruction(
    [
      meta(input.multisig, AccountRole.WRITABLE),
      meta(input.transaction, AccountRole.WRITABLE),
      writableSigner(input.member),
      ...unique.map((address) => meta(address, writableAddresses.has(address) ? AccountRole.WRITABLE : AccountRole.READONLY)),
    ],
    concat(V3_DISCRIMINATORS.executeTransaction, u32(accountList.length), Uint8Array.from(accountList)),
  );
}

/**
 * v3 config instructions, to attach to a v3 transaction of authority 0 (the multisig signs).
 * Use them to replace roles delegate members with their wallets before a migration.
 */
export const getV3AddMemberInstruction = (multisig: Address, newMember: Address): Instruction =>
  v3Instruction(
    [
      meta(multisig, AccountRole.WRITABLE_SIGNER),
      meta(RENT_SYSVAR_ADDRESS, AccountRole.READONLY),
      meta(SYSTEM_PROGRAM_ADDRESS, AccountRole.READONLY),
    ],
    concat(V3_DISCRIMINATORS.addMember, encodeAddress(newMember)),
  );
export const getV3RemoveMemberInstruction = (multisig: Address, oldMember: Address): Instruction =>
  v3Instruction([meta(multisig, AccountRole.WRITABLE_SIGNER)], concat(V3_DISCRIMINATORS.removeMember, encodeAddress(oldMember)));
export const getV3ChangeThresholdInstruction = (multisig: Address, threshold: number): Instruction =>
  v3Instruction([meta(multisig, AccountRole.WRITABLE_SIGNER)], concat(V3_DISCRIMINATORS.changeThreshold, u16(threshold)));

const PLACEHOLDER_MEMBER = createNoopSigner(getAddressDecoder().decode(new Uint8Array(32).fill(9)));
const PLACEHOLDER_BLOCKHASH = { blockhash: getAddressDecoder().decode(new Uint8Array(32)) as string as Blockhash, lastValidBlockHeight: 0n };

/** The wire size and the account count of one transaction with `instructions`, signed by a member. */
function transactionSize(instructions: readonly Instruction[], tables: AddressLookupTables = {}) {
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(PLACEHOLDER_MEMBER, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(PLACEHOLDER_BLOCKHASH, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const byTable = Object.fromEntries(Object.entries(tables).map(([table, addresses]) => [table, [...addresses]]));
  const compiled = compileTransactionMessage(
    Object.keys(byTable).length > 0 ? compressTransactionMessageUsingAddressLookupTables(message, byTable) : message,
  );
  const lookups = compiled.addressTableLookups ?? [];
  return {
    bytes: 1 + 64 * compiled.header.numSignerAccounts + getCompiledTransactionMessageEncoder().encode(compiled).length,
    accounts:
      compiled.staticAccounts.length +
      lookups.reduce((count, lookup) => count + lookup.writableIndexes.length + lookup.readonlyIndexes.length, 0),
  };
}

/**
 * A migrate instruction as a v3 instruction: the larger wire size of its add and execute
 * transactions (one member signs and pays), and the execute accounts (only it uses `tables`).
 */
export async function measureV3Item(
  sourceMultisig: Address,
  instruction: Instruction,
  tables: AddressLookupTables = {},
): Promise<{ messageBytes: number; messageAccounts: number }> {
  const transaction = await findV3TransactionPda(sourceMultisig, 1);
  const instructionAccount = await findV3InstructionPda(transaction, 1);
  const common = { multisig: sourceMultisig, transaction, instructionAccount };
  const add = transactionSize([getV3AddInstructionInstruction({ ...common, creator: PLACEHOLDER_MEMBER, instruction })]);
  const attached: V3Instruction = {
    programAddress: instruction.programAddress,
    keys: (instruction.accounts ?? []).map((account) => ({
      address: account.address,
      isSigner: isSignerRole(account.role),
      isWritable: isWritableRole(account.role),
    })),
    data: instruction.data ?? new Uint8Array(),
    instructionIndex: 1,
    bump: 0,
    executed: false,
  };
  const execute = transactionSize([getV3ExecuteInstructionInstruction({ ...common, member: PLACEHOLDER_MEMBER, attached })], tables);
  return { messageBytes: Math.max(add.bytes, execute.bytes), messageAccounts: execute.accounts };
}
