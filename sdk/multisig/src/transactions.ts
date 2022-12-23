import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createCreateInstruction, Member } from "./generated";

/** Returns unsigned `VersionedTransaction` that needs to be signed by `creator` before sending it. */
export function create({
  blockhash,
  configAuthority,
  creator,
  multisigPda,
  threshold,
  members,
  createKey,
  allowExternalSigners,
  memo,
}: {
  blockhash: string;
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  threshold: number;
  members: Member[];
  createKey: PublicKey;
  allowExternalSigners?: boolean;
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
            allowExternalSigners: allowExternalSigners ?? null,
            memo: memo ?? null,
          },
        }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
