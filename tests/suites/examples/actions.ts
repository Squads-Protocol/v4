import * as multisig from "@sqds/multisig";
import {
  PublicKey,
  TransactionMessage,
  Keypair,
  Connection,
} from "@solana/web3.js";
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
  createConfigTransaction,
  ConfigActions,
  createMembers,
  buildFromVaultTransaction,
  isVaultTransaction,
  isMultisig,
} from "@sqds/multisig";
import assert from "assert";
import { SquadPermissions } from "@sqds/multisig";

const { Permission, Permissions } = multisig.types;

const programId = getTestProgramId();

const getLogs = async (
  connection: Connection,
  signature: string
): Promise<string[] | null> => {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  return tx?.meta?.logMessages ?? null;
};

describe("Examples / End2End Actions", () => {
  const connection = createLocalhostConnection();

  let multisigPda: PublicKey = PublicKey.default;
  let transactionPda: PublicKey;
  let configTransactionPda: PublicKey;
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
      members: createMembers([
        { key: members.almighty.publicKey, permissions: SquadPermissions.All },
        {
          key: members.proposer.publicKey,
          permissions: SquadPermissions.Proposer,
        },
        { key: members.voter.publicKey, permissions: SquadPermissions.Voter },
      ]),
      threshold: 1,
      programId,
    });

    multisigPda = await builder.getMultisigKey();
    const createKey = await builder.getCreateKey();

    const signature = await builder.sendAndConfirm({
      signers: [members.almighty, createKey],
      options: { skipPreflight: true, preflightCommitment: "finalized" },
    });

    const logs = await getLogs(connection, signature);

    console.log(logs);
  });

  it("should create a vault transaction", async () => {
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

    const signature = await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
      options: { skipPreflight: true, preflightCommitment: "finalized" },
    });

    const logs = await getLogs(connection, signature);

    console.log(logs);
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

    await txBuilder.withProposal();
    txBuilder.withApproval(members.almighty.publicKey);

    await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
      options: { skipPreflight: true, preflightCommitment: "finalized" },
    });
  });

  it("is this a multisig?", async () => {
    async function retryCheck(maxAttempts = 10, delayMs = 1000) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const get = await isMultisig(connection, multisigPda);
        if (get) return true;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return false;
    }

    const get = await retryCheck();

    assert.ok(get);
  });

  it("is this a vault transaction?", async () => {
    async function retryCheck(maxAttempts = 10, delayMs = 1000) {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const get = await isVaultTransaction(connection, transactionPda);
        if (get) return true;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return false;
    }

    const get = await retryCheck();

    assert.ok(get);
  });

  it("should create a config transaction", async () => {
    const configBuilder = createConfigTransaction({
      connection,
      multisig: multisigPda,
      creator: members.proposer.publicKey,
      actions: [
        ConfigActions.SetTimeLock(300),
        ConfigActions.SetRentCollector(members.almighty.publicKey),
      ],
      programId,
    });

    configTransactionPda = configBuilder.getTransactionKey();

    await configBuilder.withProposal();
    configBuilder.withApproval(members.almighty.publicKey);

    await configBuilder.sendAndConfirm({
      signers: [members.almighty, members.proposer],
      options: { preflightCommitment: "finalized" },
    });
  });

  it("should create a vault transaction builder from key", async () => {
    const get = await isVaultTransaction(connection, transactionPda);

    assert.ok(get);

    const builder = await buildFromVaultTransaction({
      connection,
      transaction: transactionPda,
      programId,
    });

    await builder.withProposal();
    builder.withApproval(members.almighty.publicKey);

    const signature = await builder.sendAndConfirm({
      feePayer: members.almighty,
      options: { preflightCommitment: "finalized" },
    });
  });
});
