import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMultisigRemoveMemberInstruction,
  PROGRAM_ID,
} from "../generated";

export function multisigRemoveMember({
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
  return createMultisigRemoveMemberInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      systemProgram: SystemProgram.programId,
    },
    { args: { oldMember, memo: memo ?? null } },
    programId
  );
}
