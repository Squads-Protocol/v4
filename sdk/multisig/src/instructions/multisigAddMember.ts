import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createMultisigAddMemberInstruction, Member } from "../generated";

export function multisigAddMember({
  multisigPda,
  configAuthority,
  rentPayer,
  newMember,
  memo,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  newMember: Member;
  memo?: string;
}) {
  return createMultisigAddMemberInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      rentPayer,
      systemProgram: SystemProgram.programId,
    },
    { args: { newMember, memo: memo ?? null } }
  );
}
