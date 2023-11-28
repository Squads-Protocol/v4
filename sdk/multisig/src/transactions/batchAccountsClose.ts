import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index.js";

export function batchAccountsClose({
  blockhash,
  feePayer,
  multisigPda,
  member,
  rentCollector,
  batchIndex,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  member: PublicKey;
  rentCollector: PublicKey;
  batchIndex: bigint;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.batchAccountsClose({
        multisigPda,
        member,
        rentCollector,
        batchIndex,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
