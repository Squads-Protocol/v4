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
import { Permission, Permissions, VersionedMember } from "../../../sdk/versioned_multisig/lib/types";
import { getVersionedTestProgramId } from "./versioned-utils";
import { VersionedMultisigTestHelper } from "../../helpers/versioned-multisig";

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig State Consistency", () => {
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
        creator = await generateFundedKeypair(connection);
        defaultMembers = [...helper.generateMembers(3, Permissions.all(), 0), 
            { joinProposalIndex: 0, key: creator.publicKey, permissions: Permissions.all(), keyPair: creator }];
        const result = await helper.createVersionedMultisig(defaultMembers, 2);
        multisigPda = result.multisigPda;
    });

    describe("Member State", () => {
        it("Maintains correct member count through additions and removals", async () => {
            // Initial state check
            let multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            assert.equal(multisigAccount.members.length, defaultMembers.length);

            // Add new members
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

            // Verify count after additions
            multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            assert.equal(multisigAccount.members.length, defaultMembers.length + 2);

            // Remove members
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

            // Verify final count
            multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            assert.equal(multisigAccount.members.length, defaultMembers.length);
        });

        it("Preserves member permissions through operations", async () => {
            // Add member with specific permissions
            const customPermissions = Permissions.fromPermissions([Permission.Vote, Permission.Initiate]);
            const newMember = helper.generateMembers(1, customPermissions, 1)[0];
            
            await helper.addVersionedMultisigMember(
                multisigPda,
                creator,
                programConfig.authority,
                creator,
                newMember,
                signers
            );

            // Verify permissions are preserved
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            
            const addedMember = multisigAccount.members.find(m => m.key.equals(newMember.key));
            assert(addedMember, "Member should exist");
            assert.equal(addedMember.permissions.mask, customPermissions.mask);
            await helper.airdrop(newMember.keyPair.publicKey, LAMPORTS_PER_SOL);

            // Create and vote on proposal to verify permissions work
            await helper.createVersionedVaultTransaction(multisigPda, newMember.keyPair);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, newMember.keyPair, 1);
            await helper.airdrop(newMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, newMember.keyPair, true);
        });

        it("Tracks join indices accurately", async () => {
            // Create proposals to increment transaction index
            for (let i = 0; i < 3; i++) {
                await helper.createVersionedVaultTransaction(multisigPda, creator);
                await helper.createVersionedProposal(multisigPda, creator, i + 1);
            }

            // Add new member with current transaction index
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            const currentIndex = Number(multisigAccount.transactionIndex);
            
            const newMember = helper.generateMembers(1, Permissions.all(), currentIndex)[0];
            await helper.addVersionedMultisigMember(
                multisigPda,
                creator,
                programConfig.authority,
                creator,
                newMember,
                signers
            );

            // Verify join index
            const updatedMultisig = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            const addedMember = updatedMultisig.members.find(m => m.key.equals(newMember.key));
            assert(addedMember, "Member should exist");
            assert.equal(addedMember.joinProposalIndex, currentIndex);
        });
    });

    describe("Proposal State", () => {
        it("Maintains proposal indices correctly", async () => {
            // Create multiple proposals
            const proposalCount = 3;
            for (let i = 0; i < proposalCount; i++) {
                await helper.createVersionedVaultTransaction(multisigPda, creator);
                await helper.createVersionedProposal(multisigPda, creator, i + 1);
            }

            // Verify transaction index
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            assert.equal(Number(multisigAccount.transactionIndex), proposalCount);

            // Verify each proposal exists
            for (let i = 0; i < proposalCount; i++) {
                const proposal = await helper.getVersionedProposal(multisigPda, i + 1);
                assert(proposal, `Proposal ${i + 1} should exist`);
            }
        });

        it("Preserves vote records accurately", async () => {
            // Create proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Cast votes
            const voters = defaultMembers.slice(0, 2);
            for (const voter of voters) {
                await helper.airdrop(voter.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, voter.keyPair, true);
            }

            // Verify vote records
            const proposal = await helper.getVersionedProposal(multisigPda, 1);
            assert(proposal.approved);

            // Verify each vote is recorded
            for (const voter of voters) {
                const hasVoted = proposal.approved.some(vote => vote.equals(voter.key));
                assert(hasVoted, `Vote should be recorded for ${voter.key.toBase58()}`);
            }
        });

        it("Updates proposal status correctly through lifecycle", async () => {
            // Create proposal
            const [vaultPda] = versionedMultisig.getVaultPda({
                multisigPda,
                index: 0,
            });
            await helper.airdrop(vaultPda, LAMPORTS_PER_SOL);
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Check initial state
            let proposal = await helper.getVersionedProposal(multisigPda, 1);
            assert(proposal.approved.length === 0);
            assert(proposal.rejected.length === 0);
            assert(proposal.status.__kind === 'Active');

            // Add votes to reach threshold
            for (let i = 0; i < 2; i++) {
                const voter = defaultMembers[i];
                await helper.airdrop(voter.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, voter.keyPair, true);
            }

            // Check approved state
            proposal = await helper.getVersionedProposal(multisigPda, 1);
            assert(proposal.approved.length === 2);
            assert(proposal.status.__kind === 'Approved');

            // Execute proposal
            const executeMember = defaultMembers[2];
            await helper.airdrop(executeMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.executeVaultTransaction(multisigPda, 1, executeMember.keyPair);

            // Check final state
            proposal = await helper.getVersionedProposal(multisigPda, 1);
            assert(proposal.status.__kind === 'Executed');
        });
    });
}); 