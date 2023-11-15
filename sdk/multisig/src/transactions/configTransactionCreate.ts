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
  rentPayer,
  multisigPda,
  transactionIndex,
  actions,
  memo,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  /** Member of the multisig that is creating the transaction. */
  creator: PublicKey;
  /** Payer for the transaction account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  actions: ConfigAction[];
  memo?: string;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.configTransactionCreate({
        creator,
        rentPayer,
        multisigPda,
        transactionIndex,
        actions,
        memo,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
