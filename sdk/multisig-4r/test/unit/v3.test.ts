import {
  AccountRole,
  address,
  getAddressDecoder,
  getAddressEncoder,
  type Address,
  type Rpc,
  type SolanaRpcApi,
} from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  chunkMigrationGroups,
  decodeV3Multisig,
  encodeV3IncomingInstruction,
  findV3AuthorityPda,
  findV3DelegateMembers,
  findV3MultisigPda,
  findV3RolesManagerPda,
  findV3RolesUserPda,
  findV3DelegatePda,
  inventoryGroups,
  memberSigningReport,
  TOKEN_PROGRAM_ADDRESS,
  V3_DISCRIMINATORS,
  V3_MIGRATION_LIMITS,
  V3_ROLES_PROGRAM_ADDRESS,
  V3DelegateMembersError,
  V3Role,
  v3VaultIndex,
  type V4VaultInventory,
} from "../../src";
import { readFixtures, toHex } from "./fixtures";

const key = (byte: number): Address => getAddressDecoder().decode(new Uint8Array(32).fill(byte));
const encode = (value: Address) => getAddressEncoder().encode(value);
const u32 = (value: number) => Uint8Array.of(value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, value >>> 24);
const concat = (...parts: ArrayLike<number>[]) => Uint8Array.from(parts.flatMap((part) => Array.from(part)));

describe("v3 accounts and PDAs", () => {
  it("decodes the mainnet v3 multisigs, each the PDA of its create key", async () => {
    // Arrange
    const fixtures = readFixtures("v3_accounts.txt");

    // Act
    const decoded = fixtures.map((fixture) => decodeV3Multisig(fixture.bytes));
    const pdas = await Promise.all(decoded.map((ms) => findV3MultisigPda(ms!.createKey)));

    // Assert: the same values as programs/squads_multisig_program/tests/migration_v3.rs.
    expect(decoded.map((ms) => [ms?.threshold, ms?.keys.length])).toEqual([
      [3, 6],
      [2, 2],
    ]);
    expect(pdas).toEqual(fixtures.map((fixture) => fixture.id));
  });

  it("derives the authority that signs on mainnet", async () => {
    // Arrange
    const [fixture] = readFixtures("v3_accounts.txt");

    // Act
    const authority = await findV3AuthorityPda(address(fixture!.id), 1);

    // Assert
    expect(authority).toBe("MmHsqX4LxTfifxoH8BVRLUKrwDn1LPCac6YcCZTHhwt");
  });

  it("maps authority N to vault N - 1, from 1 to 256 only", () => {
    // Act + Assert
    expect([1, 2, 256].map(v3VaultIndex)).toEqual([0, 1, 255]);
    [0, 257, 1.5, -1].forEach((index) => expect(() => v3VaultIndex(index)).toThrow(RangeError));
  });

  it("encodes an IncomingInstruction: program, metas with signer and writable flags, data", () => {
    // Arrange
    const instruction = {
      programAddress: key(1),
      accounts: [
        { address: key(2), role: AccountRole.WRITABLE_SIGNER },
        { address: key(3), role: AccountRole.READONLY },
      ],
      data: Uint8Array.of(9, 8),
    };

    // Act
    const bytes = encodeV3IncomingInstruction(instruction);

    // Assert
    const expected = concat(encode(key(1)), u32(2), encode(key(2)), [1, 1], encode(key(3)), [0, 0], u32(2), [9, 8]);
    expect(toHex(bytes)).toBe(toHex(expected));
  });
});

describe("memberSigningReport", () => {
  it("is none for wallets, low when wallet voters reach the threshold, high when they do not", async () => {
    // Arrange: key(n) are on-curve test keys; a PDA is off the curve.
    const wallet = (await import("@solana/kit")).getAddressDecoder().decode(
      Uint8Array.from(Buffer.from("0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b0b", "hex")),
    );
    const pda = await findV3AuthorityPda(key(5), 1);
    const onCurve = [wallet, address("4GXYAfWWYJKtYwNtzdNMEMVYsqJBzZ363RZXT7Wjec9Q")].filter(
      (candidate) => !memberSigningReport([{ key: candidate, votes: true }], 1, new Set()).offCurve.length,
    );
    const members = (keys: readonly Address[]) => keys.map((k) => ({ key: k, votes: true }));

    // Act
    const none = memberSigningReport(members(onCurve), 1, new Set());
    const low = memberSigningReport(members([...onCurve, pda]), 1, new Set([pda]));
    const high = memberSigningReport(members([onCurve[0]!, pda]), 2, new Set());

    // Assert
    expect(onCurve.length).toBeGreaterThan(0);
    expect(none.risk).toBe("none");
    expect(low).toMatchObject({ risk: "low", offCurve: [{ key: pda, knownVault: true }] });
    expect(high).toMatchObject({ risk: "high", onCurveVoters: 1, offCurve: [{ key: pda, knownVault: false }] });
  });
});

/** A fake RPC with `getAccountInfo` and `getMultipleAccounts` over fixed accounts. */
function fakeRpc(accounts: ReadonlyMap<Address, { owner: Address; data: Uint8Array }>): Rpc<SolanaRpcApi> {
  const info = (pubkey: Address) => {
    const account = accounts.get(pubkey);
    return account ? { owner: account.owner, data: [Buffer.from(account.data).toString("base64"), "base64"] } : null;
  };
  return {
    getAccountInfo: (pubkey: Address) => ({ send: async () => ({ value: info(pubkey) }) }),
    getMultipleAccounts: (pubkeys: Address[]) => ({ send: async () => ({ value: pubkeys.map(info) }) }),
  } as unknown as Rpc<SolanaRpcApi>;
}

describe("findV3DelegateMembers", () => {
  it("finds the members that are roles delegates, with their wallets", async () => {
    // Arrange: two roles users; only the first one's delegate is a v3 member.
    const ms = key(40);
    const [user1, user2] = await Promise.all([findV3RolesUserPda(ms, 1), findV3RolesUserPda(ms, 2)]);
    const delegate1 = await findV3DelegatePda(user1, key(41));
    const user = (origin: Address, role: V3Role, index: number) =>
      concat(V3_DISCRIMINATORS.rolesUser, u32(5), Buffer.from("alice"), [role], encode(origin), [255], encode(ms), u32(index));
    const rpc = fakeRpc(
      new Map([
        [await findV3RolesManagerPda(ms), { owner: V3_ROLES_PROGRAM_ADDRESS, data: concat(V3_DISCRIMINATORS.rolesManager, encode(ms), u32(2), [254]) }],
        [user1, { owner: V3_ROLES_PROGRAM_ADDRESS, data: user(key(41), V3Role.Vote, 1) }],
        [user2, { owner: V3_ROLES_PROGRAM_ADDRESS, data: user(key(42), V3Role.Execute, 2) }],
      ]),
    );

    // Act
    const delegates = await findV3DelegateMembers(rpc, ms, [key(43), delegate1]);
    const error = new V3DelegateMembersError(ms, delegates);

    // Assert
    expect(delegates).toEqual([{ delegate: delegate1, user: user1, originKey: key(41), role: V3Role.Vote, name: "alice" }]);
    expect(error.message).toContain(`${delegate1} -> ${key(41)} (role Vote`);
    expect(error.message).toContain("add_member(wallet) and remove_member(delegate)");
  });

  it("finds none without a roles manager", async () => {
    // Act
    const delegates = await findV3DelegateMembers(fakeRpc(new Map()), key(40), [key(1)]);

    // Assert
    expect(delegates).toEqual([]);
  });
});

describe("chunkMigrationGroups for v3", () => {
  it("splits tokens into v3 instructions within the v3 limits", async () => {
    // Arrange
    const inventory: V4VaultInventory = {
      vaultIndex: 0,
      vault: key(1),
      lamports: 0n,
      tokens: Array.from({ length: 12 }, (_, i) => ({
        account: key(10 + i),
        mint: key(110 + i),
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        amount: 1n,
        frozen: false,
        associated: true,
      })),
      tokenRoles: [],
      stakes: [],
      voteAccounts: [],
      programData: [],
      mints: [],
      warnings: [],
    };
    const { groups } = inventoryGroups(inventory, { sol: false });

    // Act
    const items = await chunkMigrationGroups(groups, {
      lineage: "v3",
      sourceMultisig: key(2),
      authorityIndex: 1,
      limits: V3_MIGRATION_LIMITS,
    });

    // Assert: the same sizes as sdk/rs/tests/planner.rs (v3_chunks_like_the_ts_planner).
    expect(items.map((item) => ("items" in item.group ? item.group.items.length : 1))).toEqual([4, 4, 4]);
    expect(items[0]?.messageBytes).toBe(1047);
    items.forEach((item) => expect(item.messageBytes).toBeLessThanOrEqual(V3_MIGRATION_LIMITS.maxMessageBytes));
  });
});
