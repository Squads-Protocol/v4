import { getProposalPda } from "../pda";
import { createProposalCancelInstruction, PROGRAM_ID } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function proposalCancel({
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

  return createProposalCancelInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } },
    programId
  );
}
