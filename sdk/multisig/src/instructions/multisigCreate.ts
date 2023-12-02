import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  createMultisigCreateInstruction,
  Member,
  PROGRAM_ID,
} from "../generated";

export function multisigCreate({
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  createKey,
  rentCollector,
  memo,
  programId = PROGRAM_ID,
}: {
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  createKey: PublicKey;
  rentCollector: PublicKey | null;
  memo?: string;
  programId?: PublicKey;
}): TransactionInstruction {
  return createMultisigCreateInstruction(
    {
      creator,
      createKey,
      multisig: multisigPda,
    },
    {
      args: {
        configAuthority,
        threshold,
        members,
        timeLock,
        rentCollector,
        memo: memo ?? null,
      },
    },
    programId
  );
}
