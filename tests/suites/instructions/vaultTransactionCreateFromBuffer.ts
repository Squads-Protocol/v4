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
  TransactionBufferExtendArgs,
  TransactionBufferExtendInstructionArgs,
  VaultTransactionCreateFromBufferArgs,
  VaultTransactionCreateFromBufferInstructionAccounts,
  VaultTransactionCreateFromBufferInstructionArgs,
} from "@sqds/multisig/lib/generated";
import * as crypto from "crypto";

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / transaction_buffer_extend", () => {
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
      threshold: 2,
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

    const testPayee = Keypair.generate();
    const testIx = await createTestTransferInstruction(
      vaultPda,
      testPayee.publicKey,
      1 * LAMPORTS_PER_SOL
    );

    let instructions = [];

    // Add 12 transfer instructions to the message.
    for (let i = 0; i <= 12; i++) {
      instructions.push(testIx);
    }

    const testTransferMessage = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: instructions,
    });

    const messageBuffer = testTransferMessage.compileToV0Message().serialize();

    const [transactionBuffer, _] = await PublicKey.findProgramAddressSync(
      [
        Buffer.from("multisig"),
        multisigPda.toBuffer(),
        Buffer.from("transaction_buffer"),
        new BN(Number(transactionIndex)).toBuffer("le", 8),
      ],
      programId
    );

    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();

    const firstHalf = messageBuffer.slice(0, messageBuffer.length / 2);

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

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(signature);

    const transactionBufferAccount = await connection.getAccountInfo(
      transactionBuffer
    );

    assert.notEqual(transactionBufferAccount, null);
    assert.ok(transactionBufferAccount?.data.length! > 0);

    const secondHalf = messageBuffer.slice(
      messageBuffer.length / 2,
      messageBuffer.length
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

    const secondSignature = await connection.sendTransaction(secondTx, {
      skipPreflight: true,
    });

    await connection.confirmTransaction(secondSignature);

    // Need to add some deserialization to check if it actually worked.

    // Derive vault transaction PDA.
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
      programId,
    });

    // Create final instruction.
    const thirdIx =
      multisig.generated.createVaultTransactionCreateFromBufferInstruction(
        {
          multisig: multisigPda,
          transactionBuffer,
          transaction: transactionPda,
          creator: members.proposer.publicKey,
          rentPayer: members.proposer.publicKey,
          systemProgram: SystemProgram.programId,
        },
        {
          args: {
            ephemeralSigners: 0,
            memo: "Hello world!",
          } as VaultTransactionCreateFromBufferArgs,
        } as VaultTransactionCreateFromBufferInstructionArgs,
        programId
      );

    // Add third instruction to the message.
    const thirdMessage = new TransactionMessage({
      payerKey: members.proposer.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [thirdIx],
    }).compileToV0Message();

    const thirdTx = new VersionedTransaction(thirdMessage);

    thirdTx.sign([members.proposer]);

    // Send final transaction.
    const thirdSignature = await connection.sendTransaction(thirdTx, {
      skipPreflight: true,
    });

    await connection.confirmTransaction(thirdSignature);

    const transactionInfo =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
      );

    assert.equal(transactionInfo.message.instructions.length, 28);
  });
});
