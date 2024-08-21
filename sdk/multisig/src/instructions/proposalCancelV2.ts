import { getProposalPda } from "../pda";
import { createProposalCancelV2Instruction, PROGRAM_ID } from "../generated";
import { PublicKey } from "@solana/web3.js";

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
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } },
    programId
  );
}
