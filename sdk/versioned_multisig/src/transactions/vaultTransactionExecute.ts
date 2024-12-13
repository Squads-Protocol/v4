import {
  Connection,
  MessageV0,
  PublicKey,
  Signer,
  TransactionMessage,
} from "@solana/web3.js";
import * as instructions from "../instructions";

/**
 * Returns signed `VersionedTransaction`.
 */
export async function vaultTransactionExecute({
  connection,
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  programId,
}: {
  connection: Connection;
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  programId?: PublicKey;
}): Promise<MessageV0> {
  const { instruction, lookupTableAccounts } =
    await instructions.vaultTransactionExecute({
      connection,
      multisigPda,
      transactionIndex,
      member,
      programId,
    });

  return new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [instruction],
  }).compileToV0Message(lookupTableAccounts);
}
