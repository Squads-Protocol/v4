import { AccountRole, createNoopSigner, getAddressDecoder, getBase58Decoder, none, some, type Address } from "@solana/kit";
import { describe, expect, it } from "vitest";

import {
  decodeLogEvent,
  getMultisigEventsFromTransaction,
  getMultisigDecoder,
  getProposalActivateInstruction,
  LEGACY_V4_PROGRAM_ADDRESS,
  ProposalEventKind,
  SQUADS_MULTISIG4R_PROGRAM_ADDRESS,
  withEvents,
} from "../../src";
import { readFixtures } from "./fixtures";

const key = (byte: number): Address => getAddressDecoder().decode(new Uint8Array(32).fill(byte));
const fromHex = (hex: string) => Uint8Array.from(Buffer.from(hex, "hex"));

// Same event and bytes as programs/squads_multisig_program/tests/events.rs (log_event_data_matches_the_shared_cross_sdk_vector).
const SHARED_VECTOR =
  "05095a8ddf8639d9d10000000802010101010101010101010101010101010101010101010101010101010101" +
  "0101020202020202020202020202020202020202020202020202020202020202020207000000000000000103" +
  "0303030303030303030303030303030303030303030303030303030303030301020000006869010101010101" +
  "01010101010101010101010101010101010101010101010101010107000000000000000300f1536500000000" +
  "fe01000000030303030303030303030303030303030303030303030303030303030303030300000000000000" +
  "00";

describe("decodeLogEvent", () => {
  it("decodes the shared cross-SDK vector", () => {
    // Act
    const event = decodeLogEvent(fromHex(SHARED_VECTOR));

    // Assert
    expect(event).toEqual({
      __kind: "Proposal",
      kind: ProposalEventKind.Approve,
      multisig: key(1),
      proposal: key(2),
      transactionIndex: 7n,
      member: some(key(3)),
      memo: some("hi"),
      snapshot: some({
        multisig: key(1),
        transactionIndex: 7n,
        status: { __kind: "Approved", timestamp: 1_700_000_000n },
        bump: 254,
        approved: [key(3)],
        rejected: [],
        cancelled: [],
      }),
    });
  });

  it("decodes a snapshot without its discriminator like the account decoder", () => {
    // Arrange: a MultisigCreate event (tag 1) around a mainnet Multisig body.
    const fixture = readFixtures("accounts.txt").find((f) => f.label === "Multisig");
    if (!fixture) throw new Error("no Multisig fixture");
    const { discriminator: _, ...account } = getMultisigDecoder().decode(fixture.bytes);
    const [, accountLength] = getMultisigDecoder().read(fixture.bytes, 0);
    const body = fixture.bytes.slice(8, accountLength);
    const event = Uint8Array.from([1, ...new Uint8Array(96).fill(4), 0, 1, ...body]);
    const length = new Uint8Array(new Uint32Array([event.length]).buffer);
    const data = Uint8Array.from([5, 9, 90, 141, 223, 134, 57, 217, ...length, ...event]);

    // Act
    const decoded = decodeLogEvent(data);

    // Assert
    expect(decoded).toMatchObject({ __kind: "MultisigCreate", memo: none(), snapshot: some(account) });
  });

  it("returns null for other instructions and throws on trailing bytes", () => {
    // Arrange
    const trailing = fromHex(SHARED_VECTOR.replace("d1000000", "d2000000") + "00");

    // Act + Assert
    expect(decodeLogEvent(new Uint8Array([1, 219, 215, 108, 184, 229, 214, 8]))).toBeNull();
    expect(decodeLogEvent(new Uint8Array())).toBeNull();
    expect(() => decodeLogEvent(trailing)).toThrow("trailing bytes");
  });
});

describe("withEvents", () => {
  it("appends the program address as a read-only account, except for v4", () => {
    // Arrange
    const accounts = { multisig: key(1), member: createNoopSigner(key(2)), proposal: key(3) };
    const instruction = getProposalActivateInstruction(accounts);
    const legacy = { ...instruction, programAddress: LEGACY_V4_PROGRAM_ADDRESS };

    // Act
    const enabled = withEvents(instruction);

    // Assert
    expect(enabled.accounts).toHaveLength(4);
    expect(enabled.accounts.at(-1)).toEqual({ address: SQUADS_MULTISIG4R_PROGRAM_ADDRESS, role: AccountRole.READONLY });
    expect(withEvents(legacy)).toBe(legacy);
  });
});

describe("getMultisigEventsFromTransaction", () => {
  // Keys: 0 payer, 1 multisig (the shared vector's authority), 2 program, 3 another program.
  const program = key(2);
  const data = getBase58Decoder().decode(fromHex(SHARED_VECTOR));
  const transaction = (signer: number) => ({
    transaction: { message: { accountKeys: [key(9), key(1), program, key(3)] } },
    meta: {
      innerInstructions: [
        { index: 1, instructions: [{ programIdIndex: 2, accounts: [signer], data }] },
        {
          index: 0,
          instructions: [
            { programIdIndex: 3, accounts: [1], data },
            { programIdIndex: 2, accounts: [1], data: getBase58Decoder().decode(new Uint8Array([1, 2, 3])) },
          ],
        },
      ],
      loadedAddresses: { writable: [], readonly: [] },
    },
  });

  it("returns the verified events of the program only", () => {
    // Act
    const events = getMultisigEventsFromTransaction(transaction(1), program);

    // Assert
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ __kind: "Proposal", multisig: key(1), proposal: key(2) });
  });

  it("throws if the signer is not the multisig that the event names", () => {
    // Act + Assert
    expect(() => getMultisigEventsFromTransaction(transaction(0), program)).toThrow("not signed by the multisig");
  });

  it("returns no events for a transaction without metadata", () => {
    // Act + Assert
    expect(getMultisigEventsFromTransaction({ ...transaction(1), meta: null }, program)).toEqual([]);
  });
});
