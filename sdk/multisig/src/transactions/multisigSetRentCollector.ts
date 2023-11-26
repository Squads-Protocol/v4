import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `configAuthority` and `feePayer` before sending it.
 */
export function multisigSetRentCollector({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  newRentCollector,
  rentPayer,
  memo,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newRentCollector: PublicKey | null;
  rentPayer: PublicKey;
  memo?: string;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.multisigSetRentCollector({
        multisigPda,
        configAuthority,
        newRentCollector,
        rentPayer,
        memo,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
