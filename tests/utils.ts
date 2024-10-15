import { createMemoInstruction } from "@solana/spl-memo";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import assert from "assert";
import { readFileSync } from "fs";
import path from "path";

const { Permission, Permissions } = multisig.types;
const { Proposal } = multisig.accounts;

export function getTestProgramId() {
  const programKeypair = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        readFileSync(
          path.join(
            __dirname,
            "../target/deploy/squads_multisig_program-keypair.json"
          ),
          "utf-8"
        )
      )
    )
  );

  return programKeypair.publicKey;
}

export function getTestProgramConfigInitializer() {
  return Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        readFileSync(
          path.join(
            __dirname,
            "../test-program-config-initializer-keypair.json"
          ),
          "utf-8"
        )
      )
    )
  );
}

export function getTestProgramConfigAuthority() {
  return Keypair.fromSecretKey(
    new Uint8Array([
      58, 1, 5, 229, 201, 214, 134, 29, 37, 52, 43, 109, 207, 214, 183, 48, 98,
      98, 141, 175, 249, 88, 126, 84, 69, 100, 223, 58, 255, 212, 102, 90, 107,
      20, 85, 127, 19, 55, 155, 38, 5, 66, 116, 148, 35, 139, 23, 147, 13, 179,
      188, 20, 37, 180, 156, 157, 85, 137, 29, 133, 29, 66, 224, 91,
    ])
  );
}

export function getTestProgramTreasury() {
  return Keypair.fromSecretKey(
    new Uint8Array([
      232, 179, 154, 90, 210, 236, 13, 219, 79, 25, 133, 75, 156, 226, 144, 171,
      193, 108, 104, 128, 11, 221, 29, 219, 139, 195, 211, 242, 231, 36, 196,
      31, 76, 110, 20, 42, 135, 60, 143, 79, 151, 67, 78, 132, 247, 97, 157, 8,
      86, 47, 10, 52, 72, 7, 88, 121, 175, 107, 108, 245, 215, 149, 242, 20,
    ])
  ).publicKey;
}

export type TestMembers = {
  almighty: Keypair;
  proposer: Keypair;
  voter: Keypair;
  executor: Keypair;
};

export async function generateFundedKeypair(connection: Connection) {
  const keypair = Keypair.generate();

  const tx = await connection.requestAirdrop(
    keypair.publicKey,
    1 * LAMPORTS_PER_SOL
  );
  await connection.confirmTransaction(tx);

  return keypair;
}

export async function generateMultisigMembers(
  connection: Connection
): Promise<TestMembers> {
  const members = {
    almighty: Keypair.generate(),
    proposer: Keypair.generate(),
    voter: Keypair.generate(),
    executor: Keypair.generate(),
  };

  // UNCOMMENT TO PRINT MEMBER PUBLIC KEYS
  // console.log("Members:");
  // for (const [name, keypair] of Object.entries(members)) {
  //   console.log(name, ":", keypair.publicKey.toBase58());
  // }

  // Airdrop 100 SOL to each member.
  await Promise.all(
    Object.values(members).map(async (member) => {
      const sig = await connection.requestAirdrop(
        member.publicKey,
        100 * LAMPORTS_PER_SOL
      );
      await connection.confirmTransaction(sig);
    })
  );

  return members;
}

export function createLocalhostConnection() {
  return new Connection("http://127.0.0.1:8899", "confirmed");
}

export const getLogs = async (connection: Connection, signature: string): Promise<string[]> => {
  const tx = await connection.getTransaction(
    signature,
    { commitment: "confirmed" }
  )
  return tx!.meta!.logMessages || []
}

export async function createAutonomousMultisig({
  connection,
  createKey = Keypair.generate(),
  members,
  threshold,
  timeLock,
  programId,
}: {
  createKey?: Keypair;
  members: TestMembers;
  threshold: number;
  timeLock: number;
  connection: Connection;
  programId: PublicKey;
}) {

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });

  await createAutonomousMultisigV2({
    connection,
    createKey,
    members,
    threshold,
    timeLock,
    rentCollector: null,
    programId,
  });

  return [multisigPda, multisigBump] as const;
}

