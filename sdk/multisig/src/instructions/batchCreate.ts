import { PublicKey } from "@solana/web3.js";
import { createBatchCreateInstruction } from "../generated";
import { getTransactionPda } from "../pda";

export function batchCreate({
  multisigPda,
  creator,
  rentPayer,
  batchIndex,
  vaultIndex,
  memo,
}: {
  multisigPda: PublicKey;
  /** Member of the multisig that is creating the batch. */
  creator: PublicKey;
  /** Payer for the batch account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
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
      rentPayer: rentPayer ?? creator,
      batch: batchPda,
    },
    { args: { vaultIndex, memo: memo ?? null } }
  );
}
