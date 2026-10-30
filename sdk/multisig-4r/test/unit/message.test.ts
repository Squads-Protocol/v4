import { AccountRole, getAddressDecoder, type Address, type Instruction } from "@solana/kit";
import { describe, expect, it } from "vitest";

import { getAccountsForExecute, getTransactionMessageBytes, type VaultTransactionMessage } from "../../src";
import { toHex } from "./fixtures";

const key = (byte: number): Address => getAddressDecoder().decode(new Uint8Array(32).fill(byte));

// Same input and bytes as programs/squads_multisig_program/tests/core.rs (compiled_message_matches_the_shared_cross_sdk_vector).
const EXPECTED_HEX =
  "0201010609090909090909090909090909090909090909090909090909090909090909090505050505050505" +
  "0505050505050505050505050505050505050505050505050707070707070707070707070707070707070707" +
  "0707070707070707070707070303030303030303030303030303030303030303030303030303030303030303" +
  "6464646464646464646464646464646464646464646464646464646464646464c8c8c8c8c8c8c8c8c8c8c8c8" +
  "c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8020503000201030001020304030306070000013c3c3c3c3c" +
  "3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c01020100";

const vault = key(9);
const instructions: Instruction[] = [
  {
    programAddress: key(200),
    data: new Uint8Array([1, 2, 3]),
    accounts: [
      { address: vault, role: AccountRole.WRITABLE_SIGNER },
      { address: key(7), role: AccountRole.WRITABLE },
      { address: key(5), role: AccountRole.READONLY_SIGNER },
    ],
  },
  {
    programAddress: key(100),
    data: new Uint8Array(),
    accounts: [
      { address: key(3), role: AccountRole.READONLY },
      { address: key(1), role: AccountRole.WRITABLE },
      { address: key(8), role: AccountRole.READONLY },
    ],
  },
];
const addressLookupTables = { [key(50)]: [key(42), key(43)], [key(60)]: [key(8), key(99), key(1)] };

describe("compileTransactionMessage", () => {
  it("matches the Rust client byte for byte", () => {
    // Act
    const bytes = getTransactionMessageBytes({ vault, instructions, addressLookupTables });

    // Assert
    expect(toHex(bytes)).toBe(EXPECTED_HEX);
  });
});

describe("getAccountsForExecute", () => {
  const message: VaultTransactionMessage = {
    numSigners: 1,
    numWritableSigners: 1,
    numWritableNonSigners: 1,
    accountKeys: [key(11), key(12), key(13)],
    instructions: [],
    addressTableLookups: [{ accountKey: key(60), writableIndexes: new Uint8Array([2]), readonlyIndexes: new Uint8Array([0]) }],
  };

  it("lists lookup tables, static keys, then loaded accounts", async () => {
    // Act
    const metas = await getAccountsForExecute({ message, multisig: key(1), vaultIndex: 0, transaction: key(2), addressLookupTables });

    // Assert
    expect(metas.map((m) => [m.address, m.role])).toEqual([
      [key(60), AccountRole.READONLY],
      [key(11), AccountRole.WRITABLE_SIGNER],
      [key(12), AccountRole.WRITABLE],
      [key(13), AccountRole.READONLY],
      [key(1), AccountRole.WRITABLE],
      [key(8), AccountRole.READONLY],
    ]);
  });

  it("rejects a missing referenced lookup table", async () => {
    // Act
    const result = getAccountsForExecute({ message, multisig: key(1), vaultIndex: 0, transaction: key(2), addressLookupTables: {} });

    // Assert
    await expect(result).rejects.toThrow(/was not provided/);
  });
});
