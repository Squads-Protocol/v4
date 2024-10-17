import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index.js";

/** Convert the final buffer contents into a VaultTransaction. */
export function vaultTransactionCreateFromBuffer({
  blockhash,
  feePayer,
  multisigPda,
  bufferIndex,
  creator,
  memo,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  /* Transaction index of the buffer account to convert. */
  bufferIndex: number;
  creator: PublicKey;
  memo?: string;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.vaultTransactionCreateFromBuffer({
        multisigPda,
        bufferIndex,
        creator,
        memo,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
