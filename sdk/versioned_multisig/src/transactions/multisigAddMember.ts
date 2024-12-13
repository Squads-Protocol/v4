import {
  MessageV0,
  PublicKey,
  Signer,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { VersionedMember } from "../generated";
import * as instructions from "../instructions/index";

/**
 * Returns unsigned `VersionedTransaction`.
 */
export function versionedMultisigAddMember({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  newMember: VersionedMember;
  memo?: string;
  programId?: PublicKey;
}): MessageV0 {
  return new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.versionedMultisigAddMember({
        multisigPda,
        configAuthority,
        rentPayer,
        newMember,
        memo,
        programId,
      }),
    ],
  }).compileToV0Message();
}

