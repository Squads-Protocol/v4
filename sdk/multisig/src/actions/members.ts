import { PublicKey } from "@solana/web3.js";
import { Member, Permission, Permissions } from "../types";

export enum SquadPermissions {
  Proposer = 1,
  Voter = 2,
  Executor = 4,
  ProposerAndVoter = 3,
  VoterAndExecutor = 5,
  ProposerAndExecutor = 6,
  All = 7,
}

export function createMember(member: {
  key: PublicKey;
  permissions: SquadPermissions;
}) {
  return {
    key: member.key,
    permissions: Permissions.fromMask(member.permissions) as Permissions,
  } as Member;
}

export function createMembers(
  members: { key: PublicKey; permissions: SquadPermissions }[]
) {
  return members.map((member) => {
    return {
      key: member.key,
      permissions: Permissions.fromMask(member.permissions) as Permissions,
    };
  }) as Member[];
}
