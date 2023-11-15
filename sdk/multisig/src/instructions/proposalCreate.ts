import { PublicKey } from "@solana/web3.js";
import { createProposalCreateInstruction, PROGRAM_ID } from "../generated";
import { getProposalPda } from "../pda";

export function proposalCreate({
  multisigPda,
  creator,
  rentPayer,
  transactionIndex,
  isDraft = false,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  /** Member of the multisig that is creating the proposal. */
  creator: PublicKey;
  /** Payer for the proposal account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
  transactionIndex: bigint;
  isDraft?: boolean;
  programId?: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId,
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
    { args: { transactionIndex: Number(transactionIndex), draft: isDraft } },
    programId
  );
}
