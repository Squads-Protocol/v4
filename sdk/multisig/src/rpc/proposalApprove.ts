import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

export async function proposalApprove({
  connection,
  feePayer,
  member,
  multisigPda,
  transactionIndex,
  memo,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  member: Signer;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  memo?: string;
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.proposalApprove({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    transactionIndex,
    member: member.publicKey,
    memo,
  });

  tx.sign([feePayer, member]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
