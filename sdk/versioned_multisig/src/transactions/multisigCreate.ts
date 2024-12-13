import {
  MessageV0,
  PublicKey,
  Signer,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { VersionedMember } from "../generated";
import * as instructions from "../instructions";

/**
 * Returns unsigned `VersionedTransaction` that needs to be signed by `creator` and `createKey` before sending it.
 */
export function versionedMultisigCreate({
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
  members: VersionedMember[];
  timeLock: number;
  rentCollector: PublicKey | null;
  memo?: string;
  programId?: PublicKey;
}):  MessageV0 {
  const ix = instructions.versionedMultisigCreate({
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

  return new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

}
