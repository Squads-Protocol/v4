import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import * as instructions from "../instructions/index.js";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `member` and `feePayer` before sending it.
 */
export function proposalCreate({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  isDraft,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  creator: PublicKey;
  isDraft?: boolean;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.proposalCreate({
        multisigPda,
        creator,
        transactionIndex,
        isDraft,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
