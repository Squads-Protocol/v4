import {
  AccountRole,
  getAddressEncoder,
  isSignerRole,
  isWritableRole,
  type AccountMeta,
  type Address,
  type Instruction,
  type ReadonlyUint8Array,
} from "@solana/kit";

import {
  findEphemeralSignerPda,
  findVaultPda,
  getTransactionMessageEncoder,
  getVaultTransactionExecuteInstruction,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  type TransactionMessage,
  type VaultTransactionExecuteInput,
  type VaultTransactionMessage,
} from "./generated";

/** Lookup table address → the addresses it stores, in table order. */
export type AddressLookupTables = Readonly<Record<Address, readonly Address[]>>;

type KeyMeta = { signer: boolean; writable: boolean };

const addressEncoder = getAddressEncoder();

/** Byte-wise order, the same as `BTreeMap<Address, _>` in the Rust client. */
function compareAddresses(a: Address, b: Address): number {
  const left = addressEncoder.encode(a);
  const right = addressEncoder.encode(b);
  const index = left.findIndex((byte, i) => byte !== right[i]);
  return index === -1 ? 0 : (left[index] as number) - (right[index] as number);
}

function collectKeyMetas(vault: Address, instructions: readonly Instruction[]): Map<Address, KeyMeta> {
  const metas = new Map<Address, KeyMeta>();
  const touch = (address: Address, role: AccountRole) => {
    const current = metas.get(address) ?? { signer: false, writable: false };
    metas.set(address, {
      signer: current.signer || isSignerRole(role),
      writable: current.writable || isWritableRole(role),
    });
  };
  instructions.forEach((ix) => {
    touch(ix.programAddress, AccountRole.READONLY);
    (ix.accounts ?? []).forEach((account) => touch(account.address, account.role));
  });
  metas.delete(vault);
  return metas;
}

/**
 * Compiles `instructions` for execution by `vault`. Lookup tables that contribute no
 * account are dropped. The output matches the Rust client byte for byte.
 */
export function compileTransactionMessage(input: {
  vault: Address;
  instructions: readonly Instruction[];
  addressLookupTables?: AddressLookupTables;
}): TransactionMessage {
  const { vault, instructions, addressLookupTables = {} } = input;
  const metas = collectKeyMetas(vault, instructions);
  const keysWhere = (filter: (meta: KeyMeta) => boolean) =>
    [...metas.entries()]
      .filter(([, meta]) => filter(meta))
      .map(([address]) => address)
      .sort(compareAddresses);

  const lookups = Object.entries(addressLookupTables).flatMap(([table, addresses]) => {
    const drain = (filter: (meta: KeyMeta) => boolean) => {
      const found = keysWhere(filter)
        .map((address) => ({ address, index: addresses.indexOf(address) }))
        .filter(({ index }) => index >= 0 && index <= 255);
      found.forEach(({ address }) => metas.delete(address));
      return found;
    };
    const writable = drain((m) => !m.signer && m.writable);
    const readonly = drain((m) => !m.signer && !m.writable);
    return writable.length + readonly.length === 0 ? [] : [{ table: table as Address, writable, readonly }];
  });

  const writableSigners = [vault, ...keysWhere((m) => m.signer && m.writable)];
  const readonlySigners = keysWhere((m) => m.signer && !m.writable);
  const writableNonSigners = keysWhere((m) => !m.signer && m.writable);
  const readonlyNonSigners = keysWhere((m) => !m.signer && !m.writable);
  const staticKeys = [...writableSigners, ...readonlySigners, ...writableNonSigners, ...readonlyNonSigners];
  const allKeys = [
    ...staticKeys,
    ...lookups.flatMap((lookup) => lookup.writable.map(({ address }) => address)),
    ...lookups.flatMap((lookup) => lookup.readonly.map(({ address }) => address)),
  ];
  const indexOf = (address: Address) => {
    const index = allKeys.indexOf(address);
    if (index < 0 || index > 255) throw new Error(`account ${address} cannot be indexed in the message`);
    return index;
  };

  return {
    numSigners: writableSigners.length + readonlySigners.length,
    numWritableSigners: writableSigners.length,
    numWritableNonSigners: writableNonSigners.length,
    accountKeys: staticKeys,
    instructions: instructions.map((ix) => ({
      programIdIndex: indexOf(ix.programAddress),
      accountIndexes: (ix.accounts ?? []).map((account) => indexOf(account.address)),
      data: ix.data ?? new Uint8Array(),
    })),
    addressTableLookups: lookups.map((lookup) => ({
      accountKey: lookup.table,
      writableIndexes: lookup.writable.map(({ index }) => index),
      readonlyIndexes: lookup.readonly.map(({ index }) => index),
    })),
  };
}

