import assert from "assert";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { createLocalhostConnection, getTestProgramId } from "../utils";

const { Multisig } = multisig.accounts;
const { toBigInt } = multisig.utils;

const programId = getTestProgramId();

describe("Account Schema Migrations", () => {
  const connection = createLocalhostConnection();

  it("Multisig account created before introduction of rent_collector field should load by program", async () => {
    const memberKeypair = Keypair.fromSecretKey(
      new Uint8Array([
        56, 145, 84, 172, 159, 38, 155, 221, 251, 78, 28, 43, 31, 8, 69, 68,
        160, 49, 219, 216, 250, 32, 126, 39, 214, 117, 166, 11, 252, 178, 65,
        130, 11, 92, 164, 60, 139, 164, 93, 170, 114, 21, 22, 181, 56, 34, 172,
        176, 108, 3, 104, 246, 136, 240, 25, 14, 175, 151, 198, 192, 130, 183,
        85, 161,
      ])
    );
    // Fund the member wallet.
    const tx = await connection.requestAirdrop(
      memberKeypair.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(tx);

    // This is the account that was created before the `rent_collector` field was added to the schema.
    const oldMultisigPda = new PublicKey(
      "D3oQ6QxSYk6aKUsmBTa9BghFQvbRi7kxP6h95NSdjjXz"
    );

    // Should deserialize with the latest SDK.
    const oldMultisigAccount = await Multisig.fromAccountAddress(
      connection,
      oldMultisigPda
    );

    // Should deserialize `rent_collector` as null.
    assert.equal(oldMultisigAccount.rentCollector, null);

    // Should work with the latest version of the program.
    // This transaction will fail if the program cannot deserialize the multisig account.
    const sig = await multisig.rpc.configTransactionCreate({
      connection,
      multisigPda: oldMultisigPda,
      feePayer: memberKeypair,
      transactionIndex: toBigInt(oldMultisigAccount.transactionIndex) + 1n,
      actions: [{ __kind: "SetTimeLock", newTimeLock: 300 }],
      creator: memberKeypair.publicKey,
      rentPayer: memberKeypair.publicKey,
      programId,
    });
    await connection.confirmTransaction(sig);
  });
});
