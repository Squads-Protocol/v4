import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  createCreateVersionedMultisigInstruction,
  VersionedMember,
  PROGRAM_ID,
} from "../generated";
import { getProgramConfigPda } from "../pda";

export function versionedMultisigCreate({
  treasury,
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
  treasury: PublicKey;
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: VersionedMember[];
  timeLock: number;
  createKey: PublicKey;
  rentCollector: PublicKey | null;
  memo?: string;
  programId?: PublicKey;
}): TransactionInstruction {
  const programConfigPda = getProgramConfigPda({ programId })[0];

  return createCreateVersionedMultisigInstruction(
    {
      programConfig: programConfigPda,
      treasury,
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
