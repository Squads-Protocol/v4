import { getProposalPda } from "../pda";
import { createProposalRejectInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function proposalReject({
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

  return createProposalRejectInstruction(
    { multisig: multisigPda, proposal: proposalPda, member },
    { args: { memo: memo ?? null } }
  );
}
