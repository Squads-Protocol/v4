import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `creator` and `feePayer` before sending it.
 */
export function batchCreate({
  blockhash,
  feePayer,
  multisigPda,
  batchIndex,
  creator,
  vaultIndex,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  batchIndex: bigint;
  creator: PublicKey;
  vaultIndex: number;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.batchCreate({
        multisigPda,
        creator,
        batchIndex,
        vaultIndex,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
