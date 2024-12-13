import { getProposalPda } from "../pda";
import { createVoteOnVersionedProposalInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function proposalVote({
  multisigPda,
  proposalPda,
  member,
  approve,
  programId,
}: {
  multisigPda: PublicKey;
  proposalPda: PublicKey;
  member: PublicKey;
  approve: boolean;
  programId?: PublicKey;
}) {

  return createVoteOnVersionedProposalInstruction(
    { multisig: multisigPda, proposal: proposalPda, voter: member },
    { approve },
    programId
  );
}

