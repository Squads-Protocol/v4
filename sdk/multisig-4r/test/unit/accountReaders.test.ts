import { readFileSync } from "node:fs";
import { join } from "node:path";

import { type Address } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  parseMintAuthorities,
  parseStake,
  parseTokenAccount,
  parseTokenRole,
  parseVoteWithdrawer,
  TOKEN_2022_PROGRAM_ADDRESS,
} from "../../src";

// Accounts that the official Rust crates encoded (`sdk/rs/tests/account_readers.rs`), with the expected values.
type Fixture = {
  readonly vault: Address;
  readonly mints: readonly { readonly data: string; readonly authorities: readonly number[] }[];
  readonly tokenAccounts: readonly {
    readonly data: string;
    readonly mint: Address;
    readonly owner: Address;
    readonly amount: string;
    readonly frozen: boolean;
    readonly closeAuthority: boolean;
    readonly delegatedAmount: string | null;
  }[];
  readonly stakes: readonly {
    readonly data: string;
    readonly roles: { readonly staker: boolean; readonly withdrawer: boolean; readonly custodian: boolean } | null;
  }[];
  readonly voteAccounts: readonly { readonly data: string; readonly withdrawer: Address | null }[];
};

const fixture: Fixture = JSON.parse(
  readFileSync(join(__dirname, "..", "..", "..", "rs", "tests", "fixtures", "account_readers.json"), "utf8"),
);
const bytes = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));
const ACCOUNT = fixture.vault;

// A seeded generator (xorshift32), so every run checks the same random buffers.
function randomBuffers(count: number, maxLength: number): Uint8Array[] {
  let state = 0x9e3779b9;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return state >>> 0;
  };
  return Array.from({ length: count }, () => Uint8Array.from({ length: next() % maxLength }, () => next() & 0xff));
}

describe("account readers", () => {
  it("read the Token-2022 mint authorities like the Rust planner", () => {
    fixture.mints.forEach(({ data, authorities }) => {
      expect(parseMintAuthorities(bytes(data), fixture.vault)).toEqual(authorities);
    });
  });

  it("read token accounts and the vault's close authority and delegate roles", () => {
    fixture.tokenAccounts.forEach((expected) => {
      // Arrange
      const data = bytes(expected.data);

      // Act
      const token = parseTokenAccount(data);
      const role = parseTokenRole(ACCOUNT, TOKEN_2022_PROGRAM_ADDRESS, fixture.vault, data);

      // Assert
      expect(token).toEqual({ mint: expected.mint, owner: expected.owner, amount: BigInt(expected.amount), frozen: expected.frozen });
      const delegatedAmount = expected.delegatedAmount === null ? null : BigInt(expected.delegatedAmount);
      const held = expected.closeAuthority || delegatedAmount !== null;
      expect(role && { closeAuthority: role.closeAuthority, delegatedAmount: role.delegatedAmount }).toEqual(
        held ? { closeAuthority: expected.closeAuthority, delegatedAmount } : null,
      );
      expect(parseMintAuthorities(data, fixture.vault)).toBeNull();
    });
  });

  it("read the stake roles of every stake state", () => {
    fixture.stakes.forEach(({ data, roles }) => {
      expect(parseStake(ACCOUNT, fixture.vault, bytes(data))).toEqual(roles && { stake: ACCOUNT, ...roles });
    });
  });

  it("read the withdrawer of every vote state version", () => {
    fixture.voteAccounts.forEach(({ data, withdrawer }) => {
      expect(parseVoteWithdrawer(bytes(data))).toEqual(withdrawer);
    });
  });

  it("accept any bytes without an exception", () => {
    // Arrange: random buffers, also with a Token-2022 account type so the readers walk the extensions.
    const buffers = randomBuffers(500, 700).flatMap((data) =>
      data.length > 166 ? [data, Uint8Array.from(data).fill(1, 165, 166), Uint8Array.from(data).fill(2, 165, 166)] : [data],
    );

    // Act and assert
    buffers.forEach((data) => {
      expect(() => {
        parseMintAuthorities(data, fixture.vault);
        parseTokenAccount(data);
        parseTokenRole(ACCOUNT, TOKEN_2022_PROGRAM_ADDRESS, fixture.vault, data);
        parseStake(ACCOUNT, fixture.vault, data);
        parseVoteWithdrawer(data);
      }).not.toThrow();
    });
  });
});
