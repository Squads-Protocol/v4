import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
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
import { BN } from "bn.js";
import {
  TransactionBufferCreateArgs,
  TransactionBufferCreateInstructionArgs,
} from "@sqds/multisig/lib/generated";
import * as crypto from "crypto";

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
    const transactionIndex = 1n;

    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
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

    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        new BN(Number(transactionIndex)).toBuffer("le", 8),
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
          vaultIndex: 0,
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
    const transactionIndex = 1n;

    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        new BN(Number(transactionIndex)).toBuffer("le", 8),
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

  /// Incrementing transaction index causes an error
  /*
  it("transaction buffer from large message", async () => {
    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1
    );
    let instructions = [];

    // Add 28 transfer instructions to the message.
    for (let i = 0; i <= 28; i++) {
      instructions.push(testIx);
    }

    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: instructions,
    });

    const messageBuffer = testTransferMessage.compileToV0Message().serialize();

    const [transactionBuffer, _] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        new BN(Number(2n)).toBuffer("le", 8),
      ],
      programId
    );
    console.log(transactionBuffer.toBase58());

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
          vaultIndex: 0,
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

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(signature);

    const transactionBufferAccount = await connection.getAccountInfo(
      transactionBuffer
    );

    assert.notEqual(transactionBufferAccount, null);
  });
  */
});
