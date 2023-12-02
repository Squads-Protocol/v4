import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index.js";

export function vaultTransactionAccountsClose({
  blockhash,
  feePayer,
  multisigPda,
  rentCollector,
  transactionIndex,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  rentCollector: PublicKey;
  transactionIndex: bigint;
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.vaultTransactionAccountsClose({
        multisigPda,
        rentCollector,
        transactionIndex,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
