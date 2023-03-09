import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { ConfigAction } from "../generated";
import * as instructions from "../instructions";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `creator` and `feePayer` before sending it.
 */
export function configTransactionCreate({
  blockhash,
  feePayer,
  creator,
  multisigPda,
  transactionIndex,
  actions,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  creator: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  actions: ConfigAction[];
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.configTransactionCreate({
        creator,
        multisigPda,
        transactionIndex,
        actions,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
