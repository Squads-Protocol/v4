import {
  AccountRole,
  address,
  getAddressEncoder,
  getProgramDerivedAddress,
  getU32Encoder,
  getU64Encoder,
  isSignerRole,
  type Address,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";

import { SQUADS_MULTISIG4R_PROGRAM_ADDRESS } from "./generated";
import {
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  BPF_LOADER_UPGRADEABLE_ADDRESS,
  STAKE_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  VOTE_PROGRAM_ADDRESS,
} from "./migration";

// Address lookup table instructions (bincode u32 variant tags: create 0, extend 2, deactivate 3,
// close 4). Built here so that the SDK needs no lookup-table package at runtime.
export const ADDRESS_LOOKUP_TABLE_PROGRAM_ADDRESS = address("AddressLookupTab1e1111111111111111111111111");
const SYSTEM_PROGRAM_ADDRESS = address("11111111111111111111111111111111");

/** The most addresses in one lookup table. */
export const MAX_LOOKUP_TABLE_ADDRESSES = 256;
/** Addresses for each extend transaction: it fits in one transaction with the create instruction. */
export const LOOKUP_TABLE_ADDRESSES_PER_EXTEND = 20;

const addressEncoder = getAddressEncoder();
const tag = (value: number) => Uint8Array.from(getU32Encoder().encode(value));
const signer = (signer: TransactionSigner, writable = false) => ({
  address: signer.address,
  role: writable ? AccountRole.WRITABLE_SIGNER : AccountRole.READONLY_SIGNER,
  signer,
});
const instruction = (accounts: Instruction["accounts"], data: Uint8Array): Instruction => ({
  programAddress: ADDRESS_LOOKUP_TABLE_PROGRAM_ADDRESS,
  accounts,
  data,
});

/** The table that `authority` creates with `recentSlot` (a recent slot of the cluster). */
export async function findLookupTableAddress(authority: Address, recentSlot: bigint) {
  return getProgramDerivedAddress({
    programAddress: ADDRESS_LOOKUP_TABLE_PROGRAM_ADDRESS,
    seeds: [addressEncoder.encode(authority), getU64Encoder().encode(recentSlot)],
  });
}

/** `CreateLookupTable`. The authority does not sign; it signs each extend. */
export async function getCreateLookupTableInstruction(input: {
  authority: Address;
  payer: TransactionSigner;
  recentSlot: bigint;
}): Promise<{ table: Address; instruction: Instruction }> {
  const [table, bump] = await findLookupTableAddress(input.authority, input.recentSlot);
  const data = Uint8Array.from([...tag(0), ...getU64Encoder().encode(input.recentSlot), bump]);
  return {
    table,
    instruction: instruction(
      [
        { address: table, role: AccountRole.WRITABLE },
        { address: input.authority, role: AccountRole.READONLY },
        signer(input.payer, true),
        { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
      ],
      data,
    ),
  };
}

export function getExtendLookupTableInstruction(input: {
  table: Address;
  authority: TransactionSigner;
  payer: TransactionSigner;
  addresses: readonly Address[];
}): Instruction {
  const data = Uint8Array.from([
    ...tag(2),
    ...getU64Encoder().encode(input.addresses.length),
    ...input.addresses.flatMap((entry) => [...addressEncoder.encode(entry)]),
  ]);
  return instruction(
    [
      { address: input.table, role: AccountRole.WRITABLE },
      signer(input.authority),
      signer(input.payer, true),
      { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
    ],
    data,
  );
}

/** Deactivate a table. Close it about 513 slots later to get the rent back. */
export function getDeactivateLookupTableInstruction(input: { table: Address; authority: TransactionSigner }): Instruction {
  return instruction([{ address: input.table, role: AccountRole.WRITABLE }, signer(input.authority)], tag(3));
}

export function getCloseLookupTableInstruction(input: {
  table: Address;
  authority: TransactionSigner;
  recipient: Address;
}): Instruction {
  return instruction(
    [
      { address: input.table, role: AccountRole.WRITABLE },
      signer(input.authority),
      { address: input.recipient, role: AccountRole.WRITABLE },
    ],
    tag(4),
  );
}

/** Programs stay static accounts: a table holds only the accounts that the instructions read or write. */
const PROGRAMS = new Set<Address>([
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  SYSTEM_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TOKEN_2022_PROGRAM_ADDRESS,
  ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
  STAKE_PROGRAM_ADDRESS,
  VOTE_PROGRAM_ADDRESS,
  BPF_LOADER_UPGRADEABLE_ADDRESS,
]);

/** The non-signer, non-program accounts of `instructions`, once each, in order of first use. */
export function getLookupTableAddresses(instructions: readonly Instruction[]): Address[] {
  const programs = new Set([...PROGRAMS, ...instructions.map((ix) => ix.programAddress)]);
  const found = instructions
    .flatMap((ix) => ix.accounts ?? [])
    .filter((account) => !isSignerRole(account.role) && !programs.has(account.address))
    .map((account) => account.address);
  return [...new Set(found)];
}

/**
 * The transactions that create lookup tables for `addresses` (up to 256 each) and extend them.
 * Wait one slot after the last transaction before you use the tables.
 */
export async function getCreateLookupTablesTransactions(input: {
  addresses: readonly Address[];
  authority: TransactionSigner;
  payer: TransactionSigner;
  recentSlot: bigint;
}): Promise<{ tables: Record<Address, Address[]>; transactions: Instruction[][] }> {
  const groups = Array.from({ length: Math.ceil(input.addresses.length / MAX_LOOKUP_TABLE_ADDRESSES) }, (_, i) =>
    input.addresses.slice(i * MAX_LOOKUP_TABLE_ADDRESSES, (i + 1) * MAX_LOOKUP_TABLE_ADDRESSES),
  );
  const tables: Record<Address, Address[]> = {};
  const transactions: Instruction[][] = [];
  for (const [i, group] of groups.entries()) {
    // Each table needs its own seed: the authority and a distinct recent slot.
    const created = await getCreateLookupTableInstruction({
      authority: input.authority.address,
      payer: input.payer,
      recentSlot: input.recentSlot - BigInt(i),
    });
    tables[created.table] = [...group];
    const chunks = Array.from({ length: Math.ceil(group.length / LOOKUP_TABLE_ADDRESSES_PER_EXTEND) }, (_, j) =>
      group.slice(j * LOOKUP_TABLE_ADDRESSES_PER_EXTEND, (j + 1) * LOOKUP_TABLE_ADDRESSES_PER_EXTEND),
    );
    const extend = (addresses: Address[]) =>
      getExtendLookupTableInstruction({ table: created.table, authority: input.authority, payer: input.payer, addresses });
    chunks.forEach((chunk, j) => transactions.push(j === 0 ? [created.instruction, extend(chunk)] : [extend(chunk)]));
  }
  return { tables, transactions };
}
