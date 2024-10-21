import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index.js";

export function transactionBufferExtend({
  blockhash,
  feePayer,
  multisigPda,
  bufferIndex,
  bufferSlice,
  creator,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  bufferIndex: number;
  bufferSlice: Uint8Array;
  creator: PublicKey;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.transactionBufferExtend({
        multisigPda,
        bufferIndex,
        bufferSlice,
        creator,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
