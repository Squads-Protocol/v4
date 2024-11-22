import * as multisig from "@sqds/multisig";
import assert from "assert";
import {
  createAutonomousMultisig,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, TransactionMessage } from "@solana/web3.js";

const { Multisig, Proposal } = multisig.accounts;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / proposal_cancel_v2", () => {
  let members: TestMembers;
  let multisigPda: PublicKey;
  let newVotingMember = new Keypair();
  let newVotingMember2 = new Keypair();
  let newVotingMember3 = new Keypair();
  let newVotingMember4 = new Keypair();
  let addMemberCollection = [
    {key: newVotingMember.publicKey, permissions: multisig.types.Permissions.all()},
    {key: newVotingMember2.publicKey, permissions: multisig.types.Permissions.all()},
    {key: newVotingMember3.publicKey, permissions: multisig.types.Permissions.all()},
    {key: newVotingMember4.publicKey, permissions: multisig.types.Permissions.all()},
  ];
  let cancelVotesCollection = [
    newVotingMember,
    newVotingMember2,
    newVotingMember3,
    newVotingMember4,
  ];
  let originalCancel: Keypair;

  before(async () => {
    members = await generateMultisigMembers(connection);
    // Create new autonomous multisig.
    multisigPda = (
        await createAutonomousMultisig({
            connection,
            members,
            threshold: 2,
            timeLock: 0,
            programId,
        })
        )[0];
    
  });

  // multisig current has a threhsold of 2 with two voting members.
  // create a proposal to add a member to the multisig (which we will cancel)
  // the proposal size will be allocated to TOTAL members length
  it("cancel basic config tx proposal", async () => {
    // Create a config transaction.
    const transactionIndex = 1n;
    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
      programId,
    });

    let signature = await multisig.rpc.configTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer.publicKey,
      actions: [{ __kind: "AddMember", newMember: {key: newVotingMember.publicKey, permissions: multisig.types.Permissions.all()} }],
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

    // Proposal status must be "Cancelled".
    let proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );

    // Approve the proposal 1.
    signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
        programId,
      });
      await connection.confirmTransaction(signature);
  
    // Approve the proposal 2.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      member: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Proposal is now ready to execute, cast the 2 cancels using the new functionality.
    signature = await multisig.rpc.proposalCancelV2({
      connection,
      feePayer: members.voter,
      member: members.voter,
      multisigPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Proposal is now ready to execute, cast the 2 cancels using the new functionality.
    signature = await multisig.rpc.proposalCancelV2({
      connection,
      feePayer: members.almighty,
      member: members.almighty,
      multisigPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Proposal status must be "Cancelled".
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.ok(multisig.types.isProposalStatusCancelled(proposalAccount.status));
  });

  // in order to test this, we create a basic transfer transaction
  // then we vote to approve it
  // then we cast 1 cancel vote
  // then we change the state of the multisig so the new amount of voting members is greater than the last total size
  // then we change the threshold to be greater than the last total size
  // then we change the state of the multisig so that one original cancel voter is removed
  // then we vote to cancel (and be able to close the transfer transaction)
  it("cancel tx with stale state size", async () => {
    // Create a config transaction.
    let transactionIndex = 2n;
    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
      programId,
    });

    // Default vault.
    const [vaultPda, vaultBump] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });
    const testPayee = Keypair.generate();
    const testIx1 = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx1],
    });

    let signature = await multisig.rpc.vaultTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer.publicKey,
      vaultIndex: 0,
      ephemeralSigners: 0,
      transactionMessage: testTransferMessage,
      memo: "Transfer 1 SOL to a test account",
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

    // Approve the proposal 1.
    signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.voter,
        multisigPda,
        transactionIndex,
        member: members.voter,
        programId,
      });
      await connection.confirmTransaction(signature);
  
    // Approve the proposal 2.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      member: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Proposal status must be "Approved".
    let proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.ok(multisig.types.isProposalStatusApproved(proposalAccount.status));
    // check the account size


    // TX/Proposal is now in an approved/ready state. 
    // Now cancel vec has enough room for 4 votes.

    // Cast the 1 cancel using the new functionality and the 'voter' member.
    signature = await multisig.rpc.proposalCancelV2({
      connection,
      feePayer: members.voter,
      member: members.voter,
      multisigPda,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(signature);
    // set the original cancel voter
    originalCancel = members.voter;

    // ensure that the account size has not changed yet

    // Change the multisig state to have 5 voting members.
    // loop through the process to add the 4 members
    for (let i = 0; i < addMemberCollection.length; i++) {
      const newMember = addMemberCollection[i];
      transactionIndex++;
      signature = await multisig.rpc.configTransactionCreate({
        connection,
        feePayer: members.proposer,
        multisigPda,
        transactionIndex,
        creator: members.proposer.publicKey,
        actions: [{ __kind: "AddMember", newMember }],
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
  
      // Proposal status must be "Cancelled".
      proposalAccount = await Proposal.fromAccountAddress(
        connection,
        proposalPda
      );
  
      // Approve the proposal 1.
      signature = await multisig.rpc.proposalApprove({
          connection,
          feePayer: members.voter,
          multisigPda,
          transactionIndex,
          member: members.voter,
          programId,
        });
        await connection.confirmTransaction(signature);
    
      // Approve the proposal 2.
      signature = await multisig.rpc.proposalApprove({
        connection,
        feePayer: members.almighty,
        multisigPda,
        transactionIndex,
        member: members.almighty,
        programId,
      });
      await connection.confirmTransaction(signature);

      // use the execute only member to execute
      signature = await multisig.rpc.configTransactionExecute({
        connection,
        feePayer: members.executor,
        multisigPda,
        transactionIndex,
        member: members.executor,
        rentPayer: members.executor,
        programId,
      });
      await connection.confirmTransaction(signature);
      
    }

    // assert that our member length is now 8
    let multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    assert.strictEqual(multisigAccount.members.length, 8);

    transactionIndex++;
    // now remove the original cancel voter
    signature = await multisig.rpc.configTransactionCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer.publicKey,
      actions: [{ __kind: "RemoveMember", oldMember: originalCancel.publicKey }, { __kind: "ChangeThreshold", newThreshold: 5 }],
      programId,
    });
    await connection.confirmTransaction(signature);
    // create the remove proposal
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex,
      creator: members.proposer,
      programId,
    });
    await connection.confirmTransaction(signature);
    // approve the proposal 1
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      transactionIndex,
      member: members.voter,
      programId,
    });
    await connection.confirmTransaction(signature);
    // approve the proposal 2
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      member: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature);
    // execute the proposal
    signature = await multisig.rpc.configTransactionExecute({
      connection,
      feePayer: members.executor,
      multisigPda,
      transactionIndex,
      member: members.executor,
      rentPayer: members.executor,
      programId,
    });
    await connection.confirmTransaction(signature);
    // now assert we have 7 members
    multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    assert.strictEqual(multisigAccount.members.length, 7);
    assert.strictEqual(multisigAccount.threshold, 5);

    // so now our threshold should be 5 for cancelling, which exceeds the original space allocated at the beginning
    // get the original proposer and assert the originalCancel is in the cancel array
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.strictEqual(proposalAccount.cancelled.length, 1);
    let deprecatedCancelVote = proposalAccount.cancelled[0];
    assert.ok(deprecatedCancelVote.equals(originalCancel.publicKey));

    // get the pre realloc size
    const rawProposal = await connection.getAccountInfo(proposalPda);
    const rawProposalData = rawProposal?.data.length;

    // now cast a cancel against it with the first all perm key
    signature = await multisig.rpc.proposalCancelV2({
      connection,
      feePayer: members.almighty,
      member: members.almighty,
      multisigPda,
      transactionIndex: 2n,
      programId,
    });
    await connection.confirmTransaction(signature);
    // now assert that the cancelled array only has 1 key and it is the one that just voted
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    // check the data length to ensure it has changed
    const updatedRawProposal = await connection.getAccountInfo(proposalPda);
    const updatedRawProposalData = updatedRawProposal?.data.length;
    assert.notStrictEqual(updatedRawProposalData, rawProposalData);
    assert.strictEqual(proposalAccount.cancelled.length, 1);
    let newCancelVote = proposalAccount.cancelled[0];
    assert.ok(newCancelVote.equals(members.almighty.publicKey));
    // now cast 4 more cancels with the new key
    for (let i = 0; i < cancelVotesCollection.length; i++) {
      signature = await multisig.rpc.proposalCancelV2({
        connection,
        feePayer: members.executor,
        member: cancelVotesCollection[i],
        multisigPda,
        transactionIndex: 2n,
        programId,
      });
      await connection.confirmTransaction(signature);
    }

    // now assert the proposals is cancelled
    proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.ok(multisig.types.isProposalStatusCancelled(proposalAccount.status));
    // assert there are 5 cancelled votes
    assert.strictEqual(proposalAccount.cancelled.length, 5);
  });

 });
