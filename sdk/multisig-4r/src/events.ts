import {
  AccountRole,
  addDecoderSizePrefix,
  createDecoder,
  getAddressDecoder,
  getArrayDecoder,
  getBase58Encoder,
  getDiscriminatedUnionDecoder,
  getEnumDecoder,
  getOptionDecoder,
  getStructDecoder,
  getU32Decoder,
  getU64Decoder,
  getU8Decoder,
  getUtf8Decoder,
  type Address,
  type Decoder,
  type Instruction,
  type Option,
  type ReadonlyUint8Array,
} from "@solana/kit";

import {
  getBatchDecoder,
  getConfigActionDecoder,
  getConfigTransactionDecoder,
  getLogEventInstructionDataDecoder,
  getMultisigDecoder,
  getProgramConfigDecoder,
  getProposalDecoder,
  getSpendingLimitDecoder,
  getVaultBatchTransactionDecoder,
  getVaultTransactionDecoder,
  LOG_EVENT_DISCRIMINATOR,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  type Batch,
  type ConfigAction,
  type ConfigTransaction,
  type Multisig,
  type ProgramConfig,
  type Proposal,
  type SpendingLimit,
  type VaultBatchTransaction,
  type VaultTransaction,
} from "./generated";

/** The frozen v4 program. It has no events, so {@link withEvents} leaves its instructions as they are. */
export const LEGACY_V4_PROGRAM_ADDRESS = "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf" as Address;

/**
 * Enables events: appends the program address as a trailing read-only account. Apply it last,
 * after any remaining accounts. The program then emits `log_event` inner instructions.
 */
export function withEvents<T extends Instruction>(instruction: T): T {
  if (instruction.programAddress === LEGACY_V4_PROGRAM_ADDRESS) return instruction;
  return {
    ...instruction,
    accounts: [...(instruction.accounts ?? []), { address: instruction.programAddress, role: AccountRole.READONLY }],
  };
}

/** An account as stored, without its 8-byte discriminator. */
export type Snapshot<T> = Omit<T, "discriminator">;

export enum ProgramConfigEventKind {
  Init,
  SetAuthority,
  SetMultisigCreationFee,
  SetTreasury,
}
export enum SpendingLimitEventKind {
  Add,
  Remove,
}
export enum TransactionEventKind {
  Create,
  Execute,
  Close,
}
export enum BatchTransactionEventKind {
  Add,
  Execute,
  Close,
}
export enum ProposalEventKind {
  Create,
  Activate,
  Approve,
  Reject,
  Cancel,
  Execute,
  Close,
}

export type ConfigSource =
  | { readonly __kind: "ConfigAuthority"; readonly authority: Address }
  | { readonly __kind: "ConfigTransaction"; readonly transaction: Address; readonly transactionIndex: bigint };

export type TransactionContent =
  | ({ readonly __kind: "Vault" } & Snapshot<VaultTransaction>)
  | ({ readonly __kind: "Config" } & Snapshot<ConfigTransaction>)
  | ({ readonly __kind: "Batch" } & Snapshot<Batch>);

export type ProgramConfigEvent = {
  readonly kind: ProgramConfigEventKind;
  readonly programConfig: Address;
  readonly authority: Address;
  readonly snapshot: Snapshot<ProgramConfig>;
};
export type MultisigCreateEvent = {
  readonly multisig: Address;
  readonly createKey: Address;
  readonly creator: Address;
  readonly memo: Option<string>;
  readonly snapshot: Option<Snapshot<Multisig>>;
};
export type MultisigConfigEvent = {
  readonly multisig: Address;
  readonly source: ConfigSource;
  readonly actions: readonly ConfigAction[];
  readonly memo: Option<string>;
  readonly snapshot: Option<Snapshot<Multisig>>;
};
export type ConfigAuthorityChangeEvent = {
  readonly multisig: Address;
  readonly authority: Address;
  readonly newConfigAuthority: Address;
  readonly memo: Option<string>;
  readonly snapshot: Option<Snapshot<Multisig>>;
};
export type SpendingLimitEvent = {
  readonly kind: SpendingLimitEventKind;
  readonly multisig: Address;
  readonly spendingLimit: Address;
  readonly source: ConfigSource;
  readonly memo: Option<string>;
  readonly snapshot: Option<Snapshot<SpendingLimit>>;
};
export type SpendingLimitUseEvent = {
  readonly multisig: Address;
  readonly spendingLimit: Address;
  readonly member: Address;
  readonly vault: Address;
  readonly destination: Address;
  /** `None` for SOL. */
  readonly mint: Option<Address>;
  readonly decimals: number;
  readonly amount: bigint;
  readonly memo: Option<string>;
  readonly snapshot: Option<Snapshot<SpendingLimit>>;
};
export type TransactionEvent = {
  readonly kind: TransactionEventKind;
  readonly multisig: Address;
  readonly transaction: Address;
  readonly transactionIndex: bigint;
  readonly member: Option<Address>;
  readonly memo: Option<string>;
  readonly content: Option<TransactionContent>;
};
export type BatchTransactionEvent = {
  readonly kind: BatchTransactionEventKind;
  readonly multisig: Address;
  readonly batch: Address;
  readonly transaction: Address;
  readonly batchIndex: bigint;
  readonly transactionIndex: number;
  readonly member: Option<Address>;
  readonly snapshot: Option<Snapshot<VaultBatchTransaction>>;
};
export type ProposalEvent = {
  readonly kind: ProposalEventKind;
  readonly multisig: Address;
  readonly proposal: Address;
  readonly transactionIndex: bigint;
  readonly member: Option<Address>;
  readonly memo: Option<string>;
  readonly snapshot: Option<Snapshot<Proposal>>;
};

