import {
  AddressLookupTableAccount,
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
export async function batchAddTransaction({
  connection,
  feePayer,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
}: {
  connection: Connection;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  member: PublicKey;
  batchIndex: bigint;
  transactionIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a batch transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}): Promise<VersionedTransaction> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      await instructions.batchAddTransaction({
        connection,
        multisigPda,
        member,
        batchIndex,
        transactionIndex,
        ephemeralSigners,
        transactionMessage,
        addressLookupTableAccounts,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
