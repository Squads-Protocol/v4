import {
  MessageV0,
  PublicKey,
  TransactionMessage
} from "@solana/web3.js";
import * as instructions from "../instructions";

export function versionedProposalVote({
  blockhash,
  multisigPda,
  proposalPda,
  voter,
  approve,
  programId,
}: {
  blockhash: string;
  multisigPda: PublicKey;
  proposalPda: PublicKey;
  voter: PublicKey;
  approve: boolean;
  programId: PublicKey;
}): MessageV0 {
  const ix = instructions.proposalVote({
    multisigPda,
    proposalPda,
    member: voter,
    approve,
    programId,
  });

  return new TransactionMessage({
    payerKey: voter,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

} 