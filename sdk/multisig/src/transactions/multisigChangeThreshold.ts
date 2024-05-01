import { 
    PublicKey, 
    TransactionMessage, 
    VersionedTransaction 
} from "@solana/web3.js";
import {
  PROGRAM_ID,
} from "../generated";
import { instructions } from "..";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `configAuthority` and `rentPayer` before sending it.
 */
export function multisigChangeThreshold({
  blockhash,
  multisigPda,
  configAuthority,
  rentPayer,
  newThreshold,
  memo,
  programId = PROGRAM_ID,
}: {
  blockhash: string;
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  newThreshold: number;
  memo?: string;
  programId?: PublicKey;
}) {
  const message = new TransactionMessage({
    payerKey: rentPayer,
    recentBlockhash: blockhash,
    instructions: [
        instructions.multisigChangeThreshold({
            multisigPda,
            configAuthority,
            rentPayer,
            newThreshold,
            memo,
            programId
        })
    ]
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
