import { PublicKey } from "@solana/web3.js";
import { Permissions } from "../types";

export enum SquadPermissions {
  Proposer = 1,
  Voter = 2,
  Executor = 4,
  ProposerAndVoter = 3,
  VoterAndExecutor = 5,
  ProposerAndExecutor = 6,
  All = 7,
}

export function createMembers(
  members: { key: PublicKey; permissions: number }[]
) {
  return members.map((member) => {
    return {
      key: member.key,
      permissions: Permissions.fromMask(member.permissions),
    };
  });
}