/** The borsh `MultisigEvent` enum of the program; `__kind` is the variant. */
export type MultisigEvent =
  | ({ readonly __kind: "ProgramConfig" } & ProgramConfigEvent)
  | ({ readonly __kind: "MultisigCreate" } & MultisigCreateEvent)
  | ({ readonly __kind: "MultisigConfig" } & MultisigConfigEvent)
  | ({ readonly __kind: "ConfigAuthorityChange" } & ConfigAuthorityChangeEvent)
  | ({ readonly __kind: "SpendingLimit" } & SpendingLimitEvent)
  | ({ readonly __kind: "SpendingLimitUse" } & SpendingLimitUseEvent)
  | ({ readonly __kind: "Transaction" } & TransactionEvent)
  | ({ readonly __kind: "BatchTransaction" } & BatchTransactionEvent)
  | ({ readonly __kind: "Proposal" } & ProposalEvent);

/** Decodes an account body that has no discriminator with the generated account decoder. */
function snapshot<T extends { discriminator: ReadonlyUint8Array }>(decoder: Decoder<T>): Decoder<Snapshot<T>> {
  return createDecoder({
    read(bytes, offset) {
      const prefixed = new Uint8Array(8 + bytes.length - offset);
      prefixed.set(bytes.slice(offset), 8);
      const [{ discriminator: _, ...value }, end] = decoder.read(prefixed, 0);
      return [value, offset + end - 8];
    },
  });
}

const address = getAddressDecoder;
const string = () => addDecoderSizePrefix(getUtf8Decoder(), getU32Decoder());
const option = <T>(decoder: Decoder<T>) => getOptionDecoder(decoder);

function getConfigSourceDecoder(): Decoder<ConfigSource> {
  return getDiscriminatedUnionDecoder([
    ["ConfigAuthority", getStructDecoder([["authority", address()]])],
    [
      "ConfigTransaction",
      getStructDecoder([
        ["transaction", address()],
        ["transactionIndex", getU64Decoder()],
      ]),
    ],
  ]);
}

function getTransactionContentDecoder(): Decoder<TransactionContent> {
  return getDiscriminatedUnionDecoder([
    ["Vault", snapshot(getVaultTransactionDecoder())],
    ["Config", snapshot(getConfigTransactionDecoder())],
    ["Batch", snapshot(getBatchDecoder())],
  ]);
}

/** Decodes the `event` bytes of `log_event` (borsh `MultisigEvent`). */
export function getMultisigEventDecoder(): Decoder<MultisigEvent> {
  const multisigSnapshot = () => option(snapshot(getMultisigDecoder()));
  return getDiscriminatedUnionDecoder([
    [
      "ProgramConfig",
      getStructDecoder([
        ["kind", getEnumDecoder(ProgramConfigEventKind)],
        ["programConfig", address()],
        ["authority", address()],
        ["snapshot", snapshot(getProgramConfigDecoder())],
      ]),
    ],
    [
      "MultisigCreate",
      getStructDecoder([
        ["multisig", address()],
        ["createKey", address()],
        ["creator", address()],
        ["memo", option(string())],
        ["snapshot", multisigSnapshot()],
      ]),
    ],
    [
      "MultisigConfig",
      getStructDecoder([
        ["multisig", address()],
        ["source", getConfigSourceDecoder()],
        ["actions", getArrayDecoder(getConfigActionDecoder())],
        ["memo", option(string())],
        ["snapshot", multisigSnapshot()],
      ]),
    ],
    [
      "ConfigAuthorityChange",
      getStructDecoder([
        ["multisig", address()],
        ["authority", address()],
        ["newConfigAuthority", address()],
        ["memo", option(string())],
        ["snapshot", multisigSnapshot()],
      ]),
    ],
    [
      "SpendingLimit",
      getStructDecoder([
        ["kind", getEnumDecoder(SpendingLimitEventKind)],
        ["multisig", address()],
        ["spendingLimit", address()],
        ["source", getConfigSourceDecoder()],
        ["memo", option(string())],
        ["snapshot", option(snapshot(getSpendingLimitDecoder()))],
      ]),
    ],
    [
      "SpendingLimitUse",
      getStructDecoder([
        ["multisig", address()],
        ["spendingLimit", address()],
        ["member", address()],
        ["vault", address()],
        ["destination", address()],
        ["mint", option(address())],
        ["decimals", getU8Decoder()],
        ["amount", getU64Decoder()],
        ["memo", option(string())],
        ["snapshot", option(snapshot(getSpendingLimitDecoder()))],
      ]),
    ],
    [
      "Transaction",
      getStructDecoder([
        ["kind", getEnumDecoder(TransactionEventKind)],
        ["multisig", address()],
        ["transaction", address()],
        ["transactionIndex", getU64Decoder()],
        ["member", option(address())],
        ["memo", option(string())],
        ["content", option(getTransactionContentDecoder())],
      ]),
    ],
    [
      "BatchTransaction",
      getStructDecoder([
        ["kind", getEnumDecoder(BatchTransactionEventKind)],
        ["multisig", address()],
        ["batch", address()],
        ["transaction", address()],
        ["batchIndex", getU64Decoder()],
        ["transactionIndex", getU32Decoder()],
        ["member", option(address())],
        ["snapshot", option(snapshot(getVaultBatchTransactionDecoder()))],
      ]),
    ],
    [
      "Proposal",
      getStructDecoder([
        ["kind", getEnumDecoder(ProposalEventKind)],
        ["multisig", address()],
        ["proposal", address()],
        ["transactionIndex", getU64Decoder()],
        ["member", option(address())],
        ["memo", option(string())],
        ["snapshot", option(snapshot(getProposalDecoder()))],
      ]),
    ],
  ]);
}

