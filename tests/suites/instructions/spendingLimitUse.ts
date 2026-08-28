import * as multisig from "@sqds/multisig";
import { PublicKey } from "@solana/web3.js";
import assert from "assert";

describe("Instructions / spending_limit_use", () => {
  it("serializes bigint amounts across the full u64 range", () => {
    const amount = 18_446_744_073_709_551_615n;

    const instruction = multisig.instructions.spendingLimitUse({
      multisigPda: PublicKey.default,
      member: PublicKey.default,
      spendingLimit: PublicKey.default,
      vaultIndex: 0,
      amount,
      decimals: 0,
      destination: PublicKey.default,
    });

    const serializedAmount = instruction.data.subarray(8, 16);
    assert.strictEqual(serializedAmount.readBigUInt64LE(), amount);
  });
});
