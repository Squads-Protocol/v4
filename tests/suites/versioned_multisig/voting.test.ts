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

describe("Versioned Multisig Voting", () => {
    let programConfig: ProgramConfig;
    let helper: VersionedMultisigTestHelper;
    let multisigPda: PublicKey;
    let defaultMembers: (VersionedMember & {keyPair: Keypair})[];
    let creator: Keypair;
    let signers: Keypair[];
    let proposalPda: PublicKey;

    before(async () => {
        const programConfigPda = versionedMultisig.getProgramConfigPda({ programId })[0];
        programConfig = await versionedMultisig.accounts.ProgramConfig.fromAccountAddress(
            connection,
            programConfigPda
        );
        helper = new VersionedMultisigTestHelper(connection);
        signers = [getTestProgramConfigInitializer()];
    });

    beforeEach(async () => {
        // Setup a fresh multisig and proposal for each test
        creator = await generateFundedKeypair(connection);
        defaultMembers = [...helper.generateMembers(3, Permissions.all(), 0), 
            { joinProposalIndex: 0, key: creator.publicKey, permissions: Permissions.all(), keyPair: creator }];
        const result = await helper.createVersionedMultisig(defaultMembers, 2);
        multisigPda = result.multisigPda;

        // Create a proposal for testing
        await helper.createVersionedVaultTransaction(multisigPda, creator);
        const proposal = await helper.createVersionedProposal(multisigPda, creator, 0);
        proposalPda = proposal.proposalPda;
    });

    describe("Basic Voting", () => {
        it("Allows eligible member to approve", async () => {
            const member = defaultMembers[0];
            await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, member.keyPair, true);
        });

        it("Allows eligible member to reject", async () => {
            const member = defaultMembers[0];
            await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, member.keyPair, false);
        });

        it("Executes proposal when threshold met", async () => {
            // Get two members to approve
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            // Check proposal is approved
            const proposal = await helper.getVersionedProposal(multisigPda, 0);
            assert(proposal.approved);
        });
    });

    describe("Vote Edge Cases", () => {
        it("Prevents double voting", async () => {
            const member = defaultMembers[0];
            await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
            
            // First vote should succeed
            await helper.vote(multisigPda, proposalPda, member.keyPair, true);

            // Second vote should fail
            try {
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
                assert.fail("Should not allow double voting");
            } catch (error: any) {
                assert(error.toString().includes("AlreadyVoted"));
            }
        });

        it("Handles vote changes", async () => {
            const member = defaultMembers[0];
            await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
            
            // First vote
            await helper.vote(multisigPda, proposalPda, member.keyPair, true);

            // Change vote
            try {
                await helper.vote(multisigPda, proposalPda, member.keyPair, false);
                assert.ok(true, "Should allow vote changes");
            } catch (error: any) {
                assert.fail("Should be able to change vote");
            }
        });

        it.only("Prevents voting on executed proposal", async () => {
            // Get threshold approvals
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            // Try to vote after proposal is approved
            const lateMember = defaultMembers[2];
            await helper.airdrop(lateMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            
            try {
                await helper.vote(multisigPda, proposalPda, lateMember.keyPair, true);
                assert.fail("Should not allow voting on approved proposal");
            } catch (error: any) {
                assert(error.toString().includes("AlreadyApproved"));
            }
        });

        it("Handles all members voting", async () => {
            // Have all members vote
            for (const member of defaultMembers) {
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            const proposal = await helper.getVersionedProposal(multisigPda, 0);
            assert(proposal.approved);
        });
    });
}); 