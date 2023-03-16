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
  rentPayer,
  multisigPda,
  transactionIndex,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  rentPayer: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.proposalCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    rentPayer: rentPayer.publicKey,
  });

  tx.sign([feePayer, rentPayer]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
