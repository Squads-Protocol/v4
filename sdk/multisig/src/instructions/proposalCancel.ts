import { getProposalPda } from "../pda";
import { createProposalCancelInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function proposalCancel({
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

  return createProposalCancelInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } }
  );
}
