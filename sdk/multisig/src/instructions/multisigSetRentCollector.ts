import { PublicKey, SystemProgram } from "@solana/web3.js";
import { createMultisigSetRentCollectorInstruction } from "../generated";

export function multisigSetRentCollector({
  multisigPda,
  configAuthority,
  newRentCollector,
  rentPayer,
  memo,
  programId,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newRentCollector: PublicKey | null;
  rentPayer: PublicKey;
  memo?: string;
  programId?: PublicKey;
}) {
  return createMultisigSetRentCollectorInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      rentPayer,
      systemProgram: SystemProgram.programId,
    },
    {
      args: {
        rentCollector: newRentCollector,
        memo: memo ?? null,
      },
    },
    programId
  );
}
