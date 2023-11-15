import { getProposalPda } from "../pda";
import { createProposalApproveInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function proposalApprove({
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
  programId?: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId,
  });

  return createProposalApproveInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } },
    programId
  );
}
