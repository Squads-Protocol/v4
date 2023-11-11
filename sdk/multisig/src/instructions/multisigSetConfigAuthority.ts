import { PublicKey } from "@solana/web3.js";
import { createMultisigSetConfigAuthorityInstruction } from "../generated";

export function multisigSetConfigAuthority({
  multisigPda,
  configAuthority,
  newConfigAuthority,
  memo,
  programId,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newConfigAuthority: PublicKey;
  memo?: string;
  programId?: PublicKey;
}) {
  return createMultisigSetConfigAuthorityInstruction(
    {
      multisig: multisigPda,
      configAuthority,
    },
    {
      args: {
        configAuthority: newConfigAuthority,
        memo: memo ?? null,
      },
    },
    programId
  );
}