const startsWith = (data: ReadonlyUint8Array, prefix: ReadonlyUint8Array) =>
  data.length >= prefix.length && prefix.every((byte, i) => data[i] === byte);

/**
 * Decodes `log_event` instruction data into its event. Returns `null` for other instructions.
 * Check that the inner instruction's program is the multisig program before you trust it.
 */
export function decodeLogEvent(data: ReadonlyUint8Array): MultisigEvent | null {
  if (!startsWith(data, LOG_EVENT_DISCRIMINATOR)) return null;
  const { event } = getLogEventInstructionDataDecoder().decode(data);
  const [decoded, end] = getMultisigEventDecoder().read(event, 0);
  if (end !== event.length) throw new Error("log_event data has trailing bytes");
  return decoded;
}

/** The account that signs an event's `log_event`: the program config or the multisig. */
export function getEventAuthority(event: MultisigEvent): Address {
  return event.__kind === "ProgramConfig" ? event.programConfig : event.multisig;
}

/**
 * Decodes an inner instruction for indexers. Returns `null` unless it is `log_event` of
 * `programAddress`. Throws if its signer (`accounts[0]`) is not the event's authority.
 */
export function decodeVerifiedLogEvent(input: {
  programAddress: Address;
  instructionProgramAddress: Address;
  accounts: readonly Address[];
  data: ReadonlyUint8Array;
}): MultisigEvent | null {
  if (input.instructionProgramAddress !== input.programAddress) return null;
  const event = decodeLogEvent(input.data);
  if (event === null) return null;
  if (input.accounts[0] !== getEventAuthority(event)) {
    throw new Error("log_event is not signed by the multisig (or program config) that the event names");
  }
  return event;
}

/** The parts of a `getTransaction` response (`encoding: "json"`) that hold inner instructions. */
export type TransactionWithInnerInstructions = {
  readonly transaction: { readonly message: { readonly accountKeys: readonly Address[] } };
  readonly meta: {
    readonly innerInstructions?:
      | readonly {
          readonly index: number;
          readonly instructions: readonly {
            readonly programIdIndex: number;
            readonly accounts: readonly number[];
            readonly data: string;
          }[];
        }[]
      | null;
    readonly loadedAddresses?: { readonly writable: readonly Address[]; readonly readonly: readonly Address[] };
  } | null;
};

/** All verified events of a transaction, in execution order (see {@link decodeVerifiedLogEvent}). */
export function getMultisigEventsFromTransaction(
  transaction: TransactionWithInnerInstructions,
  programAddress: Address = SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
): MultisigEvent[] {
  const { meta } = transaction;
  if (!meta) return [];
  const keys = [
    ...transaction.transaction.message.accountKeys,
    ...(meta.loadedAddresses?.writable ?? []),
    ...(meta.loadedAddresses?.readonly ?? []),
  ];
  const key = (index: number) => {
    const found = keys[index];
    if (!found) throw new Error(`account index ${index} is not in the transaction`);
    return found;
  };
  const base58 = getBase58Encoder();
  return [...(meta.innerInstructions ?? [])]
    .sort((a, b) => a.index - b.index)
    .flatMap((inner) => inner.instructions)
    .flatMap((ix) => {
      const event = decodeVerifiedLogEvent({
        programAddress,
        instructionProgramAddress: key(ix.programIdIndex),
        accounts: ix.accounts.map(key),
        data: base58.encode(ix.data),
      });
      return event ? [event] : [];
    });
}
