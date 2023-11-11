import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

export async function proposalCreate({
  connection,
  feePayer,
  creator,
  rentPayer,
  multisigPda,
  transactionIndex,
  isDraft,
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
  isDraft?: boolean;
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
    isDraft,
    programId,
  });

  const allSigners = [feePayer, creator];
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
