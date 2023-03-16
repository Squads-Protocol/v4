import { PublicKey } from "@solana/web3.js";
import { createMultisigSetTimeLockInstruction } from "../generated";

export function multisigSetTimeLock({
  multisigPda,
  configAuthority,
  timeLock,
  memo,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  timeLock: number;
  memo?: string;
}) {
  return createMultisigSetTimeLockInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      // Rent payer won't be used in this instruction.
      rentPayer: configAuthority,
    },
    {
      args: {
        timeLock,
        memo: memo ?? null,
      },
    }
  );
}
