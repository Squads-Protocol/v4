import { getProposalPda } from "../pda";
import { createProposalApproveInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function proposalApprove({
  multisigPda,
  transactionIndex,
  member,
  memo,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
  });

  return createProposalApproveInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } }
  );
}
