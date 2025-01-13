import {
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionMessage,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { translateAndThrowAnchorError } from "../errors";
import { createTransactionBuffer, createTransactionBufferExtend, createVaultTransactionFromBuffer } from "../instructions";
import * as transactions from "../transactions";

/** Create a new vault transaction. */
export async function vaultTransactionCreate({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  vaultIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  /** Member of the multisig that is creating the transaction. */
  creator: PublicKey;
  /** Payer for the transaction account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
  vaultIndex: number;
  /** Number of ephemeral signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a multisig transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  let { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  let tx = transactions.vaultTransactionCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    creator,
    rentPayer,
    vaultIndex,
    ephemeralSigners,
    transactionMessage,
    addressLookupTableAccounts,
    memo,
    programId,
  });


  // Check if the transaction is too large
  try {
    // If this throws, the transaction is too large
    tx.sign([feePayer, ...(signers ?? [])]);
    if (tx.serialize().length > 1232) throw new Error("Transaction is too large")
  } catch (err) {
    console.log("Transaction is too large, creating buffer...");
    // Create buffer
    const createComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 20000
    })
    const extendComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 30000
    })
    const vaultComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
      units: 100000
    })
    const createComputeUnitPrice = ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: 900_000
    })

    let { instruction, remainingBuffer } = await createTransactionBuffer({
      multisig: multisigPda,
      creator: creator,
      rentPayer: rentPayer ?? creator,
      vaultIndex: vaultIndex,
      transactionMessage: transactionMessage,
      lookupTableAccounts: addressLookupTableAccounts ?? [],
      bufferIndex: 0,
      programId: programId,
    })
    let txMessage = new TransactionMessage({
      payerKey: rentPayer ?? creator,
      recentBlockhash: blockhash,
      instructions: [createComputeUnits, createComputeUnitPrice, instruction],
    }).compileToV0Message()
    let bufferTx = new VersionedTransaction(txMessage)
    bufferTx.sign([feePayer, ...(signers ?? [])])
    const sig = await connection.sendTransaction(bufferTx, sendOptions)
    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed")
    // Wait 1s so the next simulation doesnt fail
    console.log("createBuffer Tx: ", sig)
    while (remainingBuffer.length > 0) {
      let { instruction: extendInstruction, remainingBuffer: newRemainingBuffer } = await createTransactionBufferExtend({
        multisig: multisigPda,
        creator: creator,
        bufferIndex: 0,
        buffer: remainingBuffer,
        programId: programId,
      });
      txMessage = new TransactionMessage({
        payerKey: rentPayer ?? creator,
        recentBlockhash: blockhash,
        instructions: [createComputeUnitPrice, extendComputeUnits, extendInstruction],
      }).compileToV0Message()
      let { blockhash: newBlockhash, lastValidBlockHeight: newLastValidBlockHeight } = await connection.getLatestBlockhash()
      blockhash = newBlockhash
      lastValidBlockHeight = newLastValidBlockHeight
      const extendTx = new VersionedTransaction(txMessage)
      extendTx.sign([feePayer, ...(signers ?? [])])
      const sig = await connection.sendRawTransaction(extendTx.serialize(), { skipPreflight: true })
      console.log("extendTx: ", sig)
      await connection.confirmTransaction({
        signature: sig,
        blockhash,
        lastValidBlockHeight,
      }, "confirmed")
      remainingBuffer = newRemainingBuffer
    }
    const createVaultTransactionFromBufferIx = await createVaultTransactionFromBuffer({
      multisig: multisigPda,
      creator: creator,
      bufferIndex: 0,
      vaultIndex: vaultIndex,
      transactionIndex: transactionIndex,
      ephemeralSigners: ephemeralSigners,
      programId: programId,
    })
    txMessage = new TransactionMessage({
      payerKey: rentPayer ?? creator,
      recentBlockhash: blockhash,
      instructions: [createComputeUnitPrice, vaultComputeUnits, createVaultTransactionFromBufferIx],
    }).compileToV0Message()
    tx = new VersionedTransaction(txMessage)
    tx.sign([feePayer, ...(signers ?? [])])
    const finalSig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    let { blockhash: newBlockhash, lastValidBlockHeight: newLastValidBlockHeight } = await connection.getLatestBlockhash()
    blockhash = newBlockhash
    lastValidBlockHeight = newLastValidBlockHeight
    await connection.confirmTransaction({
      signature: finalSig,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed")
    return sig;
  }
  try {
    const sig = await connection.sendTransaction(tx, { skipPreflight: true });
    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    }, "confirmed")
    return sig;
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
