import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Extends an existing transaction buffer. */
export async function transactionBufferExtend({
  connection,
  feePayer,
  multisigPda,
  bufferIndex,
  bufferSlice,
  creator,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  /* Transaction index of the buffer account to extend. */
  bufferIndex: number;
  /* Slice of the buffer to append. It's recommended to update in chunks of 400-750 bytes. */
  bufferSlice: Uint8Array;
  creator: PublicKey;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.transactionBufferExtend({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    bufferIndex,
    bufferSlice,
    creator,
    programId,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
