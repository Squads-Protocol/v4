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
import { Permissions, VersionedMember } from "../../../sdk/versioned_multisig/lib/types";
import { getVersionedTestProgramId } from "./versioned-utils";
import { VersionedMultisigTestHelper } from "../../helpers/versioned-multisig";

const programId = getVersionedTestProgramId();
const connection = createLocalhostConnection();

describe("Versioned Multisig Transactions", () => {
    let programConfig: ProgramConfig;
    let helper: VersionedMultisigTestHelper;
    let multisigPda: PublicKey;
    let defaultMembers: (VersionedMember & { keyPair: Keypair })[];
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

    describe("Transaction Processing", () => {
        it("Processes single instruction transaction", async () => {
            // Create a simple transfer instruction
            const [vaultPda] = versionedMultisig.getVaultPda({
                multisigPda,
                index: 0,
            });

            // Fund the vault
            await helper.airdrop(vaultPda, 2 * LAMPORTS_PER_SOL);

            // Create transaction
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 1);
            // Get approvals
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            // Execute transaction
            const executeMember = defaultMembers[2];
            await helper.airdrop(executeMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.executeVaultTransaction(multisigPda, 1, executeMember.keyPair);

            // Verify transaction was executed
            const vaultBalance = await connection.getBalance(vaultPda);
            console.log('vaultBalance', vaultBalance)
            assert.equal(vaultBalance, LAMPORTS_PER_SOL); // Should have 1 SOL less
        });

        it("Handles multi-instruction transaction", async () => {
            const [vaultPda] = versionedMultisig.getVaultPda({
                multisigPda,
                index: 0,
            });

            // Fund the vault
            await helper.airdrop(vaultPda, 3 * LAMPORTS_PER_SOL);

            // Create multiple transfer instructions
            const recipient1 = Keypair.generate();
            const recipient2 = Keypair.generate();


            // Create transaction with multiple instructions
            const instructions = [recipient1, recipient2].map(recipient => SystemProgram.transfer({
                // The transfer is being signed from the Squads Vault, that is why we use the VaultPda
                fromPubkey: vaultPda,
                toPubkey: recipient.publicKey,
                lamports: 1 * LAMPORTS_PER_SOL,
              }));

            const message = new TransactionMessage({
                payerKey: vaultPda,
                recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
                instructions,
            });

            // Create and approve proposal
            await helper.createVersionedVaultTransactionWithMessage(multisigPda, creator, message);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Get approvals
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            // Execute transaction
            const executeMember = defaultMembers[2];
            await helper.airdrop(executeMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.executeVaultTransaction(multisigPda, 1, executeMember.keyPair);

            // Verify both transfers were executed
            const vaultBalance = await connection.getBalance(vaultPda);
            const recipient1Balance = await connection.getBalance(recipient1.publicKey);
            const recipient2Balance = await connection.getBalance(recipient2.publicKey);

            assert.equal(vaultBalance, LAMPORTS_PER_SOL);
            assert.equal(recipient1Balance, LAMPORTS_PER_SOL);
            assert.equal(recipient2Balance, LAMPORTS_PER_SOL);
        });

        it("Executes time-locked transaction", async () => {
            // Create multisig with timelock
            const timeLock = 2; // 2 second timelock
            const { multisigPda: timelockedMultisig } = await helper.createVersionedMultisig(
                defaultMembers,
                2,
                timeLock
            );

            const [vaultPda] = versionedMultisig.getVaultPda({
                multisigPda: timelockedMultisig,
                index: 0,
            });

            // Fund the vault
            await helper.airdrop(vaultPda, 2 * LAMPORTS_PER_SOL);

            // Create and approve proposal
            await helper.createVersionedVaultTransaction(timelockedMultisig, creator);
            const { proposalPda } = await helper.createVersionedProposal(timelockedMultisig, creator, 1);

            // Get approvals
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(timelockedMultisig, proposalPda, member.keyPair, true);
            }

            // Try to execute immediately (should fail)
            const executeMember = defaultMembers[2];
            await helper.airdrop(executeMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            try {
                await helper.executeVaultTransaction(timelockedMultisig, 1, executeMember.keyPair);
                assert.fail("Should not execute before timelock expires");
            } catch (error: any) {
                console.log(error)
                assert(error.toString().includes("TimeLockNotReleased"));
            }

            // Wait for timelock to expire
            await new Promise(resolve => setTimeout(resolve, (timeLock + 1) * 1000));

            // Execute should now succeed
            await helper.executeVaultTransaction(timelockedMultisig, 1, executeMember.keyPair);

            // Verify transaction was executed
            const vaultBalance = await connection.getBalance(vaultPda);
            assert.equal(vaultBalance, LAMPORTS_PER_SOL);
        });
    });

    describe("Transaction Edge Cases", () => {
        it("Prevents execution of unapproved transaction", async () => {
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            await helper.createVersionedProposal(multisigPda, creator, 1);

            // Try to execute without approvals
            const executeMember = defaultMembers[2];
            await helper.airdrop(executeMember.keyPair.publicKey, LAMPORTS_PER_SOL);

            try {
                await helper.executeVaultTransaction(multisigPda, 1, executeMember.keyPair);
                assert.fail("Should not execute unapproved transaction");
            } catch (error: any) {
                console.log(error)
                assert(error.toString().includes("InvalidProposalStatus"));
            }
        });

        it("Prevents double execution", async () => {
            const [vaultPda] = versionedMultisig.getVaultPda({
                multisigPda,
                index: 0,
            });

            // Fund the vault
            await helper.airdrop(vaultPda, 2 * LAMPORTS_PER_SOL);

            // Create and approve transaction
            await helper.createVersionedVaultTransaction(multisigPda, creator);
            const { proposalPda } = await helper.createVersionedProposal(multisigPda, creator, 1);

            // Get approvals
            for (let i = 0; i < 2; i++) {
                const member = defaultMembers[i];
                await helper.airdrop(member.keyPair.publicKey, LAMPORTS_PER_SOL);
                await helper.vote(multisigPda, proposalPda, member.keyPair, true);
            }

            // Execute first time
            const executeMember = defaultMembers[2];
            await helper.airdrop(executeMember.keyPair.publicKey, LAMPORTS_PER_SOL);
            await helper.executeVaultTransaction(multisigPda, 1, executeMember.keyPair);

            // Try to execute again
            try {
                await helper.executeVaultTransaction(multisigPda, 1, executeMember.keyPair);
                assert.fail("Should not allow double execution");
            } catch (error: any) {
                console.log(error)
                assert(error.toString().includes("AlreadyExecuted"));
            }
        });
    });
}); 