import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  createMultisigCreateInstruction,
  Member,
  PROGRAM_ID,
} from "../generated";

/** @deprecated This instruction is deprecated and will be removed soon. Please use `multisigCreateV2` to ensure future compatibility. */
export function multisigCreate({
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  createKey,
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
  memo?: string;
  programId?: PublicKey;
}): TransactionInstruction {
  return createMultisigCreateInstruction(
    {
      null: PublicKey.default,
      anchorRemainingAccounts: [
        {
          pubkey: creator,
          isWritable: true,
          isSigner: true,
        },
        {
          pubkey: createKey,
          isWritable: false,
          isSigner: true,
        },
        {
          pubkey: multisigPda,
          isWritable: true,
          isSigner: false,
        },
        {
          pubkey: createKey,
          isWritable: false,
          isSigner: true,
        }
      ]
    },
    programId
  );
}
