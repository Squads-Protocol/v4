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
  rentPayer,
  vaultIndex,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  batchIndex: bigint;
  /** Member of the multisig that is creating the batch. */
  creator: PublicKey;
  /** Payer for the batch account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
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
        rentPayer: rentPayer ?? creator,
        batchIndex,
        vaultIndex,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
