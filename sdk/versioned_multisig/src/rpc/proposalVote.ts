import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

export async function proposalVote({
  connection,
  feePayer,
  member,
  multisigPda,
  proposalPda,
  approve,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  member: Signer;
  multisigPda: PublicKey;
  proposalPda: PublicKey;
  approve: boolean;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.proposalVote({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    proposalPda,
    member: member.publicKey,
    approve,
    programId,
  });

  const transaction = new VersionedTransaction(tx);

  transaction.sign([feePayer, member]);

  try {
    return await connection.sendTransaction(transaction, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