export async function createAutonomousMultisigV2({
  connection,
  createKey = Keypair.generate(),
  members,
  threshold,
  timeLock,
  rentCollector,
  programId,
}: {
  createKey?: Keypair;
  members: TestMembers;
  threshold: number;
  timeLock: number;
  rentCollector: PublicKey | null;
  connection: Connection;
  programId: PublicKey;
}) {
  const creator = await generateFundedKeypair(connection);

  const programConfig =
    await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      multisig.getProgramConfigPda({ programId })[0]
    );
  const programTreasury = programConfig.treasury;

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });

  const signature = await multisig.rpc.multisigCreateV2({
    connection,
    treasury: programTreasury,
    creator,
    multisigPda,
    configAuthority: null,
    timeLock,
    threshold,
    members: [
      { key: members.almighty.publicKey, permissions: Permissions.all() },
      {
        key: members.proposer.publicKey,
        permissions: Permissions.fromPermissions([Permission.Initiate]),
      },
      {
        key: members.voter.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
      {
        key: members.executor.publicKey,
        permissions: Permissions.fromPermissions([Permission.Execute]),
      },
    ],
    createKey: createKey,
    rentCollector,
    sendOptions: { skipPreflight: true },
    programId,
  });

  await connection.confirmTransaction(signature);

  return [multisigPda, multisigBump] as const;
}

export async function createControlledMultisig({
  connection,
  createKey = Keypair.generate(),
  configAuthority,
  members,
  threshold,
  timeLock,
  programId,
}: {
  createKey?: Keypair;
  configAuthority: PublicKey;
  members: TestMembers;
  threshold: number;
  timeLock: number;
  connection: Connection;
  programId: PublicKey;
}) {

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });

  await createControlledMultisigV2({
    connection,
    createKey,
    members,
    rentCollector: null,
    threshold,
    configAuthority: configAuthority,
    timeLock,
    programId
  });

  return [multisigPda, multisigBump] as const;
}

export async function createControlledMultisigV2({
  connection,
  createKey = Keypair.generate(),
  configAuthority,
  members,
  threshold,
  timeLock,
  rentCollector,
  programId,
}: {
  createKey?: Keypair;
  configAuthority: PublicKey;
  members: TestMembers;
  threshold: number;
  timeLock: number;
  rentCollector: PublicKey | null;
  connection: Connection;
  programId: PublicKey;
}) {
  const creator = await generateFundedKeypair(connection);

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });

  const programConfig =
    await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      multisig.getProgramConfigPda({ programId })[0]
    );
  const programTreasury = programConfig.treasury;

  const signature = await multisig.rpc.multisigCreateV2({
    connection,
    treasury: programTreasury,
    creator,
    multisigPda,
    configAuthority,
    timeLock,
    threshold,
    members: [
      { key: members.almighty.publicKey, permissions: Permissions.all() },
      {
        key: members.proposer.publicKey,
        permissions: Permissions.fromPermissions([Permission.Initiate]),
      },
      {
        key: members.voter.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
      {
        key: members.executor.publicKey,
        permissions: Permissions.fromPermissions([Permission.Execute]),
      },
    ],
    createKey: createKey,
    rentCollector,
    sendOptions: { skipPreflight: true },
    programId,
  });

  await connection.confirmTransaction(signature);

  return [multisigPda, multisigBump] as const;
}

export type MultisigWithRentReclamationAndVariousBatches = {
  multisigPda: PublicKey;
  /**
   * Index of a batch with a proposal in the Draft state.
   * The batch contains 1 transaction, which is not executed.
   * The proposal is stale.
   */
  staleDraftBatchIndex: bigint;
  /**
   * Index of a batch with a proposal in the Draft state.
   * The batch contains 1 transaction, which is not executed.
   * The proposal is stale.
   */
  staleDraftBatchNoProposalIndex: bigint;
  /**
   * Index of a batch with a proposal in the Approved state.
   * The batch contains 2 transactions, the first of which is executed, the second is not.
   * The proposal is stale.
   */
  staleApprovedBatchIndex: bigint;
  /** Index of a config transaction that is executed, rendering the batches created before it stale. */
  executedConfigTransactionIndex: bigint;
  /**
   * Index of a batch with a proposal in the Executed state.
   * The batch contains 2 transactions, both of which are executed.
   */
  executedBatchIndex: bigint;
  /**
   * Index of a batch with a proposal in the Active state.
   * The batch contains 1 transaction, which is not executed.
   */
  activeBatchIndex: bigint;
  /**
   * Index of a batch with a proposal in the Approved state.
   * The batch contains 2 transactions, the first of which is executed, the second is not.
   */
  approvedBatchIndex: bigint;
  /**
   * Index of a batch with a proposal in the Rejected state.
   * The batch contains 1 transaction, which is not executed.
   */
  rejectedBatchIndex: bigint;
  /**
   * Index of a batch with a proposal in the Cancelled state.
   * The batch contains 1 transaction, which is not executed.
   */
  cancelledBatchIndex: bigint;
};

