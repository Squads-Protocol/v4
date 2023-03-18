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
  vaultIndex,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  batchIndex: bigint;
  creator: Signer;
  vaultIndex: number;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.batchCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    batchIndex,
    creator: creator.publicKey,
    vaultIndex,
    memo,
  });

  tx.sign([feePayer, creator, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
