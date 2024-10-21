import * as multisig from "@sqds/multisig";
import {
  PublicKey,
  TransactionMessage,
  Keypair,
  Connection,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
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
  createBatch,
  ConfigActions,
  createMembers,
  isVaultTransaction,
  isConfigTransaction,
  isMultisig,
} from "@sqds/multisig";
import assert from "assert";
import { SquadPermissions } from "@sqds/multisig";

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
  let batchPda: PublicKey;
  let batchWithTx: PublicKey;

  let members: TestMembers;
  let outsider: Keypair;

  before(async () => {
    outsider = await generateFundedKeypair(connection);
    members = await generateMultisigMembers(connection);
  });

  //region Multisig
  it("should create a multisig", async () => {
    const builder = createMultisig({
      connection,
      creator: members.almighty.publicKey,
      members: createMembers([
        { key: members.almighty.publicKey, permissions: SquadPermissions.All },
      ]),
      threshold: 1,
      programId,
    });

    const signature = await builder.sendAndConfirm({
      signers: [members.almighty],
    });

    const [vaultPda] = multisig.getVaultPda({
      multisigPda: multisigPda,
      index: 0,
    });
    await connection.requestAirdrop(vaultPda, 10 * LAMPORTS_PER_SOL);

    assert.ok(signature);
  });

  it("should create a multi-member multisig", async () => {
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
        {
          key: members.executor.publicKey,
          permissions: SquadPermissions.Executor,
        },
      ]),
      threshold: 1,
      programId,
    });

    multisigPda = await builder.getMultisigKey();

    const signature = await builder.sendAndConfirm({
      signers: [members.almighty],
    });

    assert.ok(signature);
  });

  it("should get multisig account", async () => {
    const builder = createMultisig({
      connection,
      creator: members.almighty.publicKey,
      members: createMembers([
        { key: members.almighty.publicKey, permissions: SquadPermissions.All },
      ]),
      threshold: 1,
      programId,
    });

    let multisigKey = await builder.getMultisigKey();

    const signature = await builder.sendAndConfirm({
      signers: [members.almighty],
    });

    assert.ok(signature);

    const account = await builder.getMultisigAccount(multisigKey);

    assert.ok(account instanceof multisig.accounts.Multisig);
  });
  //endregion

  //region Vault Transactions
  it("should create a vault transaction", async () => {
    const [vaultPda] = multisig.getVaultPda({
      multisigPda: multisigPda,
      index: 0,
    });

    await connection.requestAirdrop(vaultPda, 10 * LAMPORTS_PER_SOL);

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

    const signature = await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should create a vault transaction w/ proposal", async () => {
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

    transactionPda = await txBuilder.getTransactionKey();

    const signature = await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should create a vault transaction w/ proposal & approve", async () => {
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
    txBuilder.withApproval({ member: members.almighty.publicKey });

    const signature = await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should create a vault transaction w/ proposal & reject", async () => {
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
    txBuilder.withRejection({ member: members.almighty.publicKey });

    transactionPda = await txBuilder.getTransactionKey();

    const signature = await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should get vault transaction account", async () => {
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

    const transactionKey = await txBuilder.getTransactionKey();

    const signature = await txBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);

    const account = await txBuilder.getTransactionAccount(transactionKey);

    assert.ok(account instanceof multisig.accounts.VaultTransaction);
  });
  //endregion

  //region Config Transactions
  it("should create a config transaction", async () => {
    const configBuilder = createConfigTransaction({
      connection,
      multisig: multisigPda,
      creator: members.proposer.publicKey,
      actions: [ConfigActions.SetTimeLock(10)],
      programId,
    });

    const signature = await configBuilder.sendAndConfirm({
      signers: [members.proposer],
    });

    assert.ok(signature);
  });

  it("should create a config transaction w/ multiple actions", async () => {
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

    const signature = await configBuilder.sendAndConfirm({
      signers: [members.proposer],
    });

    assert.ok(signature);
  });

  it("should create a config transaction w/ proposal", async () => {
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

    configTransactionPda = await configBuilder.getTransactionKey();

    await configBuilder.withProposal();

    const signature = await configBuilder.sendAndConfirm({
      signers: [members.proposer],
    });

    assert.ok(signature);
  });

  it("should create a config transaction w/ proposal & approve", async () => {
    const configBuilder = createConfigTransaction({
      connection,
      multisig: multisigPda,
      creator: members.almighty.publicKey,
      actions: [
        ConfigActions.SetTimeLock(300),
        ConfigActions.SetRentCollector(members.almighty.publicKey),
      ],
      programId,
    });

    await configBuilder.withProposal();
    configBuilder.withApproval({ member: members.almighty.publicKey });

    const signature = await configBuilder.sendAndConfirm({
      signers: [members.almighty],
    });

    assert.ok(signature);
  });

  it("should create a config transaction w/ proposal & reject", async () => {
    const configBuilder = createConfigTransaction({
      connection,
      multisig: multisigPda,
      creator: members.almighty.publicKey,
      actions: [
        ConfigActions.SetTimeLock(300),
        ConfigActions.SetRentCollector(members.almighty.publicKey),
      ],
      programId,
    });

    await configBuilder.withProposal();
    configBuilder.withRejection({ member: members.almighty.publicKey });

    const signature = await configBuilder.sendAndConfirm({
      signers: [members.almighty],
    });

    assert.ok(signature);
  });

  it("should get config transaction account", async () => {
    const configBuilder = createConfigTransaction({
      connection,
      multisig: multisigPda,
      creator: members.proposer.publicKey,
      actions: [ConfigActions.SetTimeLock(10)],
      programId,
    });

    const signature = await configBuilder.sendAndConfirm({
      signers: [members.proposer],
    });

    assert.ok(signature);

    const account = await configBuilder.getTransactionAccount(
      configTransactionPda
    );

    assert.ok(account instanceof multisig.accounts.ConfigTransaction);
  });
  //endregion

  //region Batches
  it("should create a batch", async () => {
    const batchBuilder = createBatch({
      connection,
      creator: members.almighty.publicKey,
      multisig: multisigPda,
      programId,
    });

    const signature = await batchBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should create a batch with proposal", async () => {
    const batchBuilder = createBatch({
      connection,
      creator: members.almighty.publicKey,
      multisig: multisigPda,
      programId,
    });

    batchPda = await batchBuilder.getBatchKey();

    await batchBuilder.withProposal();

    const signature = await batchBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should create a batch with proposal & approval", async () => {
    const batchBuilder = createBatch({
      connection,
      creator: members.almighty.publicKey,
      multisig: multisigPda,
      programId,
    });

    await batchBuilder.withProposal();
    batchBuilder.withApproval({ member: members.almighty.publicKey });

    const signature = await batchBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should create a batch with proposal & reject", async () => {
    const batchBuilder = createBatch({
      connection,
      creator: members.almighty.publicKey,
      multisig: multisigPda,
      programId,
    });

    await batchBuilder.withProposal();
    batchBuilder.withRejection({ member: members.almighty.publicKey });

    const signature = await batchBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should create a batch & add a transaction", async () => {
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

    const batchBuilder = createBatch({
      connection,
      creator: members.almighty.publicKey,
      multisig: multisigPda,
      programId,
    });

    await batchBuilder.withProposal({ isDraft: true });
    await batchBuilder.addTransaction({
      message,
      member: members.almighty.publicKey,
    });

    const signature = await batchBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);
  });

  it("should get batch account", async () => {
    const batchBuilder = createBatch({
      connection,
      creator: members.almighty.publicKey,
      multisig: multisigPda,
      programId,
    });

    const signature = await batchBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);

    const account = await batchBuilder.getBatchAccount(batchPda);

    assert.ok(account instanceof multisig.accounts.Batch);
  });

  it("should get batch transaction account", async () => {
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

    const batchBuilder = createBatch({
      connection,
      creator: members.almighty.publicKey,
      multisig: multisigPda,
      programId,
    });

    await batchBuilder.withProposal({ isDraft: true });
    await batchBuilder.addTransaction({
      message,
      member: members.almighty.publicKey,
    });

    const innerIndex = await batchBuilder.getInnerIndex();
    const transactionKey = await batchBuilder.getBatchTransactionKey(
      innerIndex - 1
    );

    const signature = await batchBuilder.sendAndConfirm({
      feePayer: members.almighty,
    });

    assert.ok(signature);

    const account = await batchBuilder.getBatchTransactionAccount(
      transactionKey
    );

    assert.ok(account instanceof multisig.accounts.VaultBatchTransaction);
  });
  //endregion

  //region Account checks
  it("is this a multisig?", async () => {
    const get = await isMultisig(connection, multisigPda);

    assert.ok(get);
  });

  it("is this a vault transaction?", async () => {
    const get = await isVaultTransaction(connection, transactionPda);

    assert.ok(get);
  });

  it("is this a config transaction?", async () => {
    const get = await isConfigTransaction(connection, configTransactionPda);

    assert.ok(get);
  });
  //endregion

  //region Complete actions
  it("should create, vote on & execute a vault transaction", async () => {
    const message = new TransactionMessage({
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        new TransactionInstruction({
          keys: [
            {
              pubkey: members.almighty.publicKey,
              isSigner: true,
              isWritable: true,
            },
          ],
          data: Buffer.from("Hello from the action builder!", "utf-8"),
          programId: new PublicKey(
            "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
          ),
        }),
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
    txBuilder.withApproval({ member: members.almighty.publicKey });

    const signature = await txBuilder.sendAndConfirm({
      signers: [members.almighty],
      clearInstructions: true,
      options: { preflightCommitment: "finalized" },
    });

    assert.ok(signature);

    await txBuilder.withExecute({ member: members.almighty.publicKey });

    const signature2 = await txBuilder.sendAndConfirm({
      signers: [members.almighty],
      addressLookupTableAccounts: txBuilder.addressLookupTableAccounts,
      options: { skipPreflight: true },
    });

    assert.ok(signature2);
  });
});
