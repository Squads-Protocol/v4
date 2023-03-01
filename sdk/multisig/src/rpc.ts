import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionMessage,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "./transactions.js";
import { Member } from "./generated";
import { translateAndThrowAnchorError } from "./errors";

/** Creates a new multisig. */
export async function multisigCreate({
  connection,
  createKey,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  memo,
  sendOptions,
}: {
  connection: Connection;
  createKey: Signer;
  creator: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  threshold: number;
  members: Member[];
  memo?: string;
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigCreate({
    blockhash,
    createKey: createKey.publicKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    memo,
  });

  tx.sign([creator, createKey]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

/** Add a member/key to the multisig and reallocate space if necessary. */
export async function multisigAddMember({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  newMember,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newMember: Member;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigAddMember({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    newMember,
    memo,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

/** Create a new transaction. */
export async function transactionCreate({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  authorityIndex,
  additionalSigners,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  creator: PublicKey;
  authorityIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  additionalSigners: number;
  /** Transaction message to wrap into a multisig transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.transactionCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    creator,
    authorityIndex,
    additionalSigners,
    transactionMessage,
    addressLookupTableAccounts,
    memo,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

/**
 * Approve the transaction on behalf of the `member`.
 * The transaction must be `Active`.
 */
export async function transactionApprove({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.transactionApprove({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member,
    memo,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

/**
 * Reject the transaction on behalf of the `member`.
 * The transaction must be `Active`.
 */
export async function transactionReject({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.transactionReject({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member,
    memo,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

/**
 *  Execute the multisig transaction.
 *  The transaction must be `ExecuteReady`.
 */
export async function transactionExecute({
  connection,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = await transactions.transactionExecute({
    connection,
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
