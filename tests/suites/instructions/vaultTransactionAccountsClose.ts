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
  createAutonomousMultisig,
  createAutonomousMultisigV2,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";

const { Multisig, Proposal } = multisig.accounts;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / vault_transaction_accounts_close", () => {
  let members: TestMembers;
  let multisigPda: PublicKey;
  const staleNonApprovedTransactionIndex = 1n;
  const staleNoProposalTransactionIndex = 2n;
  const staleApprovedTransactionIndex = 3n;
  const executedConfigTransactionIndex = 4n;
  const executedVaultTransactionIndex = 5n;
  const activeTransactionIndex = 6n;
  const approvedTransactionIndex = 7n;
  const rejectedTransactionIndex = 8n;
  const cancelledTransactionIndex = 9n;

  // Set up a multisig with some transactions.
  before(async () => {
    members = await generateMultisigMembers(connection);

    const createKey = Keypair.generate();
    multisigPda = multisig.getMultisigPda({
      createKey: createKey.publicKey,
      programId,
    })[0];
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    // Create new autonomous multisig with rentCollector set to its default vault.
    await createAutonomousMultisigV2({
      connection,
      createKey,
      members,
      threshold: 2,
      timeLock: 0,
      rentCollector: vaultPda,
      programId,
    });

    // Test transfer instruction.
    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Airdrop some SOL to the vault
    let signature = await connection.requestAirdrop(
      vaultPda,
      10 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);

    //region Stale and Non-Approved
    // Create a vault transaction (Stale and Non-Approved).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: staleNonApprovedTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Stale and Non-Approved).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: staleNonApprovedTransactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);
    // This transaction will become stale when the config transaction is executed.
    //endregion

    //region Stale and No Proposal
    // Create a vault transaction (Stale and Non-Approved).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: staleNoProposalTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // No proposal created for this transaction.

    // This transaction will become stale when the config transaction is executed.
    //endregion

    //region Stale and Approved
    // Create a vault transaction (Stale and Approved).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: staleApprovedTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Stale and Approved).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: staleApprovedTransactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve the proposal by the first member.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex: staleApprovedTransactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve the proposal by the second member.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex: staleApprovedTransactionIndex,
      member: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Make sure the proposal is approved.
    let proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex: staleApprovedTransactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusApproved(proposalAccount.status));

    // This transaction will become stale when the config transaction is executed.
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

    //region Executed Vault transaction
    // Create a vault transaction (Executed).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: executedVaultTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Approved).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: executedVaultTransactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve the proposal.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex: executedVaultTransactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Execute the transaction.
    signature = await multisig.rpc.vaultTransactionExecute({
      connection,
      feePayer: members.executor,
      multisigPda,
      transactionIndex: executedVaultTransactionIndex,
      member: members.executor.publicKey,
      signers: [members.executor],
      programId,
    });
    await connection.confirmTransaction(signature);

    // Make sure the proposal is executed.
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex: executedVaultTransactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));
    //endregion

    //region Active
    // Create a vault transaction (Active).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: activeTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Active).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: activeTransactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Make sure the proposal is active.
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex: activeTransactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusActive(proposalAccount.status));
    //endregion

    //region Approved
    // Create a vault transaction (Approved).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: approvedTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Approved).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: approvedTransactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve the proposal.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex: approvedTransactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Make sure the proposal is approved.
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex: approvedTransactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusApproved(proposalAccount.status));
    //endregion

    //region Rejected
    // Create a vault transaction (Rejected).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: rejectedTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Rejected).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: rejectedTransactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Our threshold is 1, and 2 voters, so the cutoff is 2...

    // Reject the proposal by the first member.
    signature = await multisig.rpc.proposalReject({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex: rejectedTransactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Reject the proposal by the second member.
    signature = await multisig.rpc.proposalReject({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex: rejectedTransactionIndex,
      member: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Make sure the proposal is rejected.
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex: rejectedTransactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusRejected(proposalAccount.status));
    //endregion

    //region Cancelled
    // Create a vault transaction (Cancelled).
    signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: cancelledTransactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Create a proposal for the transaction (Cancelled).
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: cancelledTransactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Approve the proposal.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex: cancelledTransactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Cancel the proposal (The proposal should be approved at this point).
    signature = await multisig.rpc.proposalCancel({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex: cancelledTransactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Make sure the proposal is cancelled.
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex: cancelledTransactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusCancelled(proposalAccount.status));
    //endregion
  });

  it("error: rent reclamation is not enabled", async () => {
    // Create a multisig with rent reclamation disabled.
    const multisigPda = (
      await createAutonomousMultisigV2({
        connection,
        members,
        threshold: 1,
        timeLock: 0,
        rentCollector: null,
        programId,
      })
    )[0];

    const vaultPda = multisig.getVaultPda({
      multisigPda: multisigPda,
      index: 0,
      programId,
    })[0];

    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Create a vault transaction.
    const transactionIndex = 1n;
    let signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
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

    // Approve the proposal by a member.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Cancel the proposal.
    signature = await multisig.rpc.proposalCancel({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Attempt to close the accounts.
    await assert.rejects(
      () =>
        multisig.rpc.vaultTransactionAccountsClose({
          connection,
          feePayer: members.almighty,
          multisigPda,
          rentCollector: Keypair.generate().publicKey,
          transactionIndex,
          programId,
        }),
      /RentReclamationDisabled: Rent reclamation is disabled for this multisig/
    );
  });

  it("error: invalid rent_collector", async () => {
    const transactionIndex = staleApprovedTransactionIndex;

    const fakeRentCollector = Keypair.generate().publicKey;

    await assert.rejects(
      () =>
        multisig.rpc.vaultTransactionAccountsClose({
          connection,
          feePayer: members.almighty,
          multisigPda,
          rentCollector: fakeRentCollector,
          transactionIndex,
          programId,
        }),
      /Invalid rent collector address/
    );
  });

  it("error: proposal is for another multisig", async () => {
    const vaultPda = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    })[0];

    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Create another multisig.
    const otherMultisig = (
      await createAutonomousMultisig({
        connection,
        members,
        threshold: 2,
        timeLock: 0,
        programId,
      })
    )[0];
    // Create a vault transaction for it.
    let signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda: otherMultisig,
      transactionIndex: 1n,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);
    // Create a proposal for it.
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda: otherMultisig,
      transactionIndex: 1n,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Manually construct an instruction that uses the proposal account from the other multisig.
    const ix =
      multisig.generated.createVaultTransactionAccountsCloseInstruction(
        {
          multisig: multisigPda,
          rentCollector: vaultPda,
          proposal: multisig.getProposalPda({
            multisigPda: otherMultisig,
            transactionIndex: 1n,
            programId,
          })[0],
          transaction: multisig.getTransactionPda({
            multisigPda: otherMultisig,
            index: 1n,
            programId,
          })[0],
        },
        programId
      );

    const feePayer = await generateFundedKeypair(connection);

    const message = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([feePayer]);

    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /A seeds constraint was violated/
    );
  });

  it("error: invalid proposal status (Active)", async () => {
    const transactionIndex = activeTransactionIndex;

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    await assert.rejects(
      () =>
        multisig.rpc.vaultTransactionAccountsClose({
          connection,
          feePayer: members.almighty,
          multisigPda,
          rentCollector: multisigAccount.rentCollector!,
          transactionIndex,
          programId,
        }),
      /Invalid proposal status/
    );
  });

  it("error: invalid proposal status (Approved)", async () => {
    const transactionIndex = approvedTransactionIndex;

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    await assert.rejects(
      () =>
        multisig.rpc.vaultTransactionAccountsClose({
          connection,
          feePayer: members.almighty,
          multisigPda,
          rentCollector: multisigAccount.rentCollector!,
          transactionIndex,
          programId,
        }),
      /Invalid proposal status/
    );
  });

  it("error: invalid proposal status (Stale but Approved)", async () => {
    const transactionIndex = staleApprovedTransactionIndex;

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    // Make sure the proposal is stale.
    assert.ok(
      transactionIndex <=
        multisig.utils.toBigInt(multisigAccount.staleTransactionIndex)
    );

    await assert.rejects(
      () =>
        multisig.rpc.vaultTransactionAccountsClose({
          connection,
          feePayer: members.almighty,
          multisigPda,
          rentCollector: multisigAccount.rentCollector!,
          transactionIndex,
          programId,
        }),
      /Invalid proposal status/
    );
  });

  it("error: transaction is for another multisig", async () => {
    // Create another multisig.
    const otherMultisig = (
      await createAutonomousMultisig({
        connection,
        members,
        threshold: 2,
        timeLock: 0,
        programId,
      })
    )[0];

    // Create a vault transaction for it.
    const vaultPda = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    })[0];
    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });
    let signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda: otherMultisig,
      transactionIndex: 1n,
      vaultIndex: 0,
      transactionMessage: testTransferMessage,
      ephemeralSigners: 0,
      addressLookupTableAccounts: [],
      creator: members.proposer.publicKey,
      programId,
    });
    await connection.confirmTransaction(signature);
    // Create a proposal for it.
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda: otherMultisig,
      transactionIndex: 1n,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);

    const feePayer = await generateFundedKeypair(connection);

    // Manually construct an instruction that uses transaction that doesn't match proposal.
    const ix =
      multisig.generated.createVaultTransactionAccountsCloseInstruction(
        {
          multisig: multisigPda,
          rentCollector: vaultPda,
          proposal: multisig.getProposalPda({
            multisigPda,
            transactionIndex: 1n,
            programId,
          })[0],
          transaction: multisig.getTransactionPda({
            multisigPda: otherMultisig,
            index: 1n,
            programId,
          })[0],
        },
        programId
      );

    const message = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([feePayer]);

    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /Transaction is for another multisig/
    );
  });

  it("error: transaction doesn't match proposal", async () => {
    const feePayer = await generateFundedKeypair(connection);

    const vaultPda = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    })[0];

    // Manually construct an instruction that uses transaction that doesn't match proposal.
    const ix =
      multisig.generated.createVaultTransactionAccountsCloseInstruction(
        {
          multisig: multisigPda,
          rentCollector: vaultPda,
          proposal: multisig.getProposalPda({
            multisigPda,
            transactionIndex: rejectedTransactionIndex,
            programId,
          })[0],
          transaction: multisig.getTransactionPda({
            multisigPda,
            // Wrong transaction index.
            index: approvedTransactionIndex,
            programId,
          })[0],
        },
        programId
      );

    const message = new TransactionMessage({
      payerKey: feePayer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([feePayer]);

    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /A seeds constraint was violated/
    );
  });

  it("close accounts for Stale transaction", async () => {
    // Close the accounts for the Approved transaction.
    const transactionIndex = staleNonApprovedTransactionIndex;

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    // Make sure the proposal is still active.
    let proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusActive(proposalAccount.status));

    // Make sure the proposal is stale.
    assert.ok(
      proposalAccount.transactionIndex <= multisigAccount.staleTransactionIndex
    );

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    const preBalance = await connection.getBalance(vaultPda);

    const sig = await multisig.rpc.vaultTransactionAccountsClose({
      connection,
      feePayer: members.almighty,
      multisigPda,
      rentCollector: vaultPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(sig);

    const postBalance = await connection.getBalance(vaultPda);
    const accountsRent = 6479760;
    assert.equal(postBalance, preBalance + accountsRent);
  });

  it("close accounts for Stale transaction with No Proposal", async () => {
    const transactionIndex = staleNoProposalTransactionIndex;

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    // Make sure there's no proposal.
    let proposalAccount = await connection.getAccountInfo(
      multisig.getProposalPda({
        multisigPda,
        transactionIndex,
        programId,
      })[0]
    );
    assert.equal(proposalAccount, null);

    // Make sure the transaction is stale.
    assert.ok(
      transactionIndex <=
        multisig.utils.toBigInt(multisigAccount.staleTransactionIndex)
    );

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    const preBalance = await connection.getBalance(vaultPda);

    const sig = await multisig.rpc.vaultTransactionAccountsClose({
      connection,
      feePayer: members.almighty,
      multisigPda,
      rentCollector: vaultPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(sig);

    const postBalance = await connection.getBalance(vaultPda);
    const accountsRent = 2_429_040; // Rent for the transaction account.
    assert.equal(postBalance, preBalance + accountsRent);
  });

  it("close accounts for Executed transaction", async () => {
    const transactionIndex = executedVaultTransactionIndex;

    // Make sure the proposal is Executed.
    let proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    const preBalance = await connection.getBalance(vaultPda);

    const sig = await multisig.rpc.vaultTransactionAccountsClose({
      connection,
      feePayer: members.almighty,
      multisigPda,
      rentCollector: vaultPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(sig);

    const postBalance = await connection.getBalance(vaultPda);
    const accountsRent = 6479760;
    assert.equal(postBalance, preBalance + accountsRent);
  });

  it("close accounts for Rejected transaction", async () => {
    const transactionIndex = rejectedTransactionIndex;

    // Make sure the proposal is Rejected.
    let proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusRejected(proposalAccount.status));

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    const preBalance = await connection.getBalance(vaultPda);

    const sig = await multisig.rpc.vaultTransactionAccountsClose({
      connection,
      feePayer: members.almighty,
      multisigPda,
      rentCollector: vaultPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(sig);

    const postBalance = await connection.getBalance(vaultPda);
    const accountsRent = 6479760;
    assert.equal(postBalance, preBalance + accountsRent);
  });

  it("close accounts for Cancelled transaction", async () => {
    const transactionIndex = cancelledTransactionIndex;

    // Make sure the proposal is Cancelled.
    let proposalAccount = await Proposal.fromAccountAddress(
      connection,
      multisig.getProposalPda({
        multisigPda,
        transactionIndex,
        programId,
      })[0]
    );
    assert.ok(multisig.types.isProposalStatusCancelled(proposalAccount.status));

    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    const preBalance = await connection.getBalance(vaultPda);

    const sig = await multisig.rpc.vaultTransactionAccountsClose({
      connection,
      feePayer: members.almighty,
      multisigPda,
      rentCollector: vaultPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(sig);

    const postBalance = await connection.getBalance(vaultPda);
    const accountsRent = 6479760;
    assert.equal(postBalance, preBalance + accountsRent);
  });
});
