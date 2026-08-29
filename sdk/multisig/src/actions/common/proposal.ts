import { instructions } from "../..";
import { PROGRAM_ID } from "../../generated";
import {
  CreateProposalActionArgs,
  ProposalResult,
  VoteActionArgs,
} from "./types";

export function createProposalCore(
  args: CreateProposalActionArgs
): ProposalResult {
  const {
    multisig,
    creator,
    transactionIndex,
    rentPayer,
    isDraft = false,
    programId = PROGRAM_ID,
  } = args;

  const ix = instructions.proposalCreate({
    multisigPda: multisig,
    transactionIndex: BigInt(transactionIndex),
    creator: creator,
    isDraft,
    rentPayer,
    programId: programId,
  });

  return {
    instruction: ix,
  };
}

export function createApprovalCore(args: VoteActionArgs): ProposalResult {
  const { multisig, member, transactionIndex, programId = PROGRAM_ID } = args;

  const ix = instructions.proposalApprove({
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(transactionIndex),
    programId: programId,
  });

  return {
    instruction: ix,
  };
}

export function createRejectionCore(args: VoteActionArgs): ProposalResult {
  const { multisig, member, transactionIndex, programId = PROGRAM_ID } = args;

  const ix = instructions.proposalReject({
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(transactionIndex),
    programId: programId,
  });

  return {
    instruction: ix,
  };
}
