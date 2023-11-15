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
  rentPayer,
  vaultIndex,
  batchIndex,
  transactionIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  programId,
}: {
  connection: Connection;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  /** Member of the multisig that is creating the transaction. */
  member: PublicKey;
  /** Payer for the transaction account rent. If not provided, `member` is used. */
  rentPayer?: PublicKey;
  vaultIndex: number;
  batchIndex: bigint;
  transactionIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a batch transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  programId?: PublicKey;
}): Promise<VersionedTransaction> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.batchAddTransaction({
        vaultIndex,
        multisigPda,
        member,
        rentPayer,
        batchIndex,
        transactionIndex,
        ephemeralSigners,
        transactionMessage,
        addressLookupTableAccounts,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
