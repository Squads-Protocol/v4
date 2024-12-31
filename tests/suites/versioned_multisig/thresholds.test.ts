import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";
import {
    createLocalhostConnection,
    generateFundedKeypair,
    getTestProgramConfigInitializer,
} from "../../utils";
import assert from "assert";

import * as versionedMultisig from "../../../sdk/versioned_multisig";
import { ProgramConfig } from "../../../sdk/versioned_multisig/lib/accounts";
import { Permissions, VersionedMember } from "../../../sdk/versioned_multisig/lib/types";
import { getVersionedTestProgramId } from "./versioned-utils";
import { VersionedMultisigTestHelper } from "../../helpers/versioned-multisig";

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig Thresholds", () => {
    let programConfig: ProgramConfig;
    let helper: VersionedMultisigTestHelper;
    let multisigPda: PublicKey;
    let defaultMembers: (VersionedMember & {keyPair: Keypair})[];
    let creator: Keypair;
    let signers: Keypair[];

    before(async () => {
        const programConfigPda = versionedMultisig.getProgramConfigPda({ programId })[0];
        programConfig = await versionedMultisig.accounts.ProgramConfig.fromAccountAddress(
            connection,
            programConfigPda
        );
        helper = new VersionedMultisigTestHelper(connection);
        signers = [getTestProgramConfigInitializer()];
    });

    describe("Threshold Calculations", () => {
        it("Calculates correct threshold for original members", async () => {
            // Create multisig with 5 members and threshold of 3
            defaultMembers = helper.generateMembers(5, Permissions.all(), 0);
            const threshold = 3;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                defaultMembers,
                threshold
            );

            // Create proposal and verify it needs exactly 3 votes
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // Get two votes (not enough for threshold)
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            let proposal = await helper.getVersionedProposal(multisigPda, 0);
            assert(!proposal.approved, "Proposal should not be approved with only 2 votes");

            // Add third vote to meet threshold
            const thirdMember = defaultMembers[2];
            await helper.airdrop(thirdMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, thirdMember.keyPair, true);

            proposal = await helper.getVersionedProposal(multisigPda, 0);
            assert(proposal.approved, "Proposal should be approved with 3 votes");
        });

        it("Maintains threshold when members added", async () => {
            // Create multisig with 3 members and threshold of 2
            defaultMembers = helper.generateMembers(3, Permissions.all(), 0);
            const threshold = 2;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                defaultMembers,
                threshold
            );

            // Add two new members
            const newMembers = helper.generateMembers(2, Permissions.all(), 1);
            for (const member of newMembers) {
                await helper.addVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    member,
                    signers
                );
            }

            // Create proposal and verify original threshold still applies
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Get two votes from original members
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            const proposal = await helper.getVersionedProposal(multisigPda, 1);
            assert(proposal.approved, "Proposal should be approved with original threshold");
        });

        it("Maintains threshold when members removed", async () => {
            // Create multisig with 5 members and threshold of 3
            defaultMembers = helper.generateMembers(5, Permissions.all(), 0);
            const threshold = 3;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                defaultMembers,
                threshold
            );

            // Remove two members
            for (let i = 0; i < 2; i++) {
                await helper.removeVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    defaultMembers[i].key,
                    signers
                );
            }

            // Create proposal and verify it still needs 3 votes
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // Get three votes from remaining members
            for (let i = 2; i < 5; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            const proposal = await helper.getVersionedProposal(multisigPda, 0);
            assert(proposal.approved, "Proposal should be approved with original threshold");
        });
    });

    describe("Threshold Edge Cases", () => {
        it("Handles threshold with minimum members", async () => {
            // Create multisig with 2 members (minimum) and threshold of 2
            defaultMembers = helper.generateMembers(2, Permissions.all(), 0);
            const threshold = 2;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                defaultMembers,
                threshold
            );

            // Create proposal and verify both members must vote
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // First vote
            await helper.airdrop(defaultMembers[0].keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, defaultMembers[0].keyPair, true);

            let proposal = await helper.getVersionedProposal(multisigPda, 0);
            assert(!proposal.approved, "Proposal should not be approved with only 1 vote");

            // Second vote
            await helper.airdrop(defaultMembers[1].keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, defaultMembers[1].keyPair, true);

            proposal = await helper.getVersionedProposal(multisigPda, 0);
            assert(proposal.approved, "Proposal should be approved with all members voting");
        });

        it("Maintains proposal-specific thresholds", async () => {
            // Create multisig with 5 members and threshold of 3
            defaultMembers = helper.generateMembers(5, Permissions.all(), 0);
            const threshold = 3;
            
            const { multisigPda } = await helper.createVersionedMultisig(
                defaultMembers,
                threshold
            );

            // Create first proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda: proposal1 } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // Remove two members
            for (let i = 0; i < 2; i++) {
                await helper.removeVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    defaultMembers[i].key,
                    signers
                );
            }

            // Create second proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda: proposal2 } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Vote on both proposals with remaining members
            for (let i = 2; i < 5; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposal1, member.keyPair, true);
                await helper.vote(multisigPda, proposal2, member.keyPair, true);
            }

            // Verify both proposals are approved with same threshold
            const proposal1Data = await helper.getVersionedProposal(multisigPda, 0);
            const proposal2Data = await helper.getVersionedProposal(multisigPda, 1);
            assert(proposal1Data.approved && proposal2Data.approved, "Both proposals should be approved with same threshold");
        });
    });
}); 