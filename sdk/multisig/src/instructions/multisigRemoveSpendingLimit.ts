import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  createMultisigRemoveSpendingLimitInstruction,
  Period,
} from "../generated";

export function multisigRemoveSpendingLimit({
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
}: {
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentCollector: PublicKey;
  memo?: string;
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
    }
  );
}
