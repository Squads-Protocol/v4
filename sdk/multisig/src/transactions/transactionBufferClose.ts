import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index.js";

/* Closes a transaction buffer. */
export function transactionBufferClose({
  blockhash,
  feePayer,
  multisigPda,
  bufferIndex,
  creator,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  /* Transaction index of the buffer account to close. */
  bufferIndex: number;
  creator: PublicKey;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.transactionBufferClose({
        multisigPda,
        bufferIndex,
        creator,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
