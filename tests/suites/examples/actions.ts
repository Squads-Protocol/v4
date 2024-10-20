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
        {
          key: members.executor.publicKey,
          permissions: SquadPermissions.Executor,
        },
      ]),
      threshold: 1,
      programId,
    });

    multisigPda = await builder.getMultisigKey();
    const createKey = await builder.getCreateKey();

    const signature = await builder.sendAndConfirm({
      signers: [members.almighty, createKey],
    });

    const [vaultPda] = multisig.getVaultPda({
      multisigPda: multisigPda,
      index: 0,
    });
    await connection.requestAirdrop(vaultPda, 10 * LAMPORTS_PER_SOL);

    assert.ok(signature);
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
    });

    assert.ok(signature);
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

    await configBuilder.withProposal();

    configTransactionPda = configBuilder.getTransactionKey();

    const signature = await configBuilder.sendAndConfirm({
      signers: [members.proposer],
    });

    assert.ok(signature);
  });

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
    txBuilder.withApproval(members.almighty.publicKey);

    const signature = await txBuilder.sendAndConfirm({
      signers: [members.almighty],
      clearInstructions: true,
      options: { preflightCommitment: "finalized" },
    });

    assert.ok(signature);

    await txBuilder.withExecute(members.almighty.publicKey);

    const signature2 = await txBuilder.sendAndConfirm({
      signers: [members.almighty],
      addressLookupTableAccounts: txBuilder.addressLookupTableAccounts,
      options: { skipPreflight: true },
    });

    assert.ok(signature2);
  });
});
