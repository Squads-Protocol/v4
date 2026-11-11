import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import assert from "assert";
import {
  createAutonomousMultisigV2,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";

const { Proposal } = multisig.accounts;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

const accountNotInitialized =
  /AccountNotInitialized|expected this account to be already initialized|0xbc4/;

// Finding F1 in tla/README.md: these tests record the current behavior.
// Change them when F1 is fixed.
describe("Instructions / proposal_create after transaction close (TLA+ F1)", () => {
  let members: TestMembers;
  let multisigPda: PublicKey;
  let vaultPda: PublicKey;
  const transactionIndex = 1n;

  before(async () => {
    members = await generateMultisigMembers(connection);

    const createKey = Keypair.generate();
    multisigPda = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    })[0];
    [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0, programId });

    // Voters: almighty and voter. Threshold 2, so cutoff = 2 - 2 + 1 = 1.
    await createAutonomousMultisigV2({
      connection,
      createKey,
      members,
      threshold: 2,
      timeLock: 0,
      rentCollector: vaultPda,
      programId,
    });

    const signature = await connection.requestAirdrop(
      vaultPda,
      2 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
  });

  it("creates a proposal again for a closed Rejected transaction", async () => {
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
      programId,
    });
    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
      programId,
    });

    const testIx = await createTestTransferInstruction(
      vaultPda,
      Keypair.generate().publicKey,
      1 * LAMPORTS_PER_SOL
    );
    let signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      vaultIndex: 0,
      transactionMessage: new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        instructions: [testIx],
      }),
      ephemeralSigners: 0,
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // One rejection reaches the cutoff.
    signature = await multisig.rpc.proposalReject({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);
    let proposal = await Proposal.fromAccountAddress(connection, proposalPda);
    assert.ok(multisig.types.isProposalStatusRejected(proposal.status));

    // Rent reclaim closes the transaction and the proposal together.
    signature = await multisig.rpc.vaultTransactionAccountsClose({
      connection,
      feePayer: members.almighty,
      multisigPda,
      rentCollector: vaultPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(signature);
    assert.equal(await connection.getAccountInfo(transactionPda), null);
    assert.equal(await connection.getAccountInfo(proposalPda), null);

    // The same index accepts a new proposal, with no transaction account behind it.
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);
    proposal = await Proposal.fromAccountAddress(connection, proposalPda);
    assert.ok(multisig.types.isProposalStatusActive(proposal.status));
    assert.equal(
      multisig.utils.toBigInt(proposal.transactionIndex),
      transactionIndex
    );
    assert.equal(await connection.getAccountInfo(transactionPda), null);

    for (const member of [members.voter, members.almighty]) {
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: member,
        multisigPda,
        transactionIndex,
        member,
        programId,
      });
      await connection.confirmTransaction(signature);
    }
    proposal = await Proposal.fromAccountAddress(connection, proposalPda);
    assert.ok(multisig.types.isProposalStatusApproved(proposal.status));
  });

  it("cannot execute the new proposal", async () => {
    // The SDK helper reads the closed transaction account, so build the instruction here.
    const ix = multisig.generated.createVaultTransactionExecuteInstruction(
      {
        multisig: multisigPda,
        proposal: multisig.getProposalPda({
          multisigPda,
          transactionIndex,
          programId,
        })[0],
        transaction: multisig.getTransactionPda({
          multisigPda,
          index: transactionIndex,
          programId,
        })[0],
        member: members.executor.publicKey,
      },
      programId
    );
    const message = new TransactionMessage({
      payerKey: members.executor.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([members.executor]);

    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      accountNotInitialized
    );
  });

  it("cannot close the new proposal, so it stays Approved", async () => {
    await assert.rejects(
      () =>
        multisig.rpc.vaultTransactionAccountsClose({
          connection,
          feePayer: members.almighty,
          multisigPda,
          rentCollector: vaultPda,
          transactionIndex,
          programId,
        }),
      accountNotInitialized
    );

    const proposal = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({ multisigPda, transactionIndex, programId })[0]
    );
    assert.ok(multisig.types.isProposalStatusApproved(proposal.status));
  });
});
