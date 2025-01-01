import {
    Connection,
    Keypair,
    PublicKey,
    LAMPORTS_PER_SOL,
    SystemProgram,
    TransactionMessage
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
import { getTransactionPda } from "../../../sdk/versioned_multisig/src/pda";

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig Permissions", () => {
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

    describe("Basic Permissions", () => {
        beforeEach(async () => {
            creator = await generateFundedKeypair(connection);
            // Create members with different permission levels
            const initiateOnlyMember = helper.generateMembers(1, Permissions.fromPermissions([Permission.Initiate]), 0)[0];
            const voteOnlyMember = helper.generateMembers(1, Permissions.fromPermissions([Permission.Vote]), 0)[0];
            const executeOnlyMember = helper.generateMembers(1, Permissions.fromPermissions([Permission.Execute]), 0)[0];
            const fullPermissionMember = helper.generateMembers(1, Permissions.all(), 0)[0];

            defaultMembers = [
                initiateOnlyMember,
                voteOnlyMember,
                executeOnlyMember,
                fullPermissionMember,
                { joinProposalIndex: 0, key: creator.publicKey, permissions: Permissions.all(), keyPair: creator }
            ];

            const result = await helper.createVersionedMultisig(defaultMembers, 2);
            multisigPda = result.multisigPda;

            const [vaultPda] = versionedMultisig.getVaultPda({
                multisigPda,
                index: 0,
            });
            await helper.airdrop(vaultPda, 3 * LAMPORTS_PER_SOL);
        });

        it("Enforces initiate permission for proposal creation", async () => {
            // Member with initiate permission should succeed
            const initiateMember = defaultMembers[0];
            await helper.airdrop(initiateMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.createVersionedVaultTransaction(multisigPda, initiateMember.keyPair);
            await helper.createVersionedProposal(multisigPda, initiateMember.keyPair, 1);

            // Member without initiate permission should fail
            const voteOnlyMember = defaultMembers[1];
            await helper.airdrop(voteOnlyMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            try {
                await helper.createVersionedVaultTransaction(multisigPda, voteOnlyMember.keyPair);
                await helper.createVersionedProposal(multisigPda, voteOnlyMember.keyPair, 2);
                assert.fail("Should not allow proposal creation without initiate permission");
            } catch (error: any) {
                assert(error.toString().includes("Unauthorized"));
            }
        });

        it("Enforces vote permission for voting", async () => {
            // Create a proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 0);

            // Member with vote permission should succeed
            const voteMember = defaultMembers[1];
            await helper.airdrop(voteMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, voteMember.keyPair, true);

            // Member without vote permission should fail
            const executeOnlyMember = defaultMembers[2];
            await helper.airdrop(executeOnlyMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            try {
                await helper.vote(multisigPda, proposalPda, executeOnlyMember.keyPair, true);
                assert.fail("Should not allow voting without vote permission");
            } catch (error: any) {
                console.log("error", error)
                assert(error.toString().includes("MemberNotEligible"));
            }
        });

        it("Enforces execute permission for execution", async () => {
            // Create and approve a proposal
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Get required votes
            const voteMember = defaultMembers[1];
            const fullPermissionMember = defaultMembers[3];
            await helper.airdrop(voteMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.airdrop(fullPermissionMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.vote(multisigPda, proposalPda, voteMember.keyPair, true);
            await helper.vote(multisigPda, proposalPda, fullPermissionMember.keyPair, true);

            // Member with execute permission should succeed
            const executeMember = defaultMembers[2];
            await helper.airdrop(executeMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.executeVaultTransaction(multisigPda, 1, executeMember.keyPair);

            // Try to execute another transaction with member without execute permission
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda: proposal2 } = await helper.createVersionedProposal(multisigPda, creator, 2);
            await helper.vote(multisigPda, proposal2, voteMember.keyPair, true);
            await helper.vote(multisigPda, proposal2, fullPermissionMember.keyPair, true);

            const initiateOnlyMember = defaultMembers[0];
            await helper.airdrop(initiateOnlyMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            try {
                await helper.executeVaultTransaction(multisigPda, 2, initiateOnlyMember.keyPair);
                assert.fail("Should not allow execution without execute permission");
            } catch (error: any) {
                assert(error.toString().includes("Unauthorized"));
            }
        });

        it("Handles permission combinations correctly", async () => {
            // Create a member with both initiate and vote permissions
            const initiateAndVoteMember = helper.generateMembers(1, Permissions.fromPermissions([Permission.Initiate, Permission.Vote]), 0)[0];
            await helper.addVersionedMultisigMember(
                multisigPda,
                creator,
                programConfig.authority,
                creator,
                initiateAndVoteMember,
                signers
            );

            // Should be able to create and vote on proposal
            await helper.airdrop(initiateAndVoteMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            const createVersionedVaultTransactionSig = await helper.createVersionedVaultTransaction(multisigPda, initiateAndVoteMember.keyPair);
            console.log('createVersionedVaultTransactionSig', await connection.getTransaction(createVersionedVaultTransactionSig.signature1, {
                commitment: 'confirmed',
                maxSupportedTransactionVersion: 0
            }));
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, initiateAndVoteMember.keyPair, 1);
            await helper.vote(multisigPda, proposalPda, initiateAndVoteMember.keyPair, true);

            // But should not be able to execute
            try {
                const [transactionPda] = getTransactionPda({
                    multisigPda,
                    index: BigInt(1),
                    programId: getVersionedTestProgramId(),
                  });
                  console.log('transactionPda', transactionPda)
                await helper.executeVaultTransaction(multisigPda, 1, initiateAndVoteMember.keyPair);
                assert.fail("Should not allow execution without execute permission");
            } catch (error: any) {
                console.log("error", error)
                assert(error.toString().includes("Unauthorized"));
            }
        });
    });
}); 