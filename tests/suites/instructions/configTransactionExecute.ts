import * as multisig from "@sqds/multisig";
import assert from "assert";
import {
  createAutonomousMultisig,
  createLocalhostConnection,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";

const { Multisig, Proposal } = multisig.accounts;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / config_transaction_execute", () => {
  let members: TestMembers;

  before(async () => {
    members = await generateMultisigMembers(connection);
  });

  it("error: invalid proposal status (Rejected)", async () => {
    // Create new autonomous multisig.
    const multisigPda = (
      await createAutonomousMultisig({
        connection,
        members,
        threshold: 2,
        timeLock: 0,
        rentCollector: null,
        programId,
      })
    )[0];

    // Create a config transaction.
    const transactionIndex = 1n;
    let signature = await multisig.rpc.configTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer.publicKey,
      actions: [{ __kind: "ChangeThreshold", newThreshold: 3 }],
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction.
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Reject the proposal by a member.
    // Our threshold is 2 out of 2 voting members, so the cutoff is 1.
    signature = await multisig.rpc.proposalReject({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Attempt to execute a transaction with a rejected proposal.
    await assert.rejects(
      () =>
        multisig.rpc.configTransactionExecute({
          connection,
          feePayer: members.almighty,
          multisigPda,
          transactionIndex,
          rentPayer: members.almighty,
          member: members.almighty,
          programId,
        }),
      /Invalid proposal status/
    );
  });

  it("execute config transaction with ChangeThreshold action", async () => {
    // Create new autonomous multisig.
    const multisigPda = (
      await createAutonomousMultisig({
        connection,
        members,
        threshold: 1,
        timeLock: 0,
        rentCollector: null,
        programId,
      })
    )[0];

    // Create a config transaction.
    const transactionIndex = 1n;
    let signature = await multisig.rpc.configTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer.publicKey,
      actions: [{ __kind: "ChangeThreshold", newThreshold: 1 }],
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction.
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve the proposal.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Execute the approved config transaction.
    signature = await multisig.rpc.configTransactionExecute({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      member: members.almighty,
      rentPayer: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Verify the proposal account.
    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
      programId,
    });
    const proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));

    // Verify the multisig account.
    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    // The threshold should have been updated.
    assert.strictEqual(multisigAccount.threshold, 1);
    // The stale transaction index should be updated and set to 1.
    assert.strictEqual(multisigAccount.staleTransactionIndex.toString(), "1");
  });

  it("execute config transaction with SetRentCollector action", async () => {
    // Create new autonomous multisig without rent_collector.
    const multisigPda = (
      await createAutonomousMultisig({
        connection,
        members,
        threshold: 1,
        timeLock: 0,
        rentCollector: null,
        programId,
      })
    )[0];

    const multisigAccountInfoPreExecution = await connection.getAccountInfo(
      multisigPda
    )!;

    const vaultPda = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    })[0];

    // Create a config transaction.
    const transactionIndex = 1n;
    let signature = await multisig.rpc.configTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer.publicKey,
      actions: [{ __kind: "SetRentCollector", newRentCollector: vaultPda }],
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Approved).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve the proposal.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Execute the approved config transaction.
    signature = await multisig.rpc.configTransactionExecute({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      member: members.almighty,
      rentPayer: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Verify the proposal account.
    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
      programId,
    });
    const proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));

    // Verify the multisig account.
    const multisigAccountInfoPostExecution = await connection.getAccountInfo(
      multisigPda
    );
    const [multisigAccountPostExecution] = Multisig.fromAccountInfo(
      multisigAccountInfoPostExecution!
    );
    // The rentCollector should be updated.
    assert.strictEqual(
      multisigAccountPostExecution.rentCollector?.toBase58(),
      vaultPda.toBase58()
    );
    // The stale transaction index should NOT be updated and remain 0.
    assert.strictEqual(
      multisigAccountPostExecution.staleTransactionIndex.toString(),
      "0"
    );
    // multisig space should be reallocated: increased by at least 32 bytes of new rent_collector.
    assert.ok(
      multisigAccountInfoPostExecution!.data.length >=
        multisigAccountInfoPreExecution!.data.length + 32
    );
  });
});