export async function createAutonomousMultisigWithRentReclamationAndVariousBatches({
  connection,
  createKey = Keypair.generate(),
  members,
  threshold,
  rentCollector,
  programId,
}: {
  connection: Connection;
  createKey?: Keypair;
  members: TestMembers;
  threshold: number;
  rentCollector: PublicKey | null;
  programId: PublicKey;
}): Promise<MultisigWithRentReclamationAndVariousBatches> {
  const programConfig =
    await multisig.accounts.ProgramConfig.fromAccountAddress(
      connection,
      multisig.getProgramConfigPda({ programId })[0]
    );
  const programTreasury = programConfig.treasury;

  const creator = await generateFundedKeypair(connection);

  const [multisigPda, multisigBump] = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });
  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
    programId,
  });

  //region Create a multisig
  let signature = await multisig.rpc.multisigCreateV2({
    connection,
    treasury: programTreasury,
    creator,
    multisigPda,
    configAuthority: null,
    timeLock: 0,
    threshold,
    members: [
      { key: members.almighty.publicKey, permissions: Permissions.all() },
      {
        key: members.proposer.publicKey,
        permissions: Permissions.fromPermissions([Permission.Initiate]),
      },
      {
        key: members.voter.publicKey,
        permissions: Permissions.fromPermissions([Permission.Vote]),
      },
      {
        key: members.executor.publicKey,
        permissions: Permissions.fromPermissions([Permission.Execute]),
      },
    ],
    createKey: createKey,
    rentCollector,
    sendOptions: { skipPreflight: true },
    programId,
  });
  await connection.confirmTransaction(signature);
  //endregion

  //region Test instructions
  const testMessage1 = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [createMemoInstruction("First memo instruction", [vaultPda])],
  });
  const testMessage2 = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [
      createMemoInstruction("Second memo instruction", [vaultPda]),
    ],
  });
  //endregion

  const staleDraftBatchIndex = 1n;
  const staleDraftBatchNoProposalIndex = 2n;
  const staleApprovedBatchIndex = 3n;
  const executedConfigTransactionIndex = 4n;
  const executedBatchIndex = 5n;
  const activeBatchIndex = 6n;
  const approvedBatchIndex = 7n;
  const rejectedBatchIndex = 8n;
  const cancelledBatchIndex = 9n;

  //region Stale batch with proposal in Draft state
  // Create a batch (Stale and Non-Approved).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: staleDraftBatchIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a draft proposal for the batch (Stale and Non-Approved).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: staleDraftBatchIndex,
    creator: members.proposer,
    isDraft: true,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add a transaction to the batch (Stale and Non-Approved).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: staleDraftBatchIndex,
    vaultIndex: 0,
    transactionIndex: 1,
    transactionMessage: testMessage1,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);
  // This batch will become stale when the config transaction is executed.
  //endregion

  //region Stale batch with No Proposal
  // Create a batch (Stale and Non-Approved).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: staleDraftBatchNoProposalIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // No Proposal for this batch.

  // This batch will become stale when the config transaction is executed.
  //endregion

  //region Stale batch with Approved proposal
  // Create a batch (Stale and Approved).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: staleApprovedBatchIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a draft proposal for the batch (Stale and Approved).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: staleApprovedBatchIndex,
    creator: members.proposer,
    isDraft: true,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add first transaction to the batch (Stale and Approved).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: staleApprovedBatchIndex,
    vaultIndex: 0,
    transactionIndex: 1,
    transactionMessage: testMessage1,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add second transaction to the batch (Stale and Approved).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: staleApprovedBatchIndex,
    vaultIndex: 0,
    transactionIndex: 2,
    transactionMessage: testMessage2,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Activate the proposal (Stale and Approved).
  signature = await multisig.rpc.proposalActivate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: staleApprovedBatchIndex,
    member: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Approve the proposal (Stale and Approved).
  signature = await multisig.rpc.proposalApprove({
    connection,
    feePayer: members.voter,
    multisigPda,
    transactionIndex: staleApprovedBatchIndex,
    member: members.voter,
    programId,
  });
  await connection.confirmTransaction(signature);
  signature = await multisig.rpc.proposalApprove({
    connection,
    feePayer: members.almighty,
    multisigPda,
    transactionIndex: staleApprovedBatchIndex,
    member: members.almighty,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Execute the first batch transaction proposal (Stale and Approved).
  signature = await multisig.rpc.batchExecuteTransaction({
    connection,
    feePayer: members.executor,
    multisigPda,
    batchIndex: staleApprovedBatchIndex,
    transactionIndex: 1,
    member: members.executor,
    programId,
  });
  await connection.confirmTransaction(signature);
  // This proposal will become stale when the config transaction is executed.
  //endregion

  //region Executed Config Transaction
  // Create a vault transaction (Executed).
  signature = await multisig.rpc.configTransactionCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: executedConfigTransactionIndex,
    creator: members.proposer.publicKey,
    actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a proposal for the transaction (Executed).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: executedConfigTransactionIndex,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Approve the proposal by the first member.
  signature = await multisig.rpc.proposalApprove({
    connection,
    feePayer: members.voter,
    multisigPda,
    transactionIndex: executedConfigTransactionIndex,
    member: members.voter,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Approve the proposal by the second member.
  signature = await multisig.rpc.proposalApprove({
    connection,
    feePayer: members.almighty,
    multisigPda,
    transactionIndex: executedConfigTransactionIndex,
    member: members.almighty,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Execute the transaction.
  signature = await multisig.rpc.configTransactionExecute({
    connection,
    feePayer: members.almighty,
    multisigPda,
    transactionIndex: executedConfigTransactionIndex,
    member: members.almighty,
    rentPayer: members.almighty,
    programId,
  });
  await connection.confirmTransaction(signature);
  //endregion

  //region batch with Executed proposal (all batch tx are executed)
  // Create a batch (Executed).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: executedBatchIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a draft proposal for the batch (Executed).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: executedBatchIndex,
    creator: members.proposer,
    isDraft: true,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add first transaction to the batch (Executed).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: executedBatchIndex,
    vaultIndex: 0,
    transactionIndex: 1,
    transactionMessage: testMessage1,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add second transaction to the batch (Executed).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: executedBatchIndex,
    vaultIndex: 0,
    transactionIndex: 2,
    transactionMessage: testMessage2,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Activate the proposal (Executed).
  signature = await multisig.rpc.proposalActivate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: executedBatchIndex,
    member: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Approve the proposal (Executed).
  signature = await multisig.rpc.proposalApprove({
    connection,
    feePayer: members.voter,
    multisigPda,
    transactionIndex: executedBatchIndex,
    member: members.voter,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Execute the first batch transaction proposal (Executed).
  signature = await multisig.rpc.batchExecuteTransaction({
    connection,
    feePayer: members.executor,
    multisigPda,
    batchIndex: executedBatchIndex,
    transactionIndex: 1,
    member: members.executor,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Execute the second batch transaction proposal (Executed).
  signature = await multisig.rpc.batchExecuteTransaction({
    connection,
    feePayer: members.executor,
    multisigPda,
    batchIndex: executedBatchIndex,
    transactionIndex: 2,
    member: members.executor,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Make sure the proposal is executed.
  let proposalAccount = await Proposal.fromAccountAddress(
    connection,
    multisig.getProposalPda({
      multisigPda,
      transactionIndex: executedBatchIndex,
      programId,
    })[0]
  );
  assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));
  //endregion

  //region batch with Active proposal
  // Create a batch (Active).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: activeBatchIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a draft proposal for the batch (Active).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: activeBatchIndex,
    creator: members.proposer,
    isDraft: true,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add a transaction to the batch (Active).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: activeBatchIndex,
    vaultIndex: 0,
    transactionIndex: 1,
    transactionMessage: testMessage1,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Activate the proposal (Active).
  signature = await multisig.rpc.proposalActivate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: activeBatchIndex,
    member: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Make sure the proposal is Active.
  proposalAccount = await Proposal.fromAccountAddress(
    connection,
    multisig.getProposalPda({
      multisigPda,
      transactionIndex: activeBatchIndex,
      programId,
    })[0]
  );
  assert.ok(multisig.types.isProposalStatusActive(proposalAccount.status));
  //endregion

  //region batch with Approved proposal
  // Create a batch (Approved).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: approvedBatchIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a draft proposal for the batch (Approved).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: approvedBatchIndex,
    creator: members.proposer,
    isDraft: true,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add first transaction to the batch (Approved).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: approvedBatchIndex,
    vaultIndex: 0,
    transactionIndex: 1,
    transactionMessage: testMessage1,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add second transaction to the batch (Approved).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: approvedBatchIndex,
    vaultIndex: 0,
    transactionIndex: 2,
    transactionMessage: testMessage2,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Activate the proposal (Approved).
  signature = await multisig.rpc.proposalActivate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: approvedBatchIndex,
    member: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Approve the proposal (Approved).
  signature = await multisig.rpc.proposalApprove({
    connection,
    feePayer: members.voter,
    multisigPda,
    transactionIndex: approvedBatchIndex,
    member: members.voter,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Make sure the proposal is Approved.
  proposalAccount = await Proposal.fromAccountAddress(
    connection,
    multisig.getProposalPda({
      multisigPda,
      transactionIndex: approvedBatchIndex,
      programId,
    })[0]
  );
  assert.ok(multisig.types.isProposalStatusApproved(proposalAccount.status));

  // Execute first batch transaction (Approved).
  signature = await multisig.rpc.batchExecuteTransaction({
    connection,
    feePayer: members.executor,
    multisigPda,
    batchIndex: approvedBatchIndex,
    transactionIndex: 1,
    member: members.executor,
    programId,
  });
  await connection.confirmTransaction(signature);
  //endregion

  //region batch with Rejected proposal
  // Create a batch (Rejected).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: rejectedBatchIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a draft proposal for the batch (Rejected).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: rejectedBatchIndex,
    creator: members.proposer,
    isDraft: true,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add a transaction to the batch (Rejected).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: rejectedBatchIndex,
    vaultIndex: 0,
    transactionIndex: 1,
    transactionMessage: testMessage1,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Activate the proposal (Rejected).
  signature = await multisig.rpc.proposalActivate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: rejectedBatchIndex,
    member: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Reject the proposal (Rejected).
  signature = await multisig.rpc.proposalReject({
    connection,
    feePayer: members.voter,
    multisigPda,
    transactionIndex: rejectedBatchIndex,
    member: members.voter,
    programId,
  });
  await connection.confirmTransaction(signature);
  signature = await multisig.rpc.proposalReject({
    connection,
    feePayer: members.almighty,
    multisigPda,
    transactionIndex: rejectedBatchIndex,
    member: members.almighty,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Make sure the proposal is Rejected.
  proposalAccount = await Proposal.fromAccountAddress(
    connection,
    multisig.getProposalPda({
      multisigPda,
      transactionIndex: rejectedBatchIndex,
      programId,
    })[0]
  );
  assert.ok(multisig.types.isProposalStatusRejected(proposalAccount.status));
  //endregion

  //region batch with Cancelled proposal
  // Create a batch (Cancelled).
  signature = await multisig.rpc.batchCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: cancelledBatchIndex,
    vaultIndex: 0,
    creator: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Create a draft proposal for the batch (Cancelled).
  signature = await multisig.rpc.proposalCreate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: cancelledBatchIndex,
    creator: members.proposer,
    isDraft: true,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Add a transaction to the batch (Cancelled).
  signature = await multisig.rpc.batchAddTransaction({
    connection,
    feePayer: members.proposer,
    multisigPda,
    batchIndex: cancelledBatchIndex,
    vaultIndex: 0,
    transactionIndex: 1,
    transactionMessage: testMessage1,
    member: members.proposer,
    ephemeralSigners: 0,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Activate the proposal (Cancelled).
  signature = await multisig.rpc.proposalActivate({
    connection,
    feePayer: members.proposer,
    multisigPda,
    transactionIndex: cancelledBatchIndex,
    member: members.proposer,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Approve the proposal (Cancelled).
  signature = await multisig.rpc.proposalApprove({
    connection,
    feePayer: members.voter,
    multisigPda,
    transactionIndex: cancelledBatchIndex,
    member: members.voter,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Cancel the proposal (Cancelled).
  signature = await multisig.rpc.proposalCancel({
    connection,
    feePayer: members.almighty,
    multisigPda,
    transactionIndex: cancelledBatchIndex,
    member: members.almighty,
    programId,
  });
  await connection.confirmTransaction(signature);

  // Make sure the proposal is Cancelled.
  proposalAccount = await Proposal.fromAccountAddress(
    connection,
    multisig.getProposalPda({
      multisigPda,
      transactionIndex: cancelledBatchIndex,
      programId,
    })[0]
  );
  assert.ok(multisig.types.isProposalStatusCancelled(proposalAccount.status));
  //endregion

  return {
    multisigPda,
    staleDraftBatchIndex,
    staleDraftBatchNoProposalIndex,
    staleApprovedBatchIndex,
    executedConfigTransactionIndex,
    executedBatchIndex,
    activeBatchIndex,
    approvedBatchIndex,
    rejectedBatchIndex,
    cancelledBatchIndex,
  };
}

export function createTestTransferInstruction(
  authority: PublicKey,
  recipient: PublicKey,
  amount = 1000000
) {
  return SystemProgram.transfer({
    fromPubkey: authority,
    lamports: amount,
    toPubkey: recipient,
  });
}

/** Returns true if the given unix epoch is within a couple of seconds of now. */
export function isCloseToNow(
  unixEpoch: number | bigint,
  timeWindow: number = 2000
) {
  const timestamp = Number(unixEpoch) * 1000;
  return Math.abs(timestamp - Date.now()) < timeWindow;
}

/** Returns an array of numbers from min to max (inclusive) with the given step. */
export function range(min: number, max: number, step: number = 1) {
  const result = [];
  for (let i = min; i <= max; i += step) {
    result.push(i);
  }
  return result;
}

export function comparePubkeys(a: PublicKey, b: PublicKey) {
  return a.toBuffer().compare(b.toBuffer());
}

export async function processBufferInChunks(
  member: Keypair,
  multisigPda: PublicKey,
  bufferAccount: PublicKey,
  buffer: Uint8Array,
  connection: Connection,
  programId: PublicKey,
  chunkSize: number = 700,
  startIndex: number = 0
) {
  const processChunk = async (startIndex: number) => {
    if (startIndex >= buffer.length) {
      return;
    }

    const chunk = buffer.slice(startIndex, startIndex + chunkSize);

    const ix = multisig.generated.createTransactionBufferExtendInstruction(
      {
        multisig: multisigPda,
        transactionBuffer: bufferAccount,
        creator: member.publicKey,
      },
      {
        args: {
          buffer: chunk,
        },
      },
      programId
    );

    const message = new TransactionMessage({
      payerKey: member.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);

    tx.sign([member]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
    });

    await connection.confirmTransaction(signature);

    // Move to next chunk
    await processChunk(startIndex + chunkSize);
  };

  await processChunk(startIndex);
}