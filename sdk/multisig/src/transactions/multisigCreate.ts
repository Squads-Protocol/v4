import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { Member } from "../generated";
import * as instructions from "../instructions";

/**
 * @deprecated This instruction is deprecated and will be removed soon. Please use `multisigCreateV2` to ensure future compatibility.
 *
 * Returns unsigned `VersionedTransaction` that needs to be signed by `creator` and `createKey` before sending it.
 */
export function multisigCreate({
  blockhash,
  configAuthority,
  createKey,
  creator,
  multisigPda,
  threshold,
  members,
  timeLock,
  memo,
  programId,
}: {
  blockhash: string;
  createKey: PublicKey;
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  memo?: string;
  programId?: PublicKey;
}): VersionedTransaction {
  const ix = instructions.multisigCreate({
    creator,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    createKey,
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
