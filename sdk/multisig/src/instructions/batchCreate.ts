import { PublicKey } from "@solana/web3.js";
import { createBatchCreateInstruction } from "../generated";
import { getTransactionPda } from "../pda";

export function batchCreate({
  multisigPda,
  creator,
  batchIndex,
  vaultIndex,
  memo,
}: {
  multisigPda: PublicKey;
  creator: PublicKey;
  batchIndex: bigint;
  vaultIndex: number;
  memo?: string;
}) {
  const [batchPda] = getTransactionPda({
    multisigPda,
    index: batchIndex,
  });

  return createBatchCreateInstruction(
    {
      multisig: multisigPda,
      creator,
      batch: batchPda,
    },
    { args: { vaultIndex, memo: memo ?? null } }
  );
}
