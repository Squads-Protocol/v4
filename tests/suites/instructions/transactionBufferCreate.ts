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
} from "@sqds/multisig/lib/generated";
import assert from "assert";
import * as crypto from "crypto";
import {
  createAutonomousMultisigV2,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / transaction_buffer_create", () => {
  let members: TestMembers;

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
    multisigPda = (
      await createAutonomousMultisigV2({
        connection,
        createKey,
        members,
        threshold: 2,
        timeLock: 0,
        rentCollector: vaultPda,
        programId,
      })
    )[0];

    // Airdrop some SOL to the vault
    let signature = await connection.requestAirdrop(
      vaultPda,
      10 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(signature);
  });

  it("set transaction buffer", async () => {
    const bufferIndex = 0;

    const testPayee = Keypair.generate();
    const testIx = createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    // Initialize a transaction message with a single instruction.
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Serialize with SDK util
    const messageBuffer =
      multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
        message: testTransferMessage,
        addressLookupTableAccounts: [],
        vaultPda,
      });

    const [transactionBuffer, _] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        members.proposer.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex])
      ],
      programId
    );

    // Convert to a SHA256 hash.
    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();


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
          bufferIndex: bufferIndex,
          vaultIndex: 0,
          createKey: Keypair.generate(),
          // Must be a SHA256 hash of the message buffer.
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: messageBuffer,
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

    // Send transaction.
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(signature);

    const transactionBufferAccount = await connection.getAccountInfo(
      transactionBuffer
    );

    // Verify account exists.
    assert.notEqual(transactionBufferAccount, null);
    assert.ok(transactionBufferAccount?.data.length! > 0);
  });



  it("close transaction buffer", async () => {
    const bufferIndex = 0;

    const [transactionBuffer, _] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        members.proposer.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex])
      ],
      programId
    );

    const ix = multisig.generated.createTransactionBufferCloseInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: members.proposer.publicKey,
      },
      programId
    );

    const message = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);

    tx.sign([members.proposer]);

    // Send transaction.
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(signature);

    const transactionBufferAccount = await connection.getAccountInfo(
      transactionBuffer
    );

    // Verify account is closed.
    assert.equal(transactionBufferAccount, null);
  });

  it("reinitalize transaction buffer after its been closed", async () => {
    const bufferIndex = 0;

    const testPayee = Keypair.generate();
    const testIx = createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    // Initialize a transaction message with a single instruction.
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Serialize with SDK util
    const messageBuffer =
      multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
        message: testTransferMessage,
        addressLookupTableAccounts: [],
        vaultPda,
      });

    const [transactionBuffer, _] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        members.proposer.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex])
      ],
      programId
    );

    // Convert to a SHA256 hash.
    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();


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
          bufferIndex: bufferIndex,
          vaultIndex: 0,
          createKey: Keypair.generate(),
          // Must be a SHA256 hash of the message buffer.
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: messageBuffer,
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

    // Send transaction.
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(signature);

    const transactionBufferAccount = await connection.getAccountInfo(
      transactionBuffer
    );

    // Verify account exists.
    assert.notEqual(transactionBufferAccount, null);
    assert.ok(transactionBufferAccount?.data.length! > 0);

    const ix2 = multisig.generated.createTransactionBufferCloseInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: members.proposer.publicKey,
      },
      programId
    );

    const message2 = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix2],
    }).compileToV0Message();

    const tx2 = new VersionedTransaction(message2);

    tx2.sign([members.proposer]);

    // Send transaction.
    const signature2 = await connection.sendTransaction(tx2, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(signature2);

    const transactionBufferAccount2 = await connection.getAccountInfo(
      transactionBuffer
    );

    // Verify account is closed.
    assert.equal(transactionBufferAccount2, null);
  });

  // Test: Attempt to create a transaction buffer with a non-member
  it("error: creating buffer as non-member", async () => {
    const bufferIndex = 0;
    // Create a keypair that is not a member of the multisig
    const nonMember = Keypair.generate();
    // Airdrop some SOL to the non-member
    const airdropSig = await connection.requestAirdrop(
      nonMember.publicKey,
      1 * LAMPORTS_PER_SOL
    );
    await connection.confirmTransaction(airdropSig);

    // Set up a test transaction
    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    // Create a transaction message
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Serialize the message buffer
    const messageBuffer =
      multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
        message: testTransferMessage,
        addressLookupTableAccounts: [],
        vaultPda,
      });

    // Derive the transaction buffer PDA
    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        nonMember.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex]),
      ],
      programId
    );

    // Create a hash of the message buffer
    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();

    // Create the instruction to create a transaction buffer
    const ix = multisig.generated.createTransactionBufferCreateInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: nonMember.publicKey,
        rentPayer: nonMember.publicKey,
        systemProgram: SystemProgram.programId,
      },
      {
        args: {
          bufferIndex: bufferIndex,
          vaultIndex: 0,
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: messageBuffer,
        } as TransactionBufferCreateArgs,
      } as TransactionBufferCreateInstructionArgs,
      programId
    );

    // Create and sign the transaction
    const message = new TransactionMessage({
      payerKey: nonMember.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([nonMember]);

    // Attempt to send the transaction and expect it to fail
    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /NotAMember/
    );
  });

  // Test: Attempt to create a transaction buffer with a member without initiate permissions
  it("error: creating buffer as member without proposer permissions", async () => {
    const memberWithoutInitiatePermissions = members.voter;

    const bufferIndex = 0;

    // Set up a test transaction
    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    // Create a transaction message
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Serialize the message buffer
    const messageBuffer =
      multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
        message: testTransferMessage,
        addressLookupTableAccounts: [],
        vaultPda,
      });

    // Derive the transaction buffer PDA
    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        memberWithoutInitiatePermissions.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex]),
      ],
      programId
    );

    // Create a hash of the message buffer
    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();

    // Create the instruction to create a transaction buffer
    const ix = multisig.generated.createTransactionBufferCreateInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: memberWithoutInitiatePermissions.publicKey,
        rentPayer: memberWithoutInitiatePermissions.publicKey,
        systemProgram: SystemProgram.programId,
      },
      {
        args: {
          bufferIndex: bufferIndex,
          vaultIndex: 0,
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: messageBuffer,
        } as TransactionBufferCreateArgs,
      } as TransactionBufferCreateInstructionArgs,
      programId
    );

    // Create and sign the transaction
    const message = new TransactionMessage({
      payerKey: memberWithoutInitiatePermissions.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([memberWithoutInitiatePermissions]);

    // Attempt to send the transaction and expect it to fail
    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /Unauthorized/
    );
  });

  // Test: Attempt to create a transaction buffer with an invalid index
  it("error: creating buffer for invalid index", async () => {
    // Use an invalid buffer index (non-u8 value)
    const invalidBufferIndex = "random_string";

    // Set up a test transaction
    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    // Create a transaction message
    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

    // Serialize the message buffer
    const messageBuffer =
      multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
        message: testTransferMessage,
        addressLookupTableAccounts: [],
        vaultPda,
      });

    // Derive the transaction buffer PDA with the invalid index
    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        members.proposer.publicKey.toBuffer(),
        Buffer.from(invalidBufferIndex),
      ],
      programId
    );

    // Create a hash of the message buffer
    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();

    // Create the instruction to create a transaction buffer
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
          bufferIndex: 0,
          vaultIndex: 0,
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: messageBuffer,
        } as TransactionBufferCreateArgs,
      } as TransactionBufferCreateInstructionArgs,
      programId
    );

    // Create and sign the transaction
    const message = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    // Not signing with the create_key on purpose
    tx.sign([members.proposer]);

    // Attempt to send the transaction and expect it to fail
    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /A seeds constraint was violated/
    );
  });


  it("error: creating buffer exceeding maximum size", async () => {
    const bufferIndex = 0;

    // Create a large buffer that exceeds the maximum size
    const largeBuffer = Buffer.alloc(500, 1);  // 500 bytes, filled with 1s

    // Derive the transaction buffer PDA
    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        members.proposer.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex]),
      ],
      programId
    );

    // Create a hash of the large buffer
    const messageHash = crypto
      .createHash("sha256")
      .update(largeBuffer)
      .digest();

    // Create the instruction to create a transaction buffer
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
          bufferIndex: bufferIndex,
          vaultIndex: 0,
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: 4001,
          buffer: largeBuffer,
        } as TransactionBufferCreateArgs,
      } as TransactionBufferCreateInstructionArgs,
      programId
    );

    // Create and sign the transaction
    const message = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);
    tx.sign([members.proposer]);

    // Attempt to send the transaction and expect it to fail
    await assert.rejects(
      () =>
        connection
          .sendTransaction(tx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /FinalBufferSizeExceeded/  // Assuming this is the error thrown for exceeding buffer size
    );
  });
});
