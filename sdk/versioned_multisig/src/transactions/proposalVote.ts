  import {
  MessageV0,
  PublicKey,
  Signer,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import * as instructions from "../instructions/index.js";

/**
 * Returns signed `VersionedTransaction`.
 */
export function proposalVote({
  blockhash,
  feePayer,
  multisigPda,
  proposalPda,
  member,
  approve,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  proposalPda: PublicKey;
  member: PublicKey;
  approve: boolean;
  programId?: PublicKey;
}): MessageV0 {
  return new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.proposalVote({
        multisigPda,
        proposalPda,
        member,
        approve,
        programId,
      }),
    ],
  }).compileToV0Message();
}

