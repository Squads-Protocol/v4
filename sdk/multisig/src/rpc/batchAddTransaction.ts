import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionMessage,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Add a transaction to a batch. */
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
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  /** Member of the multisig that is adding the transaction. */
  member: Signer;
  /** Payer for the transaction account rent. If not provided, `member` is used. */
  rentPayer?: Signer;
  vaultIndex: number;
  batchIndex: bigint;
  transactionIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a batch transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const tx = await transactions.batchAddTransaction({
    connection,
    feePayer: feePayer.publicKey,
    multisigPda,
    member: member.publicKey,
    rentPayer: rentPayer?.publicKey ?? member.publicKey,
    vaultIndex,
    batchIndex,
    transactionIndex,
    ephemeralSigners,
    transactionMessage,
    addressLookupTableAccounts,
    programId,
  });

  const allSigners = [feePayer, member];
  if (signers) {
    allSigners.push(...signers);
  }
  if (rentPayer) {
    allSigners.push(rentPayer);
  }
  tx.sign(allSigners);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
