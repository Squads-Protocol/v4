import { PublicKey } from "@solana/web3.js";
import { createMultisigSetConfigAuthorityInstruction } from "../generated";

export function multisigSetConfigAuthority({
  multisigPda,
  configAuthority,
  newConfigAuthority,
  memo,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newConfigAuthority: PublicKey;
  memo?: string;
}) {
  return createMultisigSetConfigAuthorityInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      // Rent payer won't be used in this instruction.
      rentPayer: configAuthority,
    },
    {
      args: {
        configAuthority: newConfigAuthority,
        memo: memo ?? null,
      },
    }
  );
}
