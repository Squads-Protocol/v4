import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createRemoveMemberInstruction,
  PROGRAM_ID,
} from "../generated";

export function versionedMultisigRemoveMember({
  multisigPda,
  configAuthority,
  oldMember,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  oldMember: PublicKey;
  memo?: string;
  programId?: PublicKey;
}) {
  return createRemoveMemberInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      systemProgram: SystemProgram.programId,
    },
    { args: { oldMember, memo: memo ?? null } },
    programId
  );
}
