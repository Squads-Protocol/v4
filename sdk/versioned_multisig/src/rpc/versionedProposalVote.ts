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
import { PROGRAM_ID } from "../generated";

export async function versionedProposalVote({
  connection,
  multisigPda,
  proposalPda,
  voter,
  approve,
  sendOptions,
  programId,
}: {
  connection: Connection;
  multisigPda: PublicKey;
  proposalPda: PublicKey;
  voter: Signer;
  approve: boolean;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.versionedProposalVote({
    blockhash,
    multisigPda,
    proposalPda,
    voter: voter.publicKey,
    approve,
    programId: programId ?? PROGRAM_ID,
  });

  const transaction = new VersionedTransaction(tx);

  transaction.sign([voter]);

  try {
    return await connection.sendTransaction(transaction, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
} 