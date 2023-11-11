import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";
import {
  createMultisigAddSpendingLimitInstruction,
  Period,
  PROGRAM_ID,
} from "../generated";

export function multisigAddSpendingLimit({
  multisigPda,
  configAuthority,
  spendingLimit,
  rentPayer,
  createKey,
  vaultIndex,
  mint,
  amount,
  period,
  members,
  destinations,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
  createKey: PublicKey;
  vaultIndex: number;
  mint: PublicKey;
  amount: bigint;
  period: Period;
  members: PublicKey[];
  destinations: PublicKey[];
  memo?: string;
  programId?: PublicKey;
}) {
  return createMultisigAddSpendingLimitInstruction(
    {
      multisig: multisigPda,
      spendingLimit,
      configAuthority,
      rentPayer,
    },
    {
      args: {
        createKey,
        vaultIndex,
        mint,
        amount: new BN(amount.toString()),
        period,
        members,
        destinations,
        memo: memo ?? null,
      },
    },
    programId
  );
}
