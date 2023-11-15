import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `creator` and `feePayer` before sending it.
 */
export async function batchExecuteTransaction({
  connection,
  blockhash,
  feePayer,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  programId,
}: {
  connection: Connection;
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  member: PublicKey;
  batchIndex: bigint;
  transactionIndex: number;
  programId?: PublicKey;
}): Promise<VersionedTransaction> {
  const { instruction, lookupTableAccounts } =
    await instructions.batchExecuteTransaction({
      connection,
      multisigPda,
      member,
      batchIndex,
      transactionIndex,
      programId,
    });

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message(lookupTableAccounts);

  return new VersionedTransaction(message);
}
