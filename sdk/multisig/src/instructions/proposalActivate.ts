import { PublicKey } from "@solana/web3.js";
import { getProposalPda } from "../pda";
import { createProposalActivateInstruction, PROGRAM_ID } from "../generated";

export function proposalActivate({
  multisigPda,
  transactionIndex,
  member,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  programId?: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId,
  });

  return createProposalActivateInstruction(
    {
      multisig: multisigPda,
      proposal: proposalPda,
      member,
    },
    programId
  );
}
