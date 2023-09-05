import { PublicKey } from "@solana/web3.js";
import { createProposalCreateInstruction } from "../generated";
import { getProposalPda } from "../pda";

export function proposalCreate({
  multisigPda,
  creator,
  rentPayer,
  transactionIndex,
  isDraft = false,
}: {
  multisigPda: PublicKey;
  /** Member of the multisig that is creating the proposal. */
  creator: PublicKey;
  /** Payer for the proposal account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
  transactionIndex: bigint;
  isDraft?: boolean;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
  });

  if (transactionIndex > Number.MAX_SAFE_INTEGER) {
    throw new Error("transactionIndex is too large");
  }

  return createProposalCreateInstruction(
    {
      creator,
      rentPayer: rentPayer ?? creator,
      multisig: multisigPda,
      proposal: proposalPda,
    },
    { args: { transactionIndex: Number(transactionIndex), draft: isDraft } }
  );
}
