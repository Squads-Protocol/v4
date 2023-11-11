import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Period } from "../generated";
import * as instructions from "../instructions/index";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `configAuthority`, `rent_payer` and `feePayer` before sending it.
 */
export function multisigAddSpendingLimit({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentPayer,
  createKey,
  vaultIndex,
  mint,
  amount,
  period,
  members,
  destinations,
  memo,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  createKey: PublicKey;
  vaultIndex: number;
  mint: PublicKey;
  amount: bigint;
  period: Period;
  members: PublicKey[];
  destinations: PublicKey[];
  memo?: string;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.multisigAddSpendingLimit({
        configAuthority,
        multisigPda,
        spendingLimit,
        rentPayer,
        createKey,
        vaultIndex,
        mint,
        amount,
        period,
        members,
        destinations,
        memo,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
