import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Period } from "../generated";
import * as instructions from "../instructions/index";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `configAuthority` and `feePayer` before sending it.
 */
export function multisigRemoveSpendingLimit({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentCollector: PublicKey;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.multisigRemoveSpendingLimit({
        configAuthority,
        multisigPda,
        spendingLimit,
        rentCollector,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
