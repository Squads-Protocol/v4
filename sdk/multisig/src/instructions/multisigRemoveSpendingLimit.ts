import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  createMultisigRemoveSpendingLimitInstruction,
  Period,
  PROGRAM_ID,
} from "../generated";

export function multisigRemoveSpendingLimit({
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentCollector: PublicKey;
  memo?: string;
  programId?: PublicKey;
}) {
  return createMultisigRemoveSpendingLimitInstruction(
    {
      multisig: multisigPda,
      spendingLimit: spendingLimit,
      configAuthority: configAuthority,
      rentCollector: rentCollector,
    },
    {
      args: {
        memo: memo ?? null,
      },
    },
    programId
  );
}
