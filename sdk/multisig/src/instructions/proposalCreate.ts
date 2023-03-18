import { PublicKey } from "@solana/web3.js";
import { createProposalCreateInstruction } from "../generated";
import { getProposalPda } from "../pda";

export function proposalCreate({
  multisigPda,
  rentPayer,
  transactionIndex,
  isDraft = false,
}: {
  multisigPda: PublicKey;
  rentPayer: PublicKey;
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
    { rentPayer, multisig: multisigPda, proposal: proposalPda },
    { args: { transactionIndex: Number(transactionIndex), draft: isDraft } }
  );
}
