import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Member } from "../generated";
import * as instructions from "../instructions";

/**
 * Returns unsigned `VersionedTransaction` that needs to be signed by `creator` and `createKey` before sending it.
 */
export function multisigCreateV2({
  blockhash,
  treasury,
  configAuthority,
  createKey,
  creator,
  multisigPda,
  threshold,
  members,
  timeLock,
  rentCollector,
  memo,
  programId,
}: {
  blockhash: string;
  treasury: PublicKey;
  createKey: PublicKey;
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  rentCollector: PublicKey | null;
  memo?: string;
  programId?: PublicKey;
}): VersionedTransaction {
  const ix = instructions.multisigCreateV2({
    treasury,
    creator,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    createKey,
    rentCollector,
    memo,
    programId,
  });

  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
