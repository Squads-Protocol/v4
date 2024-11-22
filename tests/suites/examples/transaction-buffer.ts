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
  VaultTransactionCreateFromBufferInstructionArgs,
} from "@sqds/multisig/lib/generated";
import assert from "assert";
import * as crypto from "crypto";
import {
  TestMembers,
  createAutonomousMultisigV2,
  createLocalhostConnection,
  createTestTransferInstruction,
  generateMultisigMembers,
  getTestProgramId
} from "../../utils";

const programId = getTestProgramId();

describe("Examples / Transaction Buffers", () => {
  const connection = createLocalhostConnection();

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

  before(async () => {
    members = await generateMultisigMembers(connection);

    multisigPda = (
      await createAutonomousMultisigV2({
        connection,
        members: members,
        createKey: createKey,
        threshold: 1,
        timeLock: 0,
        programId,
        rentCollector: vaultPda,
      })
    )[0];

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

    const testIx = createTestTransferInstruction(vaultPda, vaultPda, 1);

    let instructions = [];

    // Add 32 transfer instructions to the message.
    for (let i = 0; i <= 22; i++) {
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
        members.almighty.publicKey.toBuffer(),
        Buffer.from([bufferIndex])
      ],
      programId
    );

    const messageHash = crypto
      .createHash("sha256")
      .update(messageBuffer)
      .digest();

    // Slice the message buffer into two parts.
    const firstSlice = messageBuffer.slice(0, 400);

    const ix = multisig.generated.createTransactionBufferCreateInstruction(
      {
        multisig: multisigPda,
        transactionBuffer,
        creator: members.almighty.publicKey,
        rentPayer: members.almighty.publicKey,
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
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [ix],
    }).compileToV0Message();

    const tx = new VersionedTransaction(message);

    tx.sign([members.almighty]);

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
    assert.equal(txBufferDeser1.buffer.length, 400);

    const secondSlice = messageBuffer.slice(400, messageBuffer.byteLength);

    // Extned the buffer.
    const secondIx =
      multisig.generated.createTransactionBufferExtendInstruction(
        {
          multisig: multisigPda,
          transactionBuffer,
          creator: members.almighty.publicKey,
        },
        {
          args: {
            buffer: secondSlice,
          } as TransactionBufferExtendArgs,
        } as TransactionBufferExtendInstructionArgs,
        programId
      );

    const secondMessage = new TransactionMessage({
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [secondIx],
    }).compileToV0Message();

    const secondTx = new VersionedTransaction(secondMessage);

    secondTx.sign([members.almighty]);

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
      await multisig.generated.TransactionBuffer.fromAccountInfo(
        transactionBufferInfo2!
      );

    // Full buffer uploaded. Check that length is as expected.
    assert.equal(txBufferDeser2.buffer.length, messageBuffer.byteLength);

    // Derive vault transaction PDA.
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
    // Create final instruction.
    const thirdIx =
      multisig.generated.createVaultTransactionCreateFromBufferInstruction(
        {
          vaultTransactionCreateItemMultisig: multisigPda,
          vaultTransactionCreateItemTransaction: transactionPda,
          vaultTransactionCreateItemCreator: members.almighty.publicKey,
          vaultTransactionCreateItemRentPayer: members.almighty.publicKey,
          vaultTransactionCreateItemSystemProgram: SystemProgram.programId,
          creator: members.almighty.publicKey,
          transactionBuffer: transactionBuffer,
        },
        {
          args: {
            vaultIndex: 0,
            transactionMessage: new Uint8Array(6).fill(0),
            ephemeralSigners: 0,
            memo: null,
          } as VaultTransactionCreateArgs,
        } as VaultTransactionCreateFromBufferInstructionArgs,
        programId
      );

    // Add third instruction to the message.
    const thirdMessage = new TransactionMessage({
      payerKey: members.almighty.publicKey,
      recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
      instructions: [thirdIx],
    }).compileToV0Message();

    const thirdTx = new VersionedTransaction(thirdMessage);

    thirdTx.sign([members.almighty]);

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

    // Ensure final vault transaction has 23 instructions
    assert.equal(transactionInfo.message.instructions.length, 23);
  });

  it("create proposal, approve, execute from buffer derived transaction", async () => {
    const transactionIndex = 1n;

    // Derive vault transaction PDA.
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
      programId,
    });

    const transactionInfo =
      await multisig.accounts.VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
      );

    // Check that we're dealing with the same account from last test.
    assert.equal(transactionInfo.message.instructions.length, 23);

    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
      programId,
    });

    const signature = await multisig.rpc.proposalCreate({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      creator: members.almighty,
      isDraft: false,
      programId,
    });
    await connection.confirmTransaction(signature);

    const signature3 = await multisig.rpc.proposalApprove({
      connection,
      feePayer: members.almighty,
      multisigPda,
      transactionIndex,
      member: members.almighty,
      programId,
    });
    await connection.confirmTransaction(signature3);

    // Fetch the proposal account.
    let proposalAccount1 = await multisig.accounts.Proposal.fromAccountAddress(
      connection,
      proposalPda
    );

    const ix = await multisig.instructions.vaultTransactionExecute({
      connection,
      multisigPda,
      transactionIndex,
      member: members.almighty.publicKey,
      programId,
    });

    const tx = new Transaction().add(ix.instruction);
    const signature4 = await connection.sendTransaction(
      tx,
      [members.almighty],
      { skipPreflight: true }
    );

    await connection.confirmTransaction(signature4);

    // Fetch the proposal account.
    let proposalAccount = await multisig.accounts.Proposal.fromAccountAddress(
      connection,
      proposalPda
    );

    // Check status.
    assert.equal(proposalAccount.status.__kind, "Executed");
  });
});
