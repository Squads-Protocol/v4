import { address, lamports, type Address, type EncodedAccount } from "@solana/kit";
import { describe, expect, it } from "vitest";

import { decodeChecked, getMultisigDecoder, MULTISIG_DISCRIMINATOR, SQUADS_MULTISIG4R_PROGRAM_ADDRESS } from "../../src";
import { readFixtures } from "./fixtures";

const V4_PROGRAM = address("SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf");

function encodedAccount(data: Uint8Array, programAddress: Address = SQUADS_MULTISIG4R_PROGRAM_ADDRESS): EncodedAccount {
  return {
    address: address("11111111111111111111111111111112"),
    data,
    executable: false,
    lamports: lamports(1n),
    programAddress,
    space: BigInt(data.length),
  };
}

const multisigBytes = () => {
  const fixture = readFixtures("accounts.txt").find((f) => f.label === "Multisig");
  if (!fixture) throw new Error("no Multisig fixture");
  return fixture.bytes;
};

describe("decodeChecked", () => {
  it("decodes an account owned by the 4r program", () => {
    // Act
    const account = decodeChecked(encodedAccount(multisigBytes()), getMultisigDecoder(), MULTISIG_DISCRIMINATOR);

    // Assert
    expect(account.data.members.length).toBeGreaterThan(0);
  });

  it("rejects a v4 account even though the layout is identical", () => {
    // Act
    const act = () => decodeChecked(encodedAccount(multisigBytes(), V4_PROGRAM), getMultisigDecoder(), MULTISIG_DISCRIMINATOR);

    // Assert
    expect(act).toThrow(/is owned by SQDS4/);
  });

  it("rejects a different account type", () => {
    // Arrange
    const bytes = multisigBytes().slice();
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;

    // Act
    const act = () => decodeChecked(encodedAccount(bytes), getMultisigDecoder(), MULTISIG_DISCRIMINATOR);

    // Assert
    expect(act).toThrow(/unexpected discriminator/);
  });
});
