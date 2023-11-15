import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMultisigAddMemberInstruction,
  Member,
  PROGRAM_ID,
} from "../generated";

export function multisigAddMember({
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
  newMember: Member;
  memo?: string;
  programId?: PublicKey;
}) {
  return createMultisigAddMemberInstruction(
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
