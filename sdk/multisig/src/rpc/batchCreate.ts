import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Create a new vault transactions batch. */
export async function batchCreate({
  connection,
  feePayer,
  multisigPda,
  batchIndex,
  creator,
  rentPayer,
  vaultIndex,
  memo,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  batchIndex: bigint;
  /** Member of the multisig that is creating the batch. */
  creator: Signer;
  /** Payer for the batch account rent. If not provided, `creator` is used. */
  rentPayer?: Signer;
  vaultIndex: number;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.batchCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    batchIndex,
    creator: creator.publicKey,
    rentPayer: rentPayer?.publicKey ?? creator.publicKey,
    vaultIndex,
    memo,
    programId,
  });

  const allSigners = [feePayer, creator];
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
