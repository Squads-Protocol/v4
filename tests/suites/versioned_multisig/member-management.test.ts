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
import { getProposalPda } from "../../../sdk/versioned_multisig/src/pda";

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig Member Management", () => {
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
        signers = [getTestProgramConfigInitializer()]
    });

    beforeEach(async () => {
        // Setup a fresh multisig for each test
        creator = await generateFundedKeypair(connection);
        defaultMembers = [...helper.generateMembers(3, Permissions.all(), 0), { joinProposalIndex: 0, key: creator.publicKey, permissions: Permissions.all(), keyPair: creator }];
        const result = await helper.createVersionedMultisig(defaultMembers, 2);
        multisigPda = result.multisigPda;
    });

    describe("Adding Members", () => {
        it("Adds a new member with basic permissions", async () => {
            const newMember = helper.generateMembers(1, Permissions.all(), 1)[0];
            await helper.addVersionedMultisigMember(multisigPda, creator, programConfig.authority, creator, newMember, signers);
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            assert.equal(multisigAccount.members.length, defaultMembers.length + 1);
            const addedMember = multisigAccount.members.find(m => m.key.equals(newMember.key));
            assert(addedMember, "New member not found");
            assert.equal(addedMember.permissions.mask, newMember.permissions.mask);
        });

        it("Adds multiple members in sequence", async () => {
            const newMembers = helper.generateMembers(2, Permissions.all(), 1);

            for (const newMember of newMembers) {
                await helper.addVersionedMultisigMember(multisigPda, creator, programConfig.authority, creator, newMember, signers);

            }

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            assert.equal(multisigAccount.members.length, defaultMembers.length + 2);
            for (const member of newMembers) {
                assert(multisigAccount.members.some(m => m.key.equals(member.key)));
            }
        });

        it("Adds a member with all permissions", async () => {
            const newMember = {
                ...helper.generateMembers(1, Permissions.all(), 1)[0],
                permissions: Permissions.all()
            };

            await helper.addVersionedMultisigMember(multisigPda, creator, programConfig.authority, creator, newMember, signers);

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            const addedMember = multisigAccount.members.find(m => m.key.equals(newMember.key));
            assert(addedMember, "New member not found");
            assert.equal(addedMember.permissions.mask, Permissions.all().mask);
        });

        it("Verifies new member can only vote on new proposals", async () => {
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            await helper.createVersionedVaultTransaction(multisigPda, creator);

            // Create an initial proposal
            const {sig, proposalPda} = await helper.createVersionedProposal(
                multisigPda,
                creator,
                0
            );

            // Add new member i
            const newKp = Keypair.generate()
            const newMember = {
                key: newKp.publicKey,
                permissions: Permissions.all(),
                joinProposalIndex: 1 //TODO: No longer required
            };
            await helper.addVersionedMultisigMember(multisigPda, creator, programConfig.authority, creator, newMember, signers);

            const newMultisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            try {
                // Try to vote on old proposal with new member
                const sig = await connection.requestAirdrop(newKp.publicKey, 10 * LAMPORTS_PER_SOL);
                await connection.confirmTransaction(sig);
                await helper.vote(multisigPda, proposalPda, newKp, true);
                assert.fail("Should not allow new member to vote on old proposal");
            } catch (error: any) {
                assert(error.toString().includes("MemberNotEligible"));
            }
        });
    });

    describe("Adding Member Edge Cases", () => {
        it("Fails to add duplicate member", async () => {
            const existingMember = defaultMembers[0];

            try {
                await helper.addVersionedMultisigMember(multisigPda, creator, programConfig.authority, creator, existingMember, signers);

                assert.fail("Should not allow adding duplicate member");
            } catch (error: any) {
                assert(error.toString().includes("DuplicateMember"));
            }
        });

        it.skip("Fails to add member when at max capacity", async () => {
            // First fill up to max capacity
            const maxMembers = helper.generateMembers(65535 - defaultMembers.length, Permissions.all(), 1); // Assuming max is 10

            for (const newMember of maxMembers) {
                await helper.addVersionedMultisigMember(multisigPda, creator, programConfig.authority, creator, newMember, signers);
            }

            // Try to add one more
            const oneMore = helper.generateMembers(1, Permissions.all(), 1)[0];
            try {
                await helper.addVersionedMultisigMember(multisigPda, creator, programConfig.authority, creator, oneMore, signers);

                assert.fail("Should not allow exceeding max capacity");
            } catch (error: any) {
                assert(error.toString().includes("TooManyMembers"));
            }
        });
    });

    describe("Removing Members", () => {
        it("Removes a member with no active votes", async () => {
            const memberToRemove = defaultMembers[1];
            
            await helper.removeVersionedMultisigMember(
                multisigPda,
                creator,
                programConfig.authority,
                creator,
                memberToRemove.key,
                signers
            );

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            assert.equal(multisigAccount.members.length, defaultMembers.length - 1);
            assert(!multisigAccount.members.some(m => m.key.equals(memberToRemove.key)));
        });

        it("Removes a member with existing approved votes", async () => {
            // Create and approve a proposal first
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const {proposalPda} = await helper.createVersionedProposal(
                multisigPda,
                creator,
                0
            );

            const memberToRemove = defaultMembers[1];

            await helper.airdrop(memberToRemove.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, memberToRemove.keyPair, true);

            // Remove the member
            await helper.removeVersionedMultisigMember(
                multisigPda,
                creator,
                programConfig.authority,
                creator,
                memberToRemove.key,
                signers
            );

            // Verify member is removed but vote remains
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            const proposal = await helper.getVersionedProposal(multisigPda, 0);

            assert(!multisigAccount.members.some(m => m.key.equals(memberToRemove.key)));
            assert(proposal.approved); // Vote should still count
        });

        it("Removes multiple members in sequence", async () => {
            const membersToRemove = defaultMembers.slice(0, 2);

            for (const member of membersToRemove) {
                await helper.removeVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    member.key,
                    signers
                );
            }

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );

            assert.equal(multisigAccount.members.length, defaultMembers.length - 2);
            for (const member of membersToRemove) {
                assert(!multisigAccount.members.some(m => m.key.equals(member.key)));
            }
        });
    });

    describe("Removing Member Edge Cases", () => {
        it("Fails to remove last member", async () => {
            // Remove all but one member
            const membersToRemove = defaultMembers.slice(0, -1);
            for (const member of membersToRemove) {
                await helper.removeVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    member.key,
                    signers
                );
            }

            // Try to remove the last member
            const lastMember = defaultMembers[defaultMembers.length - 1];
            try {
                await helper.removeVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    lastMember.key,
                    signers
                );
                assert.fail("Should not allow removing last member");
            } catch (error: any) {
                assert(error.toString().includes("RemoveLastMember"));
            }
        });

        it("Fails to remove non-existent member", async () => {
            const nonExistentMember = Keypair.generate().publicKey;

            try {
                await helper.removeVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    nonExistentMember,
                    signers
                );
                assert.fail("Should not allow removing non-existent member");
            } catch (error: any) {
                assert(error.toString().includes("NotAMember"));
            }
        });

        it("Verifies removed member cannot vote on new proposals", async () => {
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

            // Create a new proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const {proposalPda} = await helper.createVersionedProposal(
                multisigPda,
                creator,
                0
            );

            // Try to vote with removed member
            await helper.airdrop(memberToRemove.keyPair.publicKey, LAMPORTS_PER_SOL);
            try {
                await helper.vote(multisigPda, proposalPda, memberToRemove.keyPair, true);
                assert.fail("Should not allow removed member to vote");
            } catch (error: any) {
                assert(error.toString().includes("MemberNotFound"));
            }
        });
    });
}); 