import {
  AccountMeta,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
  TransactionBufferCreateArgs,
  TransactionBufferCreateInstructionArgs,
  TransactionBufferExtendArgs,
  TransactionBufferExtendInstructionArgs,
  VaultTransactionCreateArgs,
  VaultTransactionCreateFromBufferInstructionArgs
} from "@sqds/multisig/lib/generated";
import assert from "assert";
import { BN } from "bn.js";
import * as crypto from "crypto";
import {
  TestMembers,
  createAutonomousMultisigV2,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateMultisigMembers,
  getLogs,
  getTestProgramId,
} from "../../utils";

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / vault_transaction_create_from_buffer", () => {
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

  it("set buffer, extend, and create", async () => {
    const transactionIndex = 1n;
    const bufferIndex = 0;

    const testPayee = Keypair.generate();
    const testIx = createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    let instructions = [];

    // Add 48 transfer instructions to the message.
    for (let i = 0; i <= 42; i++) {
      instructions.push(testIx);
    }

    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: instructions,
    });

    // Serialize the message. Must be done with this util function
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
        members.proposer.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex]),
      ],
      programId
    );

    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();

    // Slice the message buffer into two parts.
    const firstSlice = messageBuffer.slice(0, 700);

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
          // Must be a SHA256 hash of the message buffer.
          finalBufferHash: Array.from(messageHash),
          finalBufferSize: messageBuffer.length,
          buffer: firstSlice,
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

    // Check buffer account exists.
    assert.notEqual(transactionBufferAccount, null);
    assert.ok(transactionBufferAccount?.data.length! > 0);

    // Need to add some deserialization to check if it actually worked.
    const transactionBufferInfo1 = await connection.getAccountInfo(
      transactionBuffer
    );
    const [txBufferDeser1] =
      await multisig.generated.TransactionBuffer.fromAccountInfo(
        transactionBufferInfo1!
      );

    // First chunk uploaded. Check that length is as expected.
    assert.equal(txBufferDeser1.buffer.length, 700);

    const secondSlice = messageBuffer.slice(700, messageBuffer.byteLength);

    // Extned the buffer.
    const secondIx =
      multisig.generated.createTransactionBufferExtendInstruction(
        {
          multisig: multisigPda,
          transactionBuffer,
          creator: members.proposer.publicKey,
        },
        {
          args: {
            buffer: secondSlice,
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

    // Send second transaction to extend.
    const secondSignature = await connection.sendTransaction(secondTx, {
      skipPreflight: true,
    });

    await connection.confirmTransaction(secondSignature);

    // Need to add some deserialization to check if it actually worked.
    const transactionBufferInfo2 = await connection.getAccountInfo(
      transactionBuffer
    );
    const [txBufferDeser2] =
      multisig.generated.TransactionBuffer.fromAccountInfo(
        transactionBufferInfo2!
      );

    // Final chunk uploaded. Check that length is as expected.

    assert.equal(txBufferDeser2.buffer.length, messageBuffer.byteLength);

    // Derive vault transaction PDA.
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
      programId,
    });

    const transactionAccountInfo = await connection.getAccountInfo(transactionPda);



    const transactionBufferMeta: AccountMeta = {
      pubkey: transactionBuffer,
      isWritable: true,
      isSigner: false
    }
    const mockTransferIx = SystemProgram.transfer({
      fromPubkey: members.proposer.publicKey,
      toPubkey: members.almighty.publicKey,
      lamports: 100
    });


    // Create final instruction.
    const thirdIx =
      multisig.generated.createVaultTransactionCreateFromBufferInstruction(
        {
          vaultTransactionCreateItemMultisig: multisigPda,
          vaultTransactionCreateItemTransaction: transactionPda,
          vaultTransactionCreateItemCreator: members.proposer.publicKey,
          vaultTransactionCreateItemRentPayer: members.proposer.publicKey,
          vaultTransactionCreateItemSystemProgram: SystemProgram.programId,
          creator: members.proposer.publicKey,
          transactionBuffer: transactionBuffer,
        },
        {
          args: {
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: new Uint8Array(6).fill(0),
            memo: null,
          } as VaultTransactionCreateArgs,
        } as VaultTransactionCreateFromBufferInstructionArgs,
        programId
      );

    // Add third instruction to the message.
    const blockhash = await connection.getLatestBlockhash();

    const thirdMessage = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: blockhash.blockhash,
      instructions: [thirdIx],
    }).compileToV0Message();

    const thirdTx = new VersionedTransaction(thirdMessage);

    thirdTx.sign([members.proposer]);

    // Send final transaction.
    const thirdSignature = await connection.sendRawTransaction(thirdTx.serialize(), {
      skipPreflight: true,
    });

    await connection.confirmTransaction({
      signature: thirdSignature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    }, "confirmed");

    const transactionInfo =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
      );

    // Ensure final vault transaction has 43 instructions
    assert.equal(transactionInfo.message.instructions.length, 43);
  });

  it("error: create from buffer with mismatched hash", async () => {
    const transactionIndex = 2n;
    const bufferIndex = 0;

    // Create a simple transfer instruction
    const testIx = await createTestTransferInstruction(
      vaultPda,
      Keypair.generate().publicKey,
      0.1 * LAMPORTS_PER_SOL
    );

    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [testIx],
    });

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
        members.proposer.publicKey.toBuffer(),
        Uint8Array.from([bufferIndex]),
      ],
      programId
    );

    // Create a dummy hash of zeros
    const dummyHash = new Uint8Array(32).fill(0);

    const createIx =
      multisig.generated.createTransactionBufferCreateInstruction(
        {
          multisig: multisigPda,
          transactionBuffer,
          creator: members.proposer.publicKey,
          rentPayer: members.proposer.publicKey,
          systemProgram: SystemProgram.programId,
        },
        {
          args: {
            bufferIndex,
            vaultIndex: 0,
            finalBufferHash: Array.from(dummyHash),
            finalBufferSize: messageBuffer.length,
            buffer: messageBuffer,
          } as TransactionBufferCreateArgs,
        } as TransactionBufferCreateInstructionArgs,
        programId
      );


    const createMessage = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [createIx],
    }).compileToV0Message();

    const createTx = new VersionedTransaction(createMessage);
    createTx.sign([members.proposer]);

    const createBufferSig = await connection.sendTransaction(createTx, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(createBufferSig);

    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
      programId,
    });
    const transactionBufferMeta: AccountMeta = {
      pubkey: transactionBuffer,
      isWritable: true,
      isSigner: false
    }

    const createFromBufferIx =
      multisig.generated.createVaultTransactionCreateFromBufferInstruction(
        {
          vaultTransactionCreateItemMultisig: multisigPda,
          vaultTransactionCreateItemTransaction: transactionPda,
          vaultTransactionCreateItemCreator: members.proposer.publicKey,
          vaultTransactionCreateItemRentPayer: members.proposer.publicKey,
          vaultTransactionCreateItemSystemProgram: SystemProgram.programId,
          creator: members.proposer.publicKey,
          transactionBuffer: transactionBuffer,
        },
        {
          args: {
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: new Uint8Array(6).fill(0),
            memo: null,
            anchorRemainingAccounts: [transactionBufferMeta]
          } as VaultTransactionCreateArgs,
        } as VaultTransactionCreateFromBufferInstructionArgs,
        programId
      );

    const createFromBufferMessage = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [createFromBufferIx],
    }).compileToV0Message();


    const createFromBufferTx = new VersionedTransaction(
      createFromBufferMessage
    );
    createFromBufferTx.sign([members.proposer]);

    await assert.rejects(
      () =>
        connection
          .sendTransaction(createFromBufferTx)
          .catch(multisig.errors.translateAndThrowAnchorError),
      /FinalBufferHashMismatch/
    );
  });

  // We expect the program to run out of memory in a base case, given 43 transfers.
  it("error: out of memory (no allocator)", async () => {
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: 1n,
      programId,
    });

    const transactionInfo =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
      );

    // Check that we're dealing with the same account from first test.
    assert.equal(transactionInfo.message.instructions.length, 43);

    const fourthSignature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex: 1n,
      creator: members.almighty,
      isDraft: false,
      programId,
    });
    await connection.confirmTransaction(fourthSignature);

    const fifthSignature = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex: 1n,
      member: members.almighty,
      programId,
    });
    await connection.confirmTransaction(fifthSignature);

    const executeIx = await multisig.instructions.vaultTransactionExecute({
      connection,
      multisigPda,
      transactionIndex: 1n,
      member: members.almighty.publicKey,
      programId,
    });

    const executeTx = new Transaction().add(executeIx.instruction);
    const signature4 = await connection.sendTransaction(
      executeTx,
      [members.almighty],
      { skipPreflight: true }
    );
    await connection.confirmTransaction(signature4);

    const logs = (await getLogs(connection, signature4)).join("");

    assert.match(logs, /Access violation in heap section at address/);

  });
});
