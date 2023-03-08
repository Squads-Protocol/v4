import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createMultisigCreateInstruction, Member } from "../generated";

export function multisigCreate({
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  createKey,
  memo,
}: {
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  createKey: PublicKey;
  memo?: string;
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
        memo: memo ?? null,
      },
    }
  );
}
