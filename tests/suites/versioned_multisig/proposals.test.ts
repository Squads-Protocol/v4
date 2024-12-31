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

describe("Versioned Multisig Proposals", () => {
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

    beforeEach(async () => {
        // Setup a fresh multisig for each test
        creator = await generateFundedKeypair(connection);
        defaultMembers = [...helper.generateMembers(3, Permissions.all(), 0), 
            { joinProposalIndex: 0, key: creator.publicKey, permissions: Permissions.all(), keyPair: creator }];
        const result = await helper.createVersionedMultisig(defaultMembers, 2);
        multisigPda = result.multisigPda;
    });

    describe("Basic Proposal Creation", () => {
        it("Creates proposal and allows original members to vote", async () => {
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // Original member should be able to vote
            const member = defaultMembers[0];
            await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, member.keyPair, true);
        });

        it("Creates proposal and prevents non-members from voting", async () => {
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // Non-member should not be able to vote
            const nonMember = Keypair.generate();
            await helper.airdrop(nonMember.publicKey, LAMPORTS_PER_SOL);
            
            try {
                await helper.vote(multisigPda, proposalPda, nonMember, true);
                assert.fail("Should not allow non-member to vote");
            } catch (error: any) {
                assert(error.toString().includes("MemberNotFound"));
            }
        });

        it("Creates multiple proposals in sequence", async () => {
            // Create first proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda: proposal1 } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // Create second proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda: proposal2 } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Verify both proposals can be voted on by original members
            const member = defaultMembers[0];
            await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposal1, member.keyPair, true);
            await helper.vote(multisigPda, proposal2, member.keyPair, true);
        });
    });

    describe("Proposal Creation Edge Cases", () => {
        it("Handles proposal creation after member removal", async () => {
            // Remove a member
            const memberToRemove = defaultMembers[1];
            await helper.removeVersionedMultisigMember(
                multisigPda,
                creator,
                programConfig.authority,
                creator,
                memberToRemove.key,
                signers
            );

            // Create proposal and verify removed member cannot vote
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 0);

            await helper.airdrop(memberToRemove.keyPair.publicKey, LAMPORTS_PER_SOL);
            try {
                await helper.vote(multisigPda, proposalPda, memberToRemove.keyPair, true);
                assert.fail("Should not allow removed member to vote");
            } catch (error: any) {
                assert(error.toString().includes("MemberNotFound"));
            }
        });

        it("Verifies proposal index increments correctly", async () => {
            const multisigBefore = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            await helper.createVersionedVaultTransaction(multisigPda, creator);
            await helper.createVersionedProposal(multisigPda, creator, 0);

            const multisigAfter = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            assert.equal(multisigAfter.transactionIndex,1);

        });
    });
}); 