import type { Codec } from "@solana/kit";
import { describe, expect, it } from "vitest";

import * as sdk from "../../src";
import { readFixtures, toHex } from "./fixtures";

// Each mainnet fixture must decode with the generated codecs and encode to the same bytes.
const accountCodecs: Record<string, () => Codec<any, any>> = {
  Batch: sdk.getBatchCodec,
  ConfigTransaction: sdk.getConfigTransactionCodec,
  Multisig: sdk.getMultisigCodec,
  ProgramConfig: sdk.getProgramConfigCodec,
  Proposal: sdk.getProposalCodec,
  SpendingLimit: sdk.getSpendingLimitCodec,
  TransactionBuffer: sdk.getTransactionBufferCodec,
  VaultBatchTransaction: sdk.getVaultBatchTransactionCodec,
  VaultTransaction: sdk.getVaultTransactionCodec,
};

const pascal = (snake: string) => snake.replace(/(^|_)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

function instructionCodec(name: string): Codec<any, any> {
  const getter = (sdk as Record<string, unknown>)[`get${pascal(name)}InstructionDataCodec`];
  if (typeof getter !== "function") throw new Error(`no generated codec for ${name}`);
  return getter();
}

describe("mainnet golden fixtures", () => {
  it.each(readFixtures("accounts.txt").map((f) => [f.label, f.id, f] as const))("account %s %s round-trips", (kind, _id, fixture) => {
    // Arrange
    const codec = accountCodecs[kind];
    if (!codec) throw new Error(`unknown account type ${kind}`);

    // Act
    const decoded = codec().decode(fixture.bytes);
    const encoded = codec().encode(decoded);

    // Assert
    expect(toHex(encoded)).toBe(toHex(fixture.bytes.subarray(0, encoded.length)));
  });

  it.each(readFixtures("instructions.txt").map((f) => [f.label, f.id, f] as const))("instruction %s %s round-trips", (name, _id, fixture) => {
    // Arrange
    const codec = instructionCodec(name);

    // Act
    const [decoded, offset] = codec.read(fixture.bytes, 0);
    const encoded = codec.encode(decoded);

    // Assert
    expect(offset).toBe(fixture.bytes.length);
    expect(toHex(encoded)).toBe(toHex(fixture.bytes));
    if ("transactionMessage" in decoded) {
      const message = sdk.getTransactionMessageCodec();
      const bytes = decoded.transactionMessage as Uint8Array;
      expect(toHex(message.encode(message.decode(bytes)))).toBe(toHex(bytes));
    }
  });
});
