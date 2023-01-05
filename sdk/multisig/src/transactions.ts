import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createAddMemberInstruction,
  createCreateInstruction,
  Member,
} from "./generated";

/** Returns unsigned `VersionedTransaction` that needs to be signed by `creator` before sending it. */
export function create({
  blockhash,
  configAuthority,
  creator,
  multisigPda,
  threshold,
  members,
  createKey,
  allowExternalExecute,
  memo,
}: {
  blockhash: string;
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  threshold: number;
  members: Member[];
  createKey: PublicKey;
  allowExternalExecute?: boolean;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [
      createCreateInstruction(
        {
          creator,
          multisig: multisigPda,
        },
        {
          args: {
            configAuthority,
            threshold,
            members,
            createKey,
            allowExternalExecute: allowExternalExecute ?? null,
            memo: memo ?? null,
          },
        }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

export function addMember({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  newMember,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newMember: Member;
  memo?: string;
}) {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      createAddMemberInstruction(
        {
          multisig: multisigPda,
          configAuthority,
        },
        { args: { newMember, memo: memo ?? null } }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
