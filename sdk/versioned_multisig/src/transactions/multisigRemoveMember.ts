import {
  MessageV0,
  PublicKey,
  Signer,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index";

/**
 * Returns unsigned `VersionedTransaction`.
 */
export function multisigRemoveMember({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  oldMember,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  oldMember: PublicKey;
  programId?: PublicKey;
}):  MessageV0 {
  return new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.versionedMultisigRemoveMember({
        multisigPda,
        configAuthority,
        oldMember,
        programId,
      }),
    ],
  }).compileToV0Message();

}
