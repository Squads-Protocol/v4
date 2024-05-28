import { PublicKey } from "@solana/web3.js";
import {
  createMultisigChangeThresholdInstruction,
  PROGRAM_ID,
} from "../generated";

export function multisigChangeThreshold({
  multisigPda,
  configAuthority,
  rentPayer,
  newThreshold,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  newThreshold: number;
  memo?: string;
  programId?: PublicKey;
}) {
  return createMultisigChangeThresholdInstruction(
    {
      multisig: multisigPda,
      configAuthority,
      rentPayer,
    },
    {
      args: {
        newThreshold,
        memo: memo ?? null,
      },
    },
    programId
  );
}
