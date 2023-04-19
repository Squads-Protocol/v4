import { createMultisigAddVaultInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function multisigAddVault({
  multisigPda,
  configAuthority,
  vaultIndex,
  memo,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  vaultIndex: number;
  memo?: string;
}) {
  return createMultisigAddVaultInstruction(
    {
      multisig: multisigPda,
      configAuthority,
    },
    {
      args: {
        vaultIndex,
        memo: memo ?? null,
      },
    }
  );
}
