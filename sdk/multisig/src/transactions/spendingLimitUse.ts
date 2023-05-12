import * as instructions from "../instructions/index";
import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `member` and `feePayer` before sending it.
 */
export function spendingLimitUse({
  blockhash,
  feePayer,
  multisigPda,
  member,
  spendingLimit,
  mint,
  vaultIndex,
  amount,
  decimals,
  destination,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  member: PublicKey;
  spendingLimit: PublicKey;
  /** Provide if `spendingLimit` is for an SPL token, omit if it's for SOL. */
  mint?: PublicKey;
  vaultIndex: number;
  amount: number;
  decimals: number;
  destination: PublicKey;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.spendingLimitUse({
        multisigPda,
        member,
        spendingLimit,
        mint,
        vaultIndex,
        amount,
        decimals,
        destination,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
