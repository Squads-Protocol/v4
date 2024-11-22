import { PublicKey } from "@solana/web3.js";
import { createProposalCancelV2Instruction, PROGRAM_ID } from "../generated";
import { getProposalPda } from "../pda";

export function proposalCancelV2({
  multisigPda,
  transactionIndex,
  member,
  memo,
  programId = PROGRAM_ID,
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

  return createProposalCancelV2Instruction(
    { proposalVoteItemMultisig: multisigPda, proposalVoteItemProposal: proposalPda, proposalVoteItemMember: member },
    { args: { memo: memo ?? null } },
    programId
  );
}
