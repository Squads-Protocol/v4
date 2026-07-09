import * as multisig from "@sqds/multisig";
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  LAMPORTS_PER_SOL,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import assert from "assert";
import {
  createAutonomousMultisig,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateFundedKeypair,
  generateMultisigMembers,
  getTestProgramId,
  range,
  TestMembers,
} from "../../utils";

const { Multisig, Proposal } = multisig.accounts;

const programId = getTestProgramId();

describe("Examples / Batch SOL Transfer", () => {
  const connection = createLocalhostConnection();

  let members: TestMembers;
  before(async () => {
    members = await generateMultisigMembers(connection);
  });

  it("create and execute batch transaction containing multiple SOL transfers", async () => {
    // Use a different fee payer for the batch execution to isolate member balance changes.
    const feePayer = await generateFundedKeypair(connection);

    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 2,
      timeLock: 0,
      programId,
    });

    let multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    const vaultIndex = 0;
    const batchIndex =
      multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;

    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: batchIndex,
      programId,
    });

    // Default vault, index 0.
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: 0,
      programId,
    });

    // Prepare transactions for the batch.
    // We are going to make a payout of 1 SOL to every member of the multisig
    // first as a separate transaction per member, then in a single transaction
    // that also uses an Account Lookup Table containing all member addresses.
    // Airdrop SOL amount required for the payout to the Vault.
    const airdropSig = await connection.requestAirdrop(
      vaultPda,
      // Each member will be paid 2 x 1 SOL.
      Object.keys(members).length * 2 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSig);
    const {
      value: { blockhash },
      context: { slot },
    } = await connection.getLatestBlockhashAndContext("finalized");

    const testTransactionMessages = [] as {
      message: TransactionMessage;
      addressLookupTableAccounts: AddressLookupTableAccount[];
    }[];
    for (const member of Object.values(members)) {
      const ix = createTestTransferInstruction(
        vaultPda,
        member.publicKey,
        LAMPORTS_PER_SOL
      );
      testTransactionMessages.push({
        message: new TransactionMessage({
          payerKey: vaultPda,
          recentBlockhash: blockhash,
          instructions: [ix],
        }),
        addressLookupTableAccounts: [],
      });
    }

    // Create a lookup table with all member addresses.
    const memberAddresses = Object.values(members).map((m) => m.publicKey);
    const [lookupTableIx, lookupTableAddress] =
      AddressLookupTableProgram.createLookupTable({
        authority: feePayer.publicKey,
        payer: feePayer.publicKey,
        recentSlot: slot,
      });
    const extendTableIx = AddressLookupTableProgram.extendLookupTable({
      payer: feePayer.publicKey,
      authority: feePayer.publicKey,
      lookupTable: lookupTableAddress,
      addresses: [SystemProgram.programId, ...memberAddresses],
    });

    const createLookupTableTx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: feePayer.publicKey,
        recentBlockhash: blockhash,
        instructions: [lookupTableIx, extendTableIx],
      }).compileToV0Message()
    );
    createLookupTableTx.sign([feePayer]);
    let signature = await connection
      .sendRawTransaction(createLookupTableTx.serialize())
      .catch((err: any) => {
        console.error(err.logs);
        throw err;
      });
    await connection.confirmTransaction(signature);

    const lookupTableAccount = await connection
      .getAddressLookupTable(lookupTableAddress)
      .then((res) => res.value);
    assert.ok(lookupTableAccount);

    const batchTransferIxs = Object.values(members).map((member) =>
      createTestTransferInstruction(
        vaultPda,
        member.publicKey,
        LAMPORTS_PER_SOL
      )
    );
    testTransactionMessages.push({
      message: new TransactionMessage({
        payerKey: vaultPda,
        recentBlockhash: blockhash,
        instructions: batchTransferIxs,
      }),
      addressLookupTableAccounts: [lookupTableAccount],
    });

    // Create a batch account.
    signature = await multisig.rpc.batchCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      creator: members.proposer,
      batchIndex,
      vaultIndex,
      memo: "Distribute funds to members",
      programId,
    });
    await connection.confirmTransaction(signature);

    // Initialize the proposal for the batch.
    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: batchIndex,
      creator: members.proposer,
      isDraft: true,
      programId,
    });
    await connection.confirmTransaction(signature);

    // Add transactions to the batch.
    for (const [
      index,
      { message, addressLookupTableAccounts },
    ] of testTransactionMessages.entries()) {
      signature = await multisig.rpc.batchAddTransaction({
        connection,
        feePayer: members.proposer,
        multisigPda,
        member: members.proposer,
        vaultIndex: 0,
        batchIndex,
        // Batch transaction indices start at 1.
        transactionIndex: index + 1,
        ephemeralSigners: 0,
        transactionMessage: message,
        addressLookupTableAccounts,
        programId,
      });
      await connection.confirmTransaction(signature);
    }

    // Activate the proposal (finalize the batch).
    signature = await multisig.rpc.proposalActivate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      member: members.proposer,
      transactionIndex: batchIndex,
      programId,
    });
    await connection.confirmTransaction(signature);

    // First approval for the batch proposal.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      member: members.voter,
      transactionIndex: batchIndex,
      memo: "LGTM",
      programId,
    });
    await connection.confirmTransaction(signature);

    // Second approval for the batch proposal.
    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      member: members.almighty,
      transactionIndex: batchIndex,
      memo: "LGTM too",
      programId,
    });
    await connection.confirmTransaction(signature);

    // Fetch the member balances before the batch execution.
    const preBalances = [] as number[];
    for (const member of Object.values(members)) {
      const balance = await connection.getBalance(member.publicKey);
      preBalances.push(balance);
    }
    assert.strictEqual(Object.values(members).length, preBalances.length);

    // Execute the transactions from the batch sequentially one-by-one.
    for (const transactionIndex of range(1, testTransactionMessages.length)) {
      signature = await multisig.rpc.batchExecuteTransaction({
        connection,
        feePayer: feePayer,
        multisigPda,
        member: members.executor,
        batchIndex,
        transactionIndex,
        programId,
      });
      await connection.confirmTransaction(signature);
    }

    // Proposal status must be "Executed".
    const proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));

    // Verify that the members received the funds.
    for (const [index, preBalance] of preBalances.entries()) {
      const postBalance = await connection.getBalance(
        Object.values(members)[index].publicKey
      );
      assert.strictEqual(postBalance, preBalance + 2 * LAMPORTS_PER_SOL);
    }
  });

  // Regression test for MUL-744: batchExecuteTransaction must forward the
  // custom `programId` when deriving ephemeral signer PDAs. Otherwise the SDK
  // derives them under the default program namespace, leaves the real ephemeral
  // signer marked as a required outer signer, and produces an unsignable
  // transaction on non-default deployments.
  it("executes a batch transaction with an ephemeral signer under a custom programId", async () => {
    const feePayer = await generateFundedKeypair(connection);

    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 2,
      timeLock: 0,
      programId,
    });

    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );

    const vaultIndex = 0;
    const batchIndex =
      multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;
    const transactionIndex = 1;

    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex: batchIndex,
      programId,
    });
    const [batchPda] = multisig.getTransactionPda({
      multisigPda,
      index: batchIndex,
      programId,
    });
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: vaultIndex,
      programId,
    });
    // Ephemeral signer PDA derived under the *custom* programId — this is the
    // address the on-chain program signs for via CPI during execution.
    const [ephemeralSignerPda] = multisig.getEphemeralSignerPda({
      transactionPda: batchPda,
      ephemeralSignerIndex: 0,
      programId,
    });

    // Fund the vault so it can pay rent for the account the batch leg creates.
    const airdropSig = await connection.requestAirdrop(
      vaultPda,
      LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSig);

    // The batch leg creates a new account keyed by the ephemeral signer PDA,
    // which requires the program to sign for it during execution.
    const transactionMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [
        SystemProgram.createAccount({
          fromPubkey: vaultPda,
          newAccountPubkey: ephemeralSignerPda,
          lamports: 1_000_000,
          space: 0,
          programId: SystemProgram.programId,
        }),
      ],
    });

    let signature = await multisig.rpc.batchCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      creator: members.proposer,
      batchIndex,
      vaultIndex,
      memo: "Ephemeral signer batch",
      programId,
    });
    await connection.confirmTransaction(signature);

    signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      transactionIndex: batchIndex,
      creator: members.proposer,
      isDraft: true,
      programId,
    });
    await connection.confirmTransaction(signature);

    signature = await multisig.rpc.batchAddTransaction({
      connection,
      feePayer: members.proposer,
      multisigPda,
      member: members.proposer,
      vaultIndex,
      batchIndex,
      transactionIndex,
      ephemeralSigners: 1,
      transactionMessage,
      programId,
    });
    await connection.confirmTransaction(signature);

    signature = await multisig.rpc.proposalActivate({
      connection,
      feePayer: members.proposer,
      multisigPda,
      member: members.proposer,
      transactionIndex: batchIndex,
      programId,
    });
    await connection.confirmTransaction(signature);

    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.voter,
      multisigPda,
      member: members.voter,
      transactionIndex: batchIndex,
      memo: "approve 1",
      programId,
    });
    await connection.confirmTransaction(signature);

    signature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      member: members.almighty,
      transactionIndex: batchIndex,
      memo: "approve 2",
      programId,
    });
    await connection.confirmTransaction(signature);

    // Execute through the official batch executor. Before the fix this produced
    // an unsignable transaction because the ephemeral signer PDA was derived
    // under the default programId; it must succeed now.
    signature = await multisig.rpc.batchExecuteTransaction({
      connection,
      feePayer,
      multisigPda,
      member: members.executor,
      batchIndex,
      transactionIndex,
      programId,
    });
    await connection.confirmTransaction(signature);

    // The ephemeral signer account must now exist, owned by the System Program.
    const createdAccount = await connection.getAccountInfo(ephemeralSignerPda);
    assert.ok(createdAccount);
    assert.ok(createdAccount.owner.equals(SystemProgram.programId));

    // Proposal status must be "Executed".
    const proposalAccount = await Proposal.fromAccountAddress(
      connection,
      proposalPda
    );
    assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));
  });
});