/** Bytes for the `transactionMessage` argument of vault transaction / batch instructions. */
export function getTransactionMessageBytes(input: Parameters<typeof compileTransactionMessage>[0]): ReadonlyUint8Array {
  return getTransactionMessageEncoder().encode(compileTransactionMessage(input));
}

function isStaticWritableIndex(message: VaultTransactionMessage, index: number): boolean {
  if (index >= message.accountKeys.length) return false;
  if (index < message.numWritableSigners) return true;
  if (index >= message.numSigners) return index - message.numSigners < message.numWritableNonSigners;
  return false;
}

/**
 * Remaining accounts for `vaultTransactionExecute` / `batchExecuteTransaction`, in program
 * order: lookup tables (as listed in `message`), static keys, then loaded accounts.
 */
export async function getAccountsForExecute(input: {
  message: VaultTransactionMessage;
  multisig: Address;
  vaultIndex: number;
  transaction: Address;
  addressLookupTables?: AddressLookupTables;
  numEphemeralSigners?: number;
  programAddress?: Address;
}): Promise<AccountMeta[]> {
  const { message, multisig, vaultIndex, transaction, addressLookupTables = {}, numEphemeralSigners = 0 } = input;
  const programAddress = input.programAddress ?? SQUADS_MULTISIG4R_PROGRAM_ADDRESS;
  const [vault] = await findVaultPda({ multisig, index: vaultIndex }, { programAddress });
  const ephemeralSigners = await Promise.all(
    Array.from({ length: numEphemeralSigners }, (_, index) =>
      findEphemeralSignerPda({ transaction, index }, { programAddress }).then(([pda]) => pda),
    ),
  );
  const tableFor = (key: Address) => {
    const addresses = addressLookupTables[key];
    if (!addresses) throw new Error(`address lookup table ${key} was not provided`);
    return addresses;
  };
  const loaded = (key: Address, indexes: ArrayLike<number>, role: AccountRole) =>
    Array.from(indexes).map((index) => {
      const address = tableFor(key)[index];
      if (!address) throw new Error(`address lookup table ${key} has no address at index ${index}`);
      return { address, role };
    });

  const tableMetas = message.addressTableLookups.map(({ accountKey }) => {
    tableFor(accountKey);
    return { address: accountKey, role: AccountRole.READONLY };
  });
  const staticMetas = message.accountKeys.map((address, index) => {
    const signer = index < message.numSigners && address !== vault && !ephemeralSigners.includes(address);
    const writable = isStaticWritableIndex(message, index);
    const role = signer
      ? writable
        ? AccountRole.WRITABLE_SIGNER
        : AccountRole.READONLY_SIGNER
      : writable
        ? AccountRole.WRITABLE
        : AccountRole.READONLY;
    return { address, role };
  });
  const loadedMetas = message.addressTableLookups.flatMap((lookup) => [
    ...loaded(lookup.accountKey, lookup.writableIndexes, AccountRole.WRITABLE),
    ...loaded(lookup.accountKey, lookup.readonlyIndexes, AccountRole.READONLY),
  ]);
  return [...tableMetas, ...staticMetas, ...loadedMetas];
}

/** `vaultTransactionExecute` with the remaining accounts the program expects. */
export async function getVaultTransactionExecuteInstructionWithAccounts(
  input: Omit<VaultTransactionExecuteInput, "multisig" | "transaction"> & {
    multisig: Address;
    transaction: Address;
    message: VaultTransactionMessage;
    vaultIndex: number;
    addressLookupTables?: AddressLookupTables;
    numEphemeralSigners?: number;
  },
  config: { programAddress?: Address } = {},
) {
  const instruction = getVaultTransactionExecuteInstruction(input, config);
  const remaining = await getAccountsForExecute({ ...input, programAddress: config.programAddress });
  return { ...instruction, accounts: [...instruction.accounts, ...remaining] };
}
