import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createAddMemberInstruction,
  VersionedMember,
  PROGRAM_ID,
} from "../generated";

export function versionedMultisigAddMember({
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  newMember: VersionedMember;
  memo?: string;
  programId?: PublicKey;
}) {
  return createAddMemberInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      rentPayer,
      systemProgram: SystemProgram.programId,
    },
    { args: { newMember, memo: memo ?? null } },
    programId
  );
}
