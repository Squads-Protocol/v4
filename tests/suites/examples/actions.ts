import * as multisig from "@sqds/multisig";
import { PublicKey, TransactionMessage, Keypair } from "@solana/web3.js";
import {
  createLocalhostConnection,
  createTestTransferInstruction,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";
import {
  createMultisig,
  createVaultTransaction,
} from "@sqds/multisig/src/actions";
import assert from "assert";

const programId = getTestProgramId();

describe("Examples / End2End Actions", () => {
  const connection = createLocalhostConnection();

  let multisigPda: PublicKey = PublicKey.default;
  let members: TestMembers;
  let outsider: Keypair;
  before(async () => {
    outsider = await generateFundedKeypair(connection);
    members = await generateMultisigMembers(connection);
  });

  it("should create a multisig", async () => {
    const builder = createMultisig({
      connection,
      creator: members.almighty.publicKey,
      members: members as any,
      threshold: 2,
      programId,
    });

    multisigPda = builder.getMultisigKey();
    await builder.sendAndConfirm();
  });

  it("should create a multisig", async () => {
    const builder = createMultisig({
      connection,
      creator: members.almighty.publicKey,
      members: members as any,
      threshold: 2,
      programId,
    });

    multisigPda = builder.getMultisigKey();
    const signature = await builder.sendAndConfirm();
    const account = await builder.getMultisigAccount(multisigPda);

    assert.strictEqual(account.threshold, 2);
  });

  it("should create & send a vault transaction", async () => {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: multisigPda,
      index: 0,
    });
    const message = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        createTestTransferInstruction(vaultPda, outsider.publicKey),
      ],
    });
    const txBuilder = createVaultTransaction({
      connection,
      multisig: multisigPda,
      creator: members.almighty.publicKey,
      message,
      programId,
    });
    txBuilder.withProposal();
    txBuilder.withApproval();

    const signature = await txBuilder.sendAndConfirm();

    console.log(signature);
  });

  it("should create, vote & execute a vault transaction", async () => {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: multisigPda,
      index: 0,
    });
    const message = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        createTestTransferInstruction(vaultPda, outsider.publicKey),
      ],
    });
    const txBuilder = createVaultTransaction({
      connection,
      multisig: multisigPda,
      creator: members.almighty.publicKey,
      message,
      programId,
    });
    txBuilder.withProposal();
    txBuilder.withApproval();
    txBuilder.execute();

    const signature = await txBuilder.sendAndConfirm();

    console.log(signature);
  });
});
