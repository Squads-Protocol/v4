import {
  MessageV0,
  PublicKey,
  Signer,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import * as instructions from "../instructions/index.js";

/**
 * Returns unsigned `VersionedTransaction`.
 */
export function proposalCreate({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  payer,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  /** Member of the multisig that is creating the proposal. */
  creator: PublicKey;
  payer: PublicKey;
  programId?: PublicKey;
}): MessageV0 {
  return new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.versionedProposalCreate({
        multisigPda,
        creator,
        transactionIndex,
        programId,
        payer,
      }),
    ],
  }).compileToV0Message();
}

