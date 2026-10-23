import { getAddressDecoder, getAddressEncoder, type Address } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  chunkMigrationGroups,
  DEFAULT_MIGRATION_LIMITS,
  getLookupTableAddresses,
  inventoryGroups,
  LOOKUP_TABLE_MIGRATION_LIMITS,
  migrationInstructionTrace,
  parseMintAuthorities,
  TOKEN_2022_PROGRAM_ADDRESS,
  TOKEN_PROGRAM_ADDRESS,
  TokenAuthorityKind,
  type InventoryToken,
  type InventoryTokenRole,
  type MigrationGroup,
  type V4VaultInventory,
} from "../../src";

const key = (byte: number): Address => getAddressDecoder().decode(new Uint8Array(32).fill(byte));

function inventory(overrides: Partial<V4VaultInventory> = {}): V4VaultInventory {
  return {
    vaultIndex: 0,
    vault: key(1),
    lamports: 5_000_000_000n,
    tokens: [],
    tokenRoles: [],
    stakes: [],
    voteAccounts: [],
    programData: [],
    mints: [],
    warnings: [],
    ...overrides,
  };
}

const token = (byte: number, amount: bigint, options: Partial<InventoryToken> = {}): InventoryToken => ({
  account: key(byte),
  mint: key(byte + 100),
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
  amount,
  frozen: false,
  associated: true,
  ...options,
});

const role = (byte: number, owner: Address, options: Partial<InventoryTokenRole> = {}): InventoryTokenRole => ({
  account: key(byte),
  tokenProgram: TOKEN_PROGRAM_ADDRESS,
  mint: key(byte + 100),
  owner,
  frozen: false,
  closeAuthority: true,
  delegatedAmount: null,
  ...options,
});

const tokenGroups = (count: number): MigrationGroup[] =>
  inventoryGroups(inventory({ tokens: Array.from({ length: count }, (_, i) => token(10 + i, 1n)) }), { sol: false }).groups;

const itemsOf = (group: MigrationGroup): readonly unknown[] => ("items" in group ? group.items : []);
const itemCount = (group: MigrationGroup) => ("items" in group ? group.items.length : 1);

describe("inventoryGroups", () => {
  it("orders the classes and puts SOL last", () => {
    // Arrange
    const vault = inventory({
      tokens: [token(10, 5n), token(11, 5n, { tokenProgram: TOKEN_2022_PROGRAM_ADDRESS })],
      mints: [
        {
          mint: key(20),
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
          authorities: [TokenAuthorityKind.MintTokens, TokenAuthorityKind.FreezeAccount],
        },
      ],
      stakes: [{ stake: key(40), staker: true, withdrawer: true, custodian: false }],
      voteAccounts: [key(50)],
      programData: [key(30)],
    });

    // Act
    const { groups } = inventoryGroups(vault);

    // Assert
    expect(groups.map((group) => [group.class, itemCount(group)])).toEqual([
      ["tokens", 1],
      ["tokens", 1],
      ["tokenAuthorities", 2],
      ["stakes", 1],
      ["voteAccounts", 1],
      ["programs", 1],
      ["sol", 1],
    ]);
    expect(groups[1]).toMatchObject({ class: "tokens", tokenProgram: TOKEN_2022_PROGRAM_ADDRESS });
  });

  it("leaves out frozen accounts with a note, and empty accounts unless it closes them", () => {
    // Arrange
    const vault = inventory({ tokens: [token(10, 0n), token(11, 3n, { frozen: true })], lamports: 0n });

    // Act
    const closing = inventoryGroups(vault);
    const keeping = inventoryGroups(vault, { closeTokenAccounts: false });

    // Assert
    expect(closing.groups).toEqual([
      { class: "tokens", tokenProgram: TOKEN_PROGRAM_ADDRESS, closeSource: true, items: [{ sourceTokenAccount: key(10), mint: key(110) }] },
    ]);
    expect(closing.notes).toEqual([`token account ${key(11)} is frozen; it cannot move`]);
    expect(keeping.groups).toEqual([]);
  });

  it("moves non-associated accounts by owner change when they keep their address", () => {
    // Arrange
    const vault = inventory({ tokens: [token(10, 5n), token(11, 5n, { associated: false })], lamports: 0n });

    // Act
    const { groups } = inventoryGroups(vault, { preserveTokenAccountAddresses: true });

    // Assert
    expect(groups).toEqual([
      { class: "tokens", tokenProgram: TOKEN_PROGRAM_ADDRESS, closeSource: true, items: [{ sourceTokenAccount: key(10), mint: key(110) }] },
      {
        class: "tokenAuthorities",
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        items: [{ account: key(11), kind: TokenAuthorityKind.AccountOwner }],
      },
    ]);
  });

  it("moves close authorities that the token step leaves behind, like the Rust planner", () => {
    // Arrange: the vault (key 1) holds the close authority of accounts 30-33 and delegates on 34.
    const vault = inventory({
      tokens: [token(32, 5n, { associated: false }), token(33, 5n)],
      tokenRoles: [
        role(30, key(9)),
        role(31, key(9), { frozen: true }),
        role(32, key(1)),
        role(33, key(1)),
        role(34, key(9), { closeAuthority: false, delegatedAmount: 7n }),
      ],
      lamports: 0n,
    });

    // Act
    const { groups, notes } = inventoryGroups(vault, { preserveTokenAccountAddresses: true });

    // Assert: 30 (other owner) and 32 (moves by owner change); not 31 (frozen) or 33 (closed by the token step).
    expect(groups.find((group) => group.class === "tokenAuthorities")).toEqual({
      class: "tokenAuthorities",
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      items: [
        { account: key(32), kind: TokenAuthorityKind.AccountOwner },
        { account: key(30), kind: TokenAuthorityKind.CloseAccount },
        { account: key(32), kind: TokenAuthorityKind.CloseAccount },
      ],
    });
    expect(notes).toEqual([
      `token account ${key(31)} is frozen; its close authority cannot move`,
      `the vault is the delegate of token account ${key(34)} (owner ${key(9)}) for 7 tokens; this role cannot move, only the owner can change it`,
    ]);
  });
});

describe("parseMintAuthorities", () => {
  const vault = key(1);
  const other = key(2);
  const bytes = (address: Address) => [...getAddressEncoder().encode(address)];
  const u16 = (value: number) => [value & 0xff, value >> 8];
  const extension = (type: number, value: number[]) => [...u16(type), ...u16(value.length), ...value];

  function mint(base: { mint?: Address; freeze?: Address }, extensions: number[][] = []): Uint8Array {
    const data = new Uint8Array(82);
    if (base.mint) data.set([1, 0, 0, 0, ...bytes(base.mint)], 0);
    if (base.freeze) data.set([1, 0, 0, 0, ...bytes(base.freeze)], 46);
    if (extensions.length === 0) return data;
    return Uint8Array.from([...data, ...new Array(165 - 82).fill(0), 1, ...extensions.flat()]);
  }

  it("reads the mint and freeze authorities of a plain mint", () => {
    // Act
    const held = parseMintAuthorities(mint({ mint: vault, freeze: other }), vault);

    // Assert
    expect(held).toEqual([TokenAuthorityKind.MintTokens]);
  });

  it("reads the Token-2022 extension and metadata authorities that the vault holds", () => {
    // Arrange: transfer fee (vault withdraws withheld fees only), close mint, metadata, pausable.
    const transferFee = [...bytes(other), ...bytes(vault), ...new Array(44).fill(0)];
    const metadata = [...bytes(vault), ...bytes(key(9)), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const data = mint({ freeze: vault }, [
      extension(1, transferFee),
      extension(3, bytes(vault)),
      extension(19, metadata),
      extension(26, [...bytes(other), 0]),
    ]);

    // Act
    const held = parseMintAuthorities(data, vault);

    // Assert
    expect(held).toEqual([
      TokenAuthorityKind.FreezeAccount,
      TokenAuthorityKind.WithheldWithdraw,
      TokenAuthorityKind.CloseMint,
      TokenAuthorityKind.MetadataUpdate,
    ]);
  });

  it("returns null for data that is not a mint", () => {
    // Act
    const held = parseMintAuthorities(new Uint8Array(165), vault);

    // Assert
    expect(held).toBeNull();
  });
});

describe("chunkMigrationGroups", () => {
  it("splits a group into items within the limits and keeps the order", async () => {
    // Arrange
    const groups = tokenGroups(12);

    // Act
    const items = await chunkMigrationGroups(groups, { sourceMultisig: key(2) });

    // Assert: the same sizes as sdk/rs/tests/planner.rs (chunks_within_the_limits_like_the_ts_planner).
    expect(items.map((item) => itemCount(item.group))).toEqual([5, 5, 2]);
    expect(items[0]?.messageBytes).toBe(781);
    expect(items.flatMap((item) => itemsOf(item.group))).toEqual(itemsOf(groups[0]!));
    items.forEach((item) => {
      expect(item.messageBytes).toBeLessThanOrEqual(DEFAULT_MIGRATION_LIMITS.maxMessageBytes);
      expect(item.messageAccounts).toBeLessThanOrEqual(DEFAULT_MIGRATION_LIMITS.maxMessageAccounts);
    });
  });

  it("never mixes two groups in one item", async () => {
    // Arrange
    const groups = inventoryGroups(
      inventory({
        tokens: [token(10, 1n)],
        stakes: [{ stake: key(40), staker: true, withdrawer: true, custodian: false }],
        programData: [key(30)],
      }),
    ).groups;

    // Act
    const items = await chunkMigrationGroups(groups, { sourceMultisig: key(2) });

    // Assert
    expect(items.map((item) => item.group.class)).toEqual(["tokens", "stakes", "programs", "sol"]);
  });

  it("puts more items in each batch item when a lookup table holds their accounts", async () => {
    // Arrange
    const groups = tokenGroups(24);
    const without = await chunkMigrationGroups(groups, { sourceMultisig: key(2) });
    const table = getLookupTableAddresses(without.map((item) => item.instruction));

    // Act
    const withTable = await chunkMigrationGroups(groups, {
      sourceMultisig: key(2),
      addressLookupTables: { [key(3)]: table },
      limits: LOOKUP_TABLE_MIGRATION_LIMITS,
    });

    // Assert: the same counts as sdk/rs/tests/planner.rs; the instruction trace binds the tokens.
    expect(without.map((item) => itemCount(item.group))).toEqual([5, 5, 5, 5, 4]);
    expect(withTable.map((item) => itemCount(item.group))).toEqual([6, 6, 6, 6]);
    withTable.forEach((item) => expect(item.instructionTrace).toBeLessThanOrEqual(64));
  });

  it("counts the worst-case instruction trace like the Rust planner", () => {
    // Arrange
    const tokens: MigrationGroup = {
      class: "tokens",
      tokenProgram: TOKEN_PROGRAM_ADDRESS,
      closeSource: true,
      items: new Array(6).fill({ sourceTokenAccount: key(10), mint: key(110) }),
    };
    const stakes: MigrationGroup = { class: "stakes", items: new Array(3).fill(key(40)) };

    // Act
    const traces = [
      migrationInstructionTrace(tokens, true),
      migrationInstructionTrace(stakes, false),
      migrationInstructionTrace({ class: "sol", keep: 0n }, true),
    ];

    // Assert: 4 for the execute transaction, 1 for the event, then 9 per token or 3 per stake.
    expect(traces).toEqual([59, 13, 6]);
  });

  it("fails when one asset alone does not fit", async () => {
    // Act
    const result = chunkMigrationGroups(tokenGroups(1), { sourceMultisig: key(2), limits: { maxMessageBytes: 100 } });

    // Assert
    await expect(result).rejects.toThrow(/does not fit/);
  });
});

describe("getLookupTableAddresses", () => {
  it("keeps each account once and leaves out signers and programs", async () => {
    // Arrange
    const items = await chunkMigrationGroups(tokenGroups(2), { sourceMultisig: key(2) });

    // Act
    const addresses = getLookupTableAddresses(items.map((item) => item.instruction));

    // Assert
    expect(new Set(addresses).size).toBe(addresses.length);
    expect(addresses).not.toContain(TOKEN_PROGRAM_ADDRESS);
    expect(addresses).toContain(key(10));
    expect(addresses).toContain(key(110));
  });
});
