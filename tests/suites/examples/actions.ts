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
import { createMultisig, createVaultTransaction } from "@sqds/multisig";
import assert from "assert";

const { Permission, Permissions } = multisig.types;

const programId = getTestProgramId();

describe("Examples / End2End Actions", () => {
  const connection = createLocalhostConnection();

  let multisigPda: PublicKey = PublicKey.default;
  let transactionPda: PublicKey | null = null;
  let members: TestMembers;
  let outsider: Keypair;
  before(async () => {
    outsider = await generateFundedKeypair(connection);
    members = await generateMultisigMembers(connection);
  });

  it("should create a multisig", async () => {
    console.log("Creating a multisig with 2 members");
    const builder = createMultisig({
      connection,
      creator: members.almighty.publicKey,
      members: [
        {
          key: members.almighty.publicKey,
          permissions: Permissions.all(),
        },
        {
          key: members.voter.publicKey,
          permissions: Permissions.all(),
        },
      ],
      threshold: 1,
      programId,
    });

    multisigPda = await builder.getMultisigKey();
    const createKey = await builder.getCreateKey();

    await builder.sendAndConfirm({
      signers: [members.almighty, createKey],
      options: { preflightCommitment: "finalized" },
    });
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

    await txBuilder.withProposal();

    transactionPda = txBuilder.getTransactionKey();

    await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
      options: { preflightCommitment: "finalized" },
    });
  });

  it("should create a vault transaction & vote", async () => {
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

    (await txBuilder.withProposal()).withApproval(members.almighty.publicKey);
    // await txBuilder.withExecute(members.executor.publicKey);

    await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
      options: { preflightCommitment: "finalized" },
    });
  });

  it("is this a vault transaction?", async () => {
    assert.ok(multisig.isVaultTransaction(connection, transactionPda!));
  });
});
