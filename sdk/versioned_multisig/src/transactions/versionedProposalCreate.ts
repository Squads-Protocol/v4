import {
  MessageV0,
  PublicKey,
  TransactionMessage
} from "@solana/web3.js";
import * as instructions from "../instructions";

export function versionedProposalCreate({
  blockhash,
  multisigPda,
  creator,
  transactionIndex,
  programId,
}: {
  blockhash: string;
  multisigPda: PublicKey;
  creator: PublicKey;
  transactionIndex: bigint;
  programId: PublicKey;
}): MessageV0 {
  
  const ix = instructions.versionedProposalCreate({
    multisigPda,
    creator,
    transactionIndex,
    programId,
  });

  return new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();
} 