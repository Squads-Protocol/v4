import {
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createCreateInstruction } from "./generated";

/** Returns unsigned `VersionedTransaction` that needs to be signed by `creator` before sending it. */
export function create({
  blockhash,
  configAuthority,
  creator,
  members,
  memo,
}: {
  blockhash: string;
  creator: PublicKey;
  configAuthority: PublicKey;
  members: PublicKey[];
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [
      createCreateInstruction(
        { creator: creator },
        {
          args: {
            configAuthority,
            threshold: 1,
            createKey: Keypair.generate().publicKey,
            members,
            memo: memo ?? null,
          },
        }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
