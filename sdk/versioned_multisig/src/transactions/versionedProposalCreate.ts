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
  payer,
  transactionIndex,
  programId,
}: {
  blockhash: string;
  multisigPda: PublicKey;
  creator: PublicKey;
  payer: PublicKey;
  transactionIndex: bigint;
  programId: PublicKey;
}): MessageV0 {
  
  const ix = instructions.versionedProposalCreate({
    multisigPda,
    creator,
    transactionIndex,
    programId,
    payer,
  });

  return new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();
} 