import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import { translateAndThrowAnchorError } from "../errors";
import * as transactions from "../transactions";
export async function proposalCreate({
  connection,
  feePayer,
  creator,
  rentPayer,
  multisigPda,
  transactionIndex,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  /** Member of the multisig that is creating the proposal. */
  creator: Signer;
  /** Payer for the proposal account rent. If not provided, `creator` is used. */
  rentPayer?: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.proposalCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    creator: creator.publicKey,
    programId,
  });

  const allSigners = [feePayer, creator];
  if (rentPayer) {
    allSigners.push(rentPayer);
  }

  const transaction = new VersionedTransaction(tx);

  transaction.sign(allSigners);

  try {
    return await connection.sendTransaction(transaction, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
