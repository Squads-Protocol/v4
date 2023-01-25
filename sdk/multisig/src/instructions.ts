import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createMultisigCreateInstruction, Member } from "./generated";

export function multisigCreate({
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  createKey,
  memo,
}: {
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  threshold: number;
  members: Member[];
  createKey: PublicKey;
  memo?: string;
}): TransactionInstruction {
  return createMultisigCreateInstruction(
    {
      creator,
      multisig: multisigPda,
    },
    {
      args: {
        configAuthority,
        threshold,
        members,
        createKey,
        memo: memo ?? null,
      },
    }
  );
}
