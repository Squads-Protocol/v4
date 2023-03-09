import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { createMultisigAddMemberInstruction, Member } from "../generated";

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `configAuthority` and `feePayer` before sending it.
 */
export function multisigAddMember({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  newMember: Member;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      createMultisigAddMemberInstruction(
        {
          multisig: multisigPda,
          configAuthority,
          rentPayer,
        },
        { args: { newMember, memo: memo ?? null } }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
