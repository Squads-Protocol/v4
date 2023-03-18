import { PublicKey } from "@solana/web3.js";
import { getProposalPda } from "../pda";
import { createProposalActivateInstruction } from "../generated";

export function proposalActivate({
  multisigPda,
  transactionIndex,
  member,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
  });

  return createProposalActivateInstruction({
    multisig: multisigPda,
    proposal: proposalPda,
    member,
  });
}
