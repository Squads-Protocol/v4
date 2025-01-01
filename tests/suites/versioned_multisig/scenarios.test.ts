import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
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

describe("Versioned Multisig Scenarios", () => {
    let programConfig: ProgramConfig;
    let helper: VersionedMultisigTestHelper;
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

    describe("Growth Pattern", () => {
        let multisigPda: PublicKey;
        let creator: Keypair;
        let initialMembers: (VersionedMember & {keyPair: Keypair})[];
        before(async () => {
            creator = await generateFundedKeypair(connection);
            initialMembers = [...helper.generateMembers(2, Permissions.all(), 0),
                { joinProposalIndex: 0, key: creator.publicKey, permissions: Permissions.all(), keyPair: creator }];
            const result = await helper.createVersionedMultisig(initialMembers, 2);
            multisigPda = result.multisigPda;
        });

        it("1. Creates basic multisig and verifies initial state", async () => {
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            assert.equal(multisigAccount.members.length, initialMembers.length);
            assert.equal(multisigAccount.threshold, 2);
        });

        it("2. Adds members over time and verifies voting power", async () => {
            // Add new members in stages
            const newMembers = helper.generateMembers(3, Permissions.all(), 1);
            
            for (const member of newMembers) {
                const multisig = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                    connection,
                    multisigPda
                );
                // Create and execute a proposal before adding new member
                await helper.createVersionedVaultTransaction(multisigPda, creator);
                const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, Number(multisig.transactionIndex) + 1);

                // Get votes from existing members
                for (let i = 0; i < 2; i++) {
                    const voter = initialMembers[i];
                    await helper.airdrop(voter.keyPair.publicKey, LAMPORTS_PER_SOL);
                    await helper.vote(multisigPda, proposalPda, voter.keyPair, true);
                }

                // Add new member
                await helper.addVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    member,
                    signers
                );

                // Verify member count increased
                const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                    connection,
                    multisigPda
                );
                assert(multisigAccount.members.some(m => m.key.equals(member.key)));
            }
        });

        it("3. Creates proposals at each growth stage", async () => {
            // Create proposal with expanded member set
            const multisig = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            const newTransactionIndex = Number(multisig.transactionIndex) + 1;
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, newTransactionIndex);

            // Get votes from mix of original and new members
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            
            const voters = multisigAccount.members.slice(0, 2);
            for (const voter of voters) {
                const voterKp = initialMembers.find(m => m.key.equals(voter.key))?.keyPair;
                if (voterKp) {
                    await helper.airdrop(voterKp.publicKey, LAMPORTS_PER_SOL);
                    await helper.vote(multisigPda, proposalPda, voterKp, true);
                }
            }

            // Verify proposal approved with expanded member set
            const proposal = await helper.getVersionedProposal(multisigPda, newTransactionIndex);
            assert(proposal.approved);
        });
    });

    describe("Member Turnover", () => {
        let multisigPda: PublicKey;
        let creator: Keypair;
        let originalMembers: (VersionedMember & {keyPair: Keypair})[];
        before(async () => {
            creator = await generateFundedKeypair(connection);
            originalMembers = [...helper.generateMembers(5, Permissions.all(), 0),
                { joinProposalIndex: 0, key: creator.publicKey, permissions: Permissions.all(), keyPair: creator }];
            const result = await helper.createVersionedMultisig(originalMembers, 3);
            multisigPda = result.multisigPda;
        });

        it("1. Starts with full member set", async () => {
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            assert.equal(multisigAccount.members.length, originalMembers.length);
        });

        // TODO: Needs refactor / explanation
        it("2. Gradually replaces members while maintaining functionality", async () => {
            const replacementMembers = helper.generateMembers(3, Permissions.all(), 1);
            
            // Replace members one by one
            for (let i = 0; i < replacementMembers.length; i++) {
                const oldMember = originalMembers[i];
                const newMember = replacementMembers[i];
                console.log("Replacing member", oldMember.key.toBase58(), "with", newMember.key.toBase58());
                const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                    connection,
                    multisigPda
                );

                // Create a proposal before replacement
                await helper.createVersionedVaultTransaction(multisigPda, creator);
                const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, Number(multisigAccount.transactionIndex) + 1);

                // Get votes from remaining original members
                for (let j = i + 1; j < 3; j++) {
                    const voter = originalMembers[j];
                    console.log("member voting ", voter.keyPair.publicKey.toBase58());
                    await helper.airdrop(voter.keyPair.publicKey, LAMPORTS_PER_SOL);
                    await helper.vote(multisigPda, proposalPda, voter.keyPair, true);
                }

                // Replace member
                console.log("Removing member", oldMember.key.toBase58());
                await helper.removeVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    oldMember.key,
                    signers
                );

                console.log("Adding member", newMember.key.toBase58());
                await helper.addVersionedMultisigMember(
                    multisigPda,
                    creator,
                    programConfig.authority,
                    creator,
                    newMember,
                    signers
                );
            }

            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            //Each member is replaced by a new member
            assert.equal(multisigAccount.members.length, originalMembers.length);

        });

        it("3. Verifies proposal handling with mixed member set", async () => {
            // Create proposal with mixed old/new members
            const multisigAccount = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
                connection,
                multisigPda
            );
            const newTransactionIndex = Number(multisigAccount.transactionIndex) + 1;
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, newTransactionIndex);

            // Get votes from mix of original and replacement members
            const voters = multisigAccount.members.slice(0, 3);
            for (const voter of voters) {
                const voterKp = originalMembers.find(m => m.key.equals(voter.key))?.keyPair;
                if (voterKp) {
                    await helper.airdrop(voterKp.publicKey, LAMPORTS_PER_SOL);
                    await helper.vote(multisigPda, proposalPda, voterKp, true);
                }
            }

            // Verify proposal can still be approved
            const proposal = await helper.getVersionedProposal(multisigPda, newTransactionIndex);
            assert(proposal.approved);
        });
    });
}); 