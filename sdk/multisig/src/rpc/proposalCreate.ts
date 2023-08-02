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
  multisigPda,
  transactionIndex,
  isDraft,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  creator: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  isDraft?: boolean;
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.proposalCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    creator: creator.publicKey,
    isDraft,
  });

  tx.sign([feePayer, creator]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
