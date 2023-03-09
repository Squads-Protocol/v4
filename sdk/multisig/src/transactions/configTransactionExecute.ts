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
export function configTransactionExecute({
  blockhash,
  feePayer,
  member,
  rentPayer,
  multisigPda,
  transactionIndex,
}: {
  blockhash: string;
  feePayer: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  rentPayer: PublicKey;
  multisigPda: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.configTransactionExecute({
        multisigPda,
        transactionIndex,
        member,
        rentPayer,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
