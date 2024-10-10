import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
  TransactionBufferCreateArgs,
  TransactionBufferCreateInstructionArgs,
  TransactionBufferExtendArgs,
  TransactionBufferExtendInstructionArgs,
} from "@sqds/multisig/lib/generated";
import assert from "assert";
import * as crypto from "crypto";
import {
  TestMembers,
  createAutonomousMultisigV2,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateMultisigMembers,
  getTestProgramId,
} from "../../utils";

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / transaction_buffer_extend", () => {
  let members: TestMembers;
  let transactionBufferAccount: PublicKey;

  const createKey = Keypair.generate();

  let multisigPda = multisig.getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  })[0];

  const [vaultPda] = multisig.getVaultPda({
    multisigPda,
    index: 0,
    programId,
  });

  // Set up a multisig with some transactions.
  before(async () => {
    members = await generateMultisigMembers(connection);

    // Create new autonomous multisig with rentCollector set to its default vault.
    await createAutonomousMultisigV2({
      connection,
      createKey,
      members,
      threshold: 1,
      timeLock: 0,
      rentCollector: vaultPda,
      programId,
    });

    // Airdrop some SOL to the vault
    let signature = await connection.requestAirdrop(
      vaultPda,
      10 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
  });

  // Helper function to create a transaction buffer
  async function createTransactionBuffer(creator: Keypair, transactionIndex: bigint) {
    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        creator.publicKey.toBuffer(),
        Buffer.from([Number(transactionIndex)])
      ],
      programId
    );

    const testIx = await createTestTransferInstruction(
      vaultPda,
      Keypair.generate().publicKey,
      1 * LAMPORTS_PER_SOL
    );

    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    const messageBuffer = multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
      message: testTransferMessage,
      addressLookupTableAccounts: [],
      vaultPda,
    });

    const messageHash = crypto.createHash("sha256").update(messageBuffer).digest();

    const createIx = multisig.generated.createTransactionBufferCreateInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: creator.publicKey,
        rentPayer: creator.publicKey,
        systemProgram: SystemProgram.programId,
      },
      {
        args: {
          bufferIndex: Number(transactionIndex),
          vaultIndex: 0,
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: messageBuffer.slice(0, 750),
        } as TransactionBufferCreateArgs,
      } as TransactionBufferCreateInstructionArgs,
      programId
    );

    const createMessage = new TransactionMessage({
      payerKey: creator.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [createIx],
    }).compileToV0Message();

    const createTx = new VersionedTransaction(createMessage);
    createTx.sign([creator]);

    const sig = await connection.sendTransaction(createTx, { skipPreflight: true });
    await connection.confirmTransaction(sig);

    return transactionBuffer;
  }

  // Helper function to close a transaction buffer
  async function closeTransactionBuffer(creator: Keypair, transactionBuffer: PublicKey) {
    const closeIx = multisig.generated.createTransactionBufferCloseInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: creator.publicKey,
      },
      programId
    );

    const closeMessage = new TransactionMessage({
      payerKey: creator.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [closeIx],
    }).compileToV0Message();

    const closeTx = new VersionedTransaction(closeMessage);
    closeTx.sign([creator]);

    const sig = await connection.sendTransaction(closeTx, { skipPreflight: true });

    await connection.confirmTransaction(sig);
  }

  it("set transaction buffer and extend", async () => {
    const transactionIndex = 1n;

    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    let instructions = [];

    // Add 28 transfer instructions to the message.
    for (let i = 0; i <= 42; i++) {
      instructions.push(testIx);
    }

    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: instructions,
    });

    // Serialize with SDK util
    const messageBuffer = multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
      message: testTransferMessage,
      addressLookupTableAccounts: [],
      vaultPda,
    });

    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        members.proposer.publicKey.toBuffer(),
        Buffer.from([Number(transactionIndex)])
      ],
      programId
    );
    // Convert message buffer to a SHA256 hash.
    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();

    // Slice the first 750 bytes of the message buffer.
    const firstHalf = messageBuffer.slice(0, 750);

    const ix = multisig.generated.createTransactionBufferCreateInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: members.proposer.publicKey,
        rentPayer: members.proposer.publicKey,
        systemProgram: SystemProgram.programId,
      },
      {
        args: {
          bufferIndex: Number(transactionIndex),
          vaultIndex: 0,
          // Must be a SHA256 hash of the message buffer.
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: firstHalf,
        } as TransactionBufferCreateArgs,
      } as TransactionBufferCreateInstructionArgs,
      programId
    );

    const message = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);

    tx.sign([members.proposer]);

    // Send first transaction.
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
    });

    await connection.confirmTransaction(signature);

    const transactionBufferAccount = await connection.getAccountInfo(
      transactionBuffer
    );

    // Ensure the transaction buffer account exists.
    assert.notEqual(transactionBufferAccount, null);
    assert.ok(transactionBufferAccount?.data.length! > 0);

    // Need to add some deserialization to check if it actually worked.
    const transactionBufferInfo1 = await connection.getAccountInfo(transactionBuffer);
    const [txBufferDeser1] = await multisig.generated.TransactionBuffer.fromAccountInfo(
      transactionBufferInfo1!
    );

    // First chunk uploaded. Check that length is as expected.
    assert.equal(txBufferDeser1.buffer.length, 750);

    // Slice that last bytes of the message buffer.
    const secondHalf = messageBuffer.slice(
      750,
      messageBuffer.byteLength
    );

    const secondIx =
      multisig.generated.createTransactionBufferExtendInstruction(
        {
          multisig: multisigPda,
          transactionBuffer,
          creator: members.proposer.publicKey,
        },
        {
          args: {
            buffer: secondHalf,
          } as TransactionBufferExtendArgs,
        } as TransactionBufferExtendInstructionArgs,
        programId
      );

    const secondMessage = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [secondIx],
    }).compileToV0Message();

    const secondTx = new VersionedTransaction(secondMessage);

    secondTx.sign([members.proposer]);

    // Send second transaction.
    const secondSignature = await connection.sendTransaction(secondTx, {
      skipPreflight: true,
    });

    await connection.confirmTransaction(secondSignature);

    // Need to add some deserialization to check if it actually worked.
    const transactionBufferInfo2 = await connection.getAccountInfo(transactionBuffer);
    const [txBufferDeser2] = await multisig.generated.TransactionBuffer.fromAccountInfo(
      transactionBufferInfo2!
    );

    // Buffer fully uploaded. Check that length is as expected.
    assert.equal(txBufferDeser2.buffer.length, messageBuffer.byteLength);

    // Close the transaction buffer account.
    await closeTransactionBuffer(members.proposer, transactionBuffer);

    // Fetch the transaction buffer account.
    const closedTransactionBufferInfo = await connection.getAccountInfo(
      transactionBuffer
    );
    assert.equal(closedTransactionBufferInfo, null);
  });

  // Test: Attempt to extend a transaction buffer as a non-member
  it("error: extending buffer as non-member", async () => {
    const transactionIndex = 1n;
    const nonMember = Keypair.generate();
    await connection.requestAirdrop(nonMember.publicKey, 1 * LAMPORTS_PER_SOL);

    const transactionBuffer = await createTransactionBuffer(members.almighty, transactionIndex);

    const dummyData = Buffer.alloc(100, 1);
    const ix = multisig.generated.createTransactionBufferExtendInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: nonMember.publicKey,
      },
      {
        args: {
          buffer: dummyData,
        } as TransactionBufferExtendArgs,
      } as TransactionBufferExtendInstructionArgs,
      programId
    );

    const message = new TransactionMessage({
      payerKey: nonMember.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([nonMember]);

    await assert.rejects(
      () => connection.sendTransaction(tx).catch(multisig.errors.translateAndThrowAnchorError),
      /(Unauthorized|ConstraintSeeds)/
    );

    await closeTransactionBuffer(members.almighty, transactionBuffer);
  });

  // Test: Attempt to extend a transaction buffer past the 4000 byte limit
  it("error: extending buffer past submitted byte value", async () => {
    const transactionIndex = 1n;

    const transactionBuffer = await createTransactionBuffer(members.almighty, transactionIndex);

    const largeData = Buffer.alloc(500, 1);
    const ix = multisig.generated.createTransactionBufferExtendInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: members.almighty.publicKey,
      },
      {
        args: {
          buffer: largeData,
        } as TransactionBufferExtendArgs,
      } as TransactionBufferExtendInstructionArgs,
      programId
    );

    const message = new TransactionMessage({
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([members.almighty]);

    await assert.rejects(
      () => connection.sendTransaction(tx).catch(multisig.errors.translateAndThrowAnchorError),
      /FinalBufferSizeExceeded/
    );

    await closeTransactionBuffer(members.almighty, transactionBuffer);
  });

  // Test: Attempt to extend a transaction buffer by a member who is not the original creator
  it("error: extending buffer by non-creator member", async () => {
    const transactionIndex = 1n;

    const transactionBuffer = await createTransactionBuffer(members.proposer, transactionIndex);

    const dummyData = Buffer.alloc(100, 1);
    const extendIx = multisig.generated.createTransactionBufferExtendInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: members.almighty.publicKey,
      },
      {
        args: {
          buffer: dummyData,
        } as TransactionBufferExtendArgs,
      } as TransactionBufferExtendInstructionArgs,
      programId
    );

    const extendMessage = new TransactionMessage({
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [extendIx],
    }).compileToV0Message();

    const extendTx = new VersionedTransaction(extendMessage);
    extendTx.sign([members.almighty]);

    await assert.rejects(
      () => connection.sendTransaction(extendTx).catch(multisig.errors.translateAndThrowAnchorError),
      /(Unauthorized|ConstraintSeeds)/
    );


    await closeTransactionBuffer(members.proposer, transactionBuffer);
  });

});