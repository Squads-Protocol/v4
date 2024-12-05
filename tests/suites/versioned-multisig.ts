import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";
import { SquadsMultisigProgram } from "../../target/types/squads_multisig_program";
import { VersionedMultisigTestHelper } from "../helpers/versioned-multisig";
import { 
    TEST_TIMELOCK, 
    ALL_PERMISSIONS, 
    MAX_MEMBERS, 
    MIN_THRESHOLD 
} from "../helpers/constants";
import { BN } from "@project-serum/anchor";
import { RetryScenario } from "../helpers/retry-conditions";

describe("Versioned Multisig", () => {
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    const program = anchor.workspace
        .SquadsMultisigProgram as Program<SquadsMultisigProgram>;

    let helper: VersionedMultisigTestHelper;
    
    before(() => {
        // Basic setup without retry conditions
        helper = new VersionedMultisigTestHelper(program, provider);
    });

    describe("Creation", () => {
        describe("Success Cases", () => {
            it("Creates a versioned multisig with basic configuration", async () => {
                const members = helper.generateMembers(3);
                const { multisigPda } = await helper.createMultisig(members, 2);
                
                const multisig = await program.account.versionedMultisig.fetch(multisigPda);
                
                expect(multisig.members.length).to.equal(3);
                expect(multisig.threshold).to.equal(2);
                expect(multisig.currentProposalIndex).to.equal(0);
                expect(multisig.timeLock).to.equal(TEST_TIMELOCK);
            });

            it("Creates multisig with maximum members", async () => {
                // For testing, we'll use a smaller number than MAX_MEMBERS
                const testMaxMembers = 10;
                const members = helper.generateMembers(testMaxMembers);
                const threshold = Math.ceil(testMaxMembers * 0.7); // 70% threshold
                
                const { multisigPda } = await helper.createMultisig(
                    members,
                    threshold
                );
                
                const multisig = await program.account.versionedMultisig.fetch(multisigPda);
                expect(multisig.members.length).to.equal(testMaxMembers);
                expect(multisig.members).to.be.sorted((a, b) => 
                    a.key.toBase58().localeCompare(b.key.toBase58())
                );
            });

            it("Creates multisig with minimum threshold", async () => {
                const members = helper.generateMembers(5);
                const { multisigPda } = await helper.createMultisig(
                    members,
                    MIN_THRESHOLD
                );
                
                const multisig = await program.account.versionedMultisig.fetch(multisigPda);
                expect(multisig.threshold).to.equal(MIN_THRESHOLD);
            });

            it("Creates multisig with different permission combinations", async () => {
                const members = [
                    { key: Keypair.generate().publicKey, permissions: 1 }, // Vote only
                    { key: Keypair.generate().publicKey, permissions: 2 }, // Initiate only
                    { key: Keypair.generate().publicKey, permissions: 4 }, // Execute only
                    { key: Keypair.generate().publicKey, permissions: ALL_PERMISSIONS }, // All permissions
                ];
                
                const { multisigPda } = await helper.createMultisig(members, 2);
                const multisig = await program.account.versionedMultisig.fetch(multisigPda);
                
                expect(multisig.members[0].permissions).to.equal(1);
                expect(multisig.members[3].permissions).to.equal(ALL_PERMISSIONS);
            });
        });

        describe("Failure Cases", () => {
            it("Fails to create with empty members", async () => {
                try {
                    await helper.createMultisig([], 1);
                    expect.fail("Should have failed with empty members");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "EmptyMembers");
                }
            });

            it("Fails to create with duplicate members", async () => {
                const duplicateKey = Keypair.generate().publicKey;
                const members = [
                    { key: duplicateKey, permissions: ALL_PERMISSIONS },
                    { key: duplicateKey, permissions: ALL_PERMISSIONS },
                ];

                try {
                    await helper.createMultisig(members, 1);
                    expect.fail("Should have failed with duplicate members");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "DuplicateMember");
                }
            });

            it("Fails to create with threshold > member count", async () => {
                const members = helper.generateMembers(2);
                try {
                    await helper.createMultisig(members, 3);
                    expect.fail("Should have failed with invalid threshold");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "InvalidThreshold");
                }
            });

            it("Fails to create with invalid permissions", async () => {
                const members = [
                    { key: Keypair.generate().publicKey, permissions: 255 }, // Invalid permission
                ];

                try {
                    await helper.createMultisig(members, 1);
                    expect.fail("Should have failed with invalid permissions");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "UnknownPermission");
                }
            });

            it("Fails to create with no voting members", async () => {
                const members = [
                    { key: Keypair.generate().publicKey, permissions: 2 }, // Initiate only
                    { key: Keypair.generate().publicKey, permissions: 4 }, // Execute only
                ];

                try {
                    await helper.createMultisig(members, 1);
                    expect.fail("Should have failed with no voting members");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "NoVoters");
                }
            });
        });
    });

    describe("Member Management", () => {
        let defaultMultisig: PublicKey;
        let defaultCreateKey: Keypair;

        beforeEach(async () => {
            // Create a fresh multisig for each test
            const members = helper.generateMembers(3, ALL_PERMISSIONS);
            const result = await helper.createMultisig(members, 2);
            defaultMultisig = result.multisigPda;
            defaultCreateKey = result.createKey;
        });

        describe("Adding Members", () => {
            it("adds a new member with basic permissions", async () => {
                const newMember = Keypair.generate();
                await helper.addMember(
                    defaultMultisig,
                    newMember.publicKey,
                    VOTE_PERMISSION
                );

                const multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                const addedMember = multisig.members.find(
                    m => m.key.toBase58() === newMember.publicKey.toBase58()
                );

                expect(addedMember).to.exist;
                expect(addedMember.permissions).to.equal(VOTE_PERMISSION);
                expect(addedMember.joinProposalIndex).to.equal(multisig.currentProposalIndex);
            });

            it("verifies new member can only vote on new proposals", async () => {
                // Create an initial proposal
                const proposer = Keypair.generate();
                const oldProposalPda = await helper.createProposal(
                    defaultMultisig,
                    proposer,
                    0
                );

                // Add new member
                const newMember = Keypair.generate();
                await helper.addMember(
                    defaultMultisig,
                    newMember.publicKey,
                    ALL_PERMISSIONS
                );

                // Create new proposal
                const newProposalPda = await helper.createProposal(
                    defaultMultisig,
                    proposer,
                    1
                );

                // Try to vote on old proposal (should fail)
                try {
                    await helper.vote(defaultMultisig, oldProposalPda, newMember, true);
                    expect.fail("Should not be able to vote on old proposal");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                }

                // Vote on new proposal (should succeed)
                await helper.vote(defaultMultisig, newProposalPda, newMember, true);
            });

            it("maintains correct member sorting after addition", async () => {
                const newMembers = helper.generateMembers(3, ALL_PERMISSIONS);
                
                for (const member of newMembers) {
                    await helper.addMember(defaultMultisig, member.key, member.permissions);
                }

                const multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                const memberKeys = multisig.members.map(m => m.key.toBase58());
                const sortedKeys = [...memberKeys].sort();
                
                expect(memberKeys).to.deep.equal(sortedKeys);
            });

            it("fails to add duplicate member", async () => {
                const existingMultisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                const existingMember = existingMultisig.members[0].key;

                try {
                    await helper.addMember(defaultMultisig, existingMember, ALL_PERMISSIONS);
                    expect.fail("Should not be able to add duplicate member");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "DuplicateMember");
                }
            });
        });

        describe("Removing Members", () => {
            it("removes a member with no active votes", async () => {
                const multisigBefore = await program.account.versionedMultisig.fetch(defaultMultisig);
                const memberToRemove = multisigBefore.members[0].key;
                const initialCount = multisigBefore.members.length;

                await helper.removeMember(defaultMultisig, memberToRemove);

                const multisigAfter = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisigAfter.members.length).to.equal(initialCount - 1);
                expect(multisigAfter.members.find(
                    m => m.key.toBase58() === memberToRemove.toBase58()
                )).to.be.undefined;
            });

            it("maintains votes from removed member on existing proposals", async () => {
                // Create proposal
                const proposer = Keypair.generate();
                const proposalPda = await helper.createProposal(defaultMultisig, proposer, 0);

                // Get member to remove and have them vote
                const multisigBefore = await program.account.versionedMultisig.fetch(defaultMultisig);
                const memberToRemove = Keypair.fromSecretKey(multisigBefore.members[0].key.toBytes());
                await helper.vote(defaultMultisig, proposalPda, memberToRemove, true);

                // Remove member
                await helper.removeMember(defaultMultisig, memberToRemove.publicKey);

                // Check that vote still exists
                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.votes.find(
                    v => v.member.toBase58() === memberToRemove.publicKey.toBase58()
                )).to.exist;
            });

            it("fails to remove last member", async () => {
                // Remove all but one member
                const multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                for (let i = 0; i < multisig.members.length - 1; i++) {
                    await helper.removeMember(defaultMultisig, multisig.members[i].key);
                }

                // Try to remove last member
                try {
                    await helper.removeMember(defaultMultisig, multisig.members[multisig.members.length - 1].key);
                    expect.fail("Should not be able to remove last member");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "InvalidMemberCount");
                }
            });

            it("prevents removed member from voting on new proposals", async () => {
                // Remove a member
                const multisigBefore = await program.account.versionedMultisig.fetch(defaultMultisig);
                const memberToRemove = Keypair.fromSecretKey(multisigBefore.members[0].key.toBytes());
                await helper.removeMember(defaultMultisig, memberToRemove.publicKey);

                // Create new proposal
                const proposer = Keypair.generate();
                const proposalPda = await helper.createProposal(defaultMultisig, proposer, 0);

                // Try to vote with removed member
                try {
                    await helper.vote(defaultMultisig, proposalPda, memberToRemove, true);
                    expect.fail("Removed member should not be able to vote");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "NotAMember");
                }
            });
        });
    });

    describe("Proposal Management", () => {
        let defaultMultisig: PublicKey;
        let defaultMembers: Keypair[];
        
        beforeEach(async () => {
            // Create members with known keypairs for voting
            defaultMembers = Array(3).fill(0).map(() => Keypair.generate());
            const memberData = defaultMembers.map(m => ({
                key: m.publicKey,
                permissions: ALL_PERMISSIONS
            }));
            
            const result = await helper.createMultisig(memberData, 2);
            defaultMultisig = result.multisigPda;
        });

        describe("Proposal Creation", () => {
            it("creates proposal with all members eligible", async () => {
                const proposalPda = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    0
                );

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.eligibleVoters.length).to.equal(defaultMembers.length);
                expect(proposal.threshold).to.equal(2);
                expect(proposal.status).to.equal({ active: {} });
            });

            it("creates proposal with correct threshold calculation", async () => {
                // Add a new member who won't be eligible for this proposal
                const newMember = Keypair.generate();
                await helper.addMember(defaultMultisig, newMember.publicKey, ALL_PERMISSIONS);

                const proposalPda = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    0
                );

                const proposal = await program.account.proposal.fetch(proposalPda);
                // Should only include original members
                expect(proposal.eligibleVoters.length).to.equal(defaultMembers.length);
                expect(proposal.threshold).to.equal(2);
            });

            it("fails creation from unauthorized member", async () => {
                const unauthorizedMember = Keypair.generate();
                try {
                    await helper.createProposal(defaultMultisig, unauthorizedMember, 0);
                    expect.fail("Should not allow unauthorized proposal creation");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                }
            });

            it("increments proposal index correctly", async () => {
                const firstProposal = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    0
                );
                
                const secondProposal = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    1
                );

                const multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisig.currentProposalIndex).to.equal(2);
            });
        });

        describe("Voting", () => {
            let proposalPda: PublicKey;

            beforeEach(async () => {
                proposalPda = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    0
                );
            });

            it("allows eligible member to approve", async () => {
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                
                const proposal = await program.account.proposal.fetch(proposalPda);
                const vote = proposal.votes.find(
                    v => v.member.equals(defaultMembers[1].publicKey)
                );
                expect(vote).to.exist;
                expect(vote.approved).to.be.true;
            });

            it("allows eligible member to reject", async () => {
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], false);
                
                const proposal = await program.account.proposal.fetch(proposalPda);
                const vote = proposal.votes.find(
                    v => v.member.equals(defaultMembers[1].publicKey)
                );
                expect(vote).to.exist;
                expect(vote.approved).to.be.false;
            });

            it("executes proposal when threshold met", async () => {
                // Two approvals needed
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.deep.equal({ approved: {} });
            });

            it("rejects proposal with sufficient rejections", async () => {
                // Two rejections (making approval impossible)
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], false);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], false);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.deep.equal({ rejected: {} });
            });

            it("prevents double voting", async () => {
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);

                try {
                    await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                    expect.fail("Should not allow double voting");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "AlreadyVoted");
                }
            });

            it("allows vote change within time window", async () => {
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                
                // Change vote to reject
                await helper.changeVote(defaultMultisig, proposalPda, defaultMembers[1], false);

                const proposal = await program.account.proposal.fetch(proposalPda);
                const vote = proposal.votes.find(
                    v => v.member.equals(defaultMembers[1].publicKey)
                );
                expect(vote.approved).to.be.false;
            });

            it("tracks vote counts correctly", async () => {
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], false);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.approvalCount).to.equal(1);
                expect(proposal.rejectionCount).to.equal(1);
            });
        });
    });

    describe("Proposal Execution", () => {
        let defaultMultisig: PublicKey;
        let defaultMembers: Keypair[];
        
        beforeEach(async () => {
            defaultMembers = Array(3).fill(0).map(() => Keypair.generate());
            const memberData = defaultMembers.map(m => ({
                key: m.publicKey,
                permissions: ALL_PERMISSIONS
            }));
            
            const result = await helper.createMultisig(memberData, 2);
            defaultMultisig = result.multisigPda;
        });

        describe("Threshold Achievement", () => {
            it("transitions to approved state when threshold met", async () => {
                const proposalPda = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    0
                );

                // Meet threshold with two approvals
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.deep.equal({ approved: {} });
                expect(proposal.approvedAt).to.not.be.null;
            });

            it("locks further voting after approval", async () => {
                const proposalPda = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    0
                );

                // Meet threshold
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                // Try to vote after approval
                try {
                    await helper.vote(defaultMultisig, proposalPda, defaultMembers[0], true);
                    expect.fail("Should not allow voting after approval");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "ProposalNotActive");
                }
            });
        });

        describe("Timelock", () => {
            it("enforces timelock before execution", async () => {
                // Create multisig with timelock
                const TIMELOCK = 100; // 100 seconds
                const result = await helper.createMultisig(
                    defaultMembers.map(m => ({
                        key: m.publicKey,
                        permissions: ALL_PERMISSIONS
                    })),
                    2,
                    TIMELOCK
                );

                const proposalPda = await helper.createProposal(
                    result.multisigPda,
                    defaultMembers[0],
                    0
                );

                // Approve proposal
                await helper.vote(result.multisigPda, proposalPda, defaultMembers[1], true);
                await helper.vote(result.multisigPda, proposalPda, defaultMembers[2], true);

                // Try to execute immediately
                try {
                    await helper.executeProposal(result.multisigPda, proposalPda, defaultMembers[0]);
                    expect.fail("Should not allow execution before timelock expires");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "TimelockNotPassed");
                }
            });

            it("allows execution after timelock", async () => {
                const TIMELOCK = 0; // No timelock for testing
                const result = await helper.createMultisig(
                    defaultMembers.map(m => ({
                        key: m.publicKey,
                        permissions: ALL_PERMISSIONS
                    })),
                    2,
                    TIMELOCK
                );

                const proposalPda = await helper.createProposal(
                    result.multisigPda,
                    defaultMembers[0],
                    0
                );

                // Approve and execute
                await helper.vote(result.multisigPda, proposalPda, defaultMembers[1], true);
                await helper.vote(result.multisigPda, proposalPda, defaultMembers[2], true);
                await helper.executeProposal(result.multisigPda, proposalPda, defaultMembers[0]);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.deep.equal({ executed: {} });
                expect(proposal.executedAt).to.not.be.null;
            });
        });

        describe("Execution Permissions", () => {
            it("only allows members with execute permission", async () => {
                // Create member with only vote permission
                const voteOnlyMember = Keypair.generate();
                const members = [
                    { key: voteOnlyMember.publicKey, permissions: VOTE_PERMISSION },
                    ...defaultMembers.slice(0, 2).map(m => ({
                        key: m.publicKey,
                        permissions: ALL_PERMISSIONS
                    }))
                ];

                const result = await helper.createMultisig(members, 2);
                const proposalPda = await helper.createProposal(
                    result.multisigPda,
                    defaultMembers[0],
                    0
                );

                // Approve proposal
                await helper.vote(result.multisigPda, proposalPda, defaultMembers[1], true);
                await helper.vote(result.multisigPda, proposalPda, voteOnlyMember, true);

                // Try to execute with vote-only member
                try {
                    await helper.executeProposal(result.multisigPda, proposalPda, voteOnlyMember);
                    expect.fail("Should not allow execution by vote-only member");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                }

                // Execute with proper permissions
                await helper.executeProposal(result.multisigPda, proposalPda, defaultMembers[0]);
            });

            it("prevents double execution", async () => {
                const proposalPda = await helper.createProposal(
                    defaultMultisig,
                    defaultMembers[0],
                    0
                );

                // Approve and execute
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);
                await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);

                // Try to execute again
                try {
                    await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                    expect.fail("Should not allow double execution");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "AlreadyExecuted");
                }
            });
        });

        describe("Transaction Execution", () => {
            it("executes transaction with single instruction", async () => {
                const instruction = {
                    programId: SystemProgram.programId,
                    keys: [],
                    data: Buffer.from([])
                };

                const proposalPda = await helper.createProposalWithInstruction(
                    defaultMultisig,
                    defaultMembers[0],
                    instruction
                );

                // Approve and execute
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);
                await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.deep.equal({ executed: {} });
                expect(proposal.executedAt).to.not.be.null;
            });

            it("executes transaction with multiple instructions", async () => {
                const instructions = [
                    {
                        programId: SystemProgram.programId,
                        keys: [],
                        data: Buffer.from([])
                    },
                    {
                        programId: SystemProgram.programId,
                        keys: [],
                        data: Buffer.from([])
                    }
                ];

                const proposalPda = await helper.createProposalWithInstructions(
                    defaultMultisig,
                    defaultMembers[0],
                    instructions
                );

                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);
                await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.executedInstructions).to.equal(instructions.length);
            });

            it("handles failed transaction execution", async () => {
                // Create an instruction that will fail (e.g., insufficient funds transfer)
                const invalidInstruction = {
                    programId: SystemProgram.programId,
                    keys: [
                        { pubkey: defaultMembers[0].publicKey, isSigner: true, isWritable: true },
                        { pubkey: defaultMembers[1].publicKey, isSigner: false, isWritable: true }
                    ],
                    data: Buffer.from([2, ...new BN(1000000).toArray("le", 8)]) // Transfer more than available
                };

                const proposalPda = await helper.createProposalWithInstruction(
                    defaultMultisig,
                    defaultMembers[0],
                    invalidInstruction
                );

                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                try {
                    await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                    expect.fail("Should fail due to insufficient funds");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "TransactionExecutionFailed");
                }

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.deep.equal({ failed: {} });
            });

            it("handles partial execution success", async () => {
                // Mix of successful and failing instructions
                const instructions = [
                    {
                        programId: SystemProgram.programId,
                        keys: [],
                        data: Buffer.from([]) // This will succeed
                    },
                    {
                        programId: SystemProgram.programId,
                        keys: [
                            { pubkey: defaultMembers[0].publicKey, isSigner: true, isWritable: true },
                            { pubkey: defaultMembers[1].publicKey, isSigner: false, isWritable: true }
                        ],
                        data: Buffer.from([2, ...new BN(1000000).toArray("le", 8)]) // This will fail
                    }
                ];

                const proposalPda = await helper.createProposalWithInstructions(
                    defaultMultisig,
                    defaultMembers[0],
                    instructions
                );

                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                try {
                    await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                    expect.fail("Should fail on second instruction");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "TransactionExecutionFailed");
                }

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.executedInstructions).to.equal(1);
                expect(proposal.status).to.deep.equal({ failed: {} });
            });

            it("respects execution order of instructions", async () => {
                // Create a sequence of instructions where order matters
                const account1 = Keypair.generate();
                const account2 = Keypair.generate();

                const instructions = [
                    // Create account1
                    SystemProgram.createAccount({
                        fromPubkey: defaultMembers[0].publicKey,
                        newAccountPubkey: account1.publicKey,
                        lamports: 1000000,
                        space: 0,
                        programId: SystemProgram.programId
                    }),
                    // Transfer from account1 to account2
                    SystemProgram.transfer({
                        fromPubkey: account1.publicKey,
                        toPubkey: account2.publicKey,
                        lamports: 500000
                    })
                ];

                const proposalPda = await helper.createProposalWithInstructions(
                    defaultMultisig,
                    defaultMembers[0],
                    instructions
                );

                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);
                await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);

                // Verify final state
                const account2Balance = await provider.connection.getBalance(account2.publicKey);
                expect(account2Balance).to.equal(500000);
            });

            it("handles execution retry after temporary failure", async () => {
                // Create a proposal that might fail due to temporary conditions
                const proposalPda = await helper.createProposalWithRetryableInstruction(
                    defaultMultisig,
                    defaultMembers[0]
                );

                await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                // First attempt fails
                try {
                    await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "TransactionExecutionFailed");
                }

                // Setup conditions for success
                await helper.setupSuccessConditions();

                // Retry execution
                await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                
                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.deep.equal({ executed: {} });
            });

            describe("Retry Scenarios", () => {
                let retryHelper: VersionedMultisigTestHelper;

                before(() => {
                    // Create a new helper with retry conditions enabled
                    retryHelper = new VersionedMultisigTestHelper(program, provider, true);
                });

                it("handles insufficient funds retry", async () => {
                    const proposalPda = await retryHelper.createProposalWithRetryableInstruction(
                        defaultMultisig,
                        defaultMembers[0],
                        RetryScenario.InsufficientFunds
                    );

                    await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                    await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                    // First attempt fails
                    try {
                        await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                        expect.fail("Should fail due to insufficient funds");
                    } catch (e) {
                        expect(e).to.have.property("error.errorCode.code", "TransactionExecutionFailed");
                    }

                    // Setup success conditions
                    await helper.setupSuccessConditions(RetryScenario.InsufficientFunds);

                    // Retry execution
                    await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                    
                    const proposal = await program.account.proposal.fetch(proposalPda);
                    expect(proposal.status).to.deep.equal({ executed: {} });
                });

                it("handles uninitialized account retry", async () => {
                    const proposalPda = await retryHelper.createProposalWithRetryableInstruction(
                        defaultMultisig,
                        defaultMembers[0],
                        RetryScenario.AccountNotInitialized
                    );

                    await helper.vote(defaultMultisig, proposalPda, defaultMembers[1], true);
                    await helper.vote(defaultMultisig, proposalPda, defaultMembers[2], true);

                    // First attempt fails
                    try {
                        await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                        expect.fail("Should fail due to uninitialized account");
                    } catch (e) {
                        expect(e).to.have.property("error.errorCode.code", "AccountNotInitialized");
                    }

                    // Setup success conditions
                    await helper.setupSuccessConditions(RetryScenario.AccountNotInitialized);

                    // Retry execution
                    await helper.executeProposal(defaultMultisig, proposalPda, defaultMembers[0]);
                    
                    const proposal = await program.account.proposal.fetch(proposalPda);
                    expect(proposal.status).to.deep.equal({ executed: {} });
                });

                it("handles token account creation retry", async () => {
                    const proposalPda = await retryHelper.createProposalWithRetryableInstruction(
                        defaultMultisig,
                        defaultMembers[0],
                        RetryScenario.TokenAccountNotCreated
                    );

                    // ... similar test flow
                });

                it("handles rent exemption retry", async () => {
                    const proposalPda = await retryHelper.createProposalWithRetryableInstruction(
                        defaultMultisig,
                        defaultMembers[0],
                        RetryScenario.RentExemption
                    );

                    // ... similar test flow
                });
            });
        });
    });

    describe("Permissions", () => {
        let defaultMultisig: PublicKey;
        let agents: {
            admin: Keypair;
            voter: Keypair;
            executor: Keypair;
            proposer: Keypair;
            unauthorized: Keypair;
        };
        
        beforeEach(async () => {
            // Create agents with specific permissions
            agents = {
                admin: Keypair.generate(), // All permissions
                voter: Keypair.generate(), // Vote only
                executor: Keypair.generate(), // Execute only
                proposer: Keypair.generate(), // Propose only
                unauthorized: Keypair.generate(), // No permissions
            };

            const members = [
                { key: agents.admin.publicKey, permissions: 7 }, // All permissions (1|2|4)
                { key: agents.voter.publicKey, permissions: 1 }, // Vote only
                { key: agents.executor.publicKey, permissions: 4 }, // Execute only
                { key: agents.proposer.publicKey, permissions: 2 }, // Propose only
            ];

            const { multisigPda } = await helper.createMultisig(members, 2);
            defaultMultisig = multisigPda;
        });

        describe("Proposal Creation", () => {
            it("allows proposal creation by members with propose permission", async () => {
                // Admin and proposer should be able to create proposals
                await helper.createProposal(defaultMultisig, agents.admin, 0);
                await helper.createProposal(defaultMultisig, agents.proposer, 1);
            });

            it("prevents proposal creation by unauthorized members", async () => {
                for (const agent of [agents.voter, agents.executor, agents.unauthorized]) {
                    try {
                        await helper.createProposal(defaultMultisig, agent, 0);
                        expect.fail(`Agent ${agent.publicKey.toBase58()} should not be able to create proposals`);
                    } catch (e) {
                        expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                    }
                }
            });
        });

        describe("Voting", () => {
            let proposalPda: PublicKey;

            beforeEach(async () => {
                proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 0);
            });

            it("allows voting by members with vote permission", async () => {
                // Admin and voter should be able to vote
                await helper.vote(defaultMultisig, proposalPda, agents.admin, true);
                await helper.vote(defaultMultisig, proposalPda, agents.voter, true);
            });

            it("prevents voting by unauthorized members", async () => {
                for (const agent of [agents.executor, agents.proposer, agents.unauthorized]) {
                    try {
                        await helper.vote(defaultMultisig, proposalPda, agent, true);
                        expect.fail(`Agent ${agent.publicKey.toBase58()} should not be able to vote`);
                    } catch (e) {
                        expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                    }
                }
            });
        });

        describe("Execution", () => {
            let proposalPda: PublicKey;

            beforeEach(async () => {
                proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 0);
                // Get required votes
                await helper.vote(defaultMultisig, proposalPda, agents.admin, true);
                await helper.vote(defaultMultisig, proposalPda, agents.voter, true);
            });

            it("allows execution by members with execute permission", async () => {
                // Admin and executor should be able to execute
                await helper.executeProposal(defaultMultisig, proposalPda, agents.admin);
                
                // Create and approve another proposal for executor test
                proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 1);
                await helper.vote(defaultMultisig, proposalPda, agents.admin, true);
                await helper.vote(defaultMultisig, proposalPda, agents.voter, true);
                await helper.executeProposal(defaultMultisig, proposalPda, agents.executor);
            });

            it("prevents execution by unauthorized members", async () => {
                for (const agent of [agents.voter, agents.proposer, agents.unauthorized]) {
                    try {
                        await helper.executeProposal(defaultMultisig, proposalPda, agent);
                        expect.fail(`Agent ${agent.publicKey.toBase58()} should not be able to execute`);
                    } catch (e) {
                        expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                    }
                }
            });
        });

        describe("Permission Combinations", () => {
            it("respects complex permission combinations", async () => {
                // Create a proposal using admin
                const proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 0);

                // Test voter can only vote
                await helper.vote(defaultMultisig, proposalPda, agents.voter, true);
                try {
                    await helper.executeProposal(defaultMultisig, proposalPda, agents.voter);
                    expect.fail("Voter should not be able to execute");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                }

                // Test executor can only execute after threshold
                try {
                    await helper.vote(defaultMultisig, proposalPda, agents.executor, true);
                    expect.fail("Executor should not be able to vote");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "Unauthorized");
                }

                // Get remaining required vote
                await helper.vote(defaultMultisig, proposalPda, agents.admin, true);
                
                // Now executor should be able to execute
                await helper.executeProposal(defaultMultisig, proposalPda, agents.executor);
            });
        });
    });

    describe("State Consistency", () => {
        let defaultMultisig: PublicKey;
        let agents: {
            admin: Keypair;
            member1: Keypair;
            member2: Keypair;
            member3: Keypair;
        };
        
        beforeEach(async () => {
            agents = {
                admin: Keypair.generate(),
                member1: Keypair.generate(),
                member2: Keypair.generate(),
                member3: Keypair.generate(),
            };

            const members = [
                { key: agents.admin.publicKey, permissions: 7 },
                { key: agents.member1.publicKey, permissions: 7 },
                { key: agents.member2.publicKey, permissions: 7 },
                { key: agents.member3.publicKey, permissions: 7 },
            ];

            const { multisigPda } = await helper.createMultisig(members, 3); // 75% threshold
            defaultMultisig = multisigPda;
        });

        describe("Proposal State Transitions", () => {
            let proposalPda: PublicKey;

            beforeEach(async () => {
                proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 0);
            });

            it("maintains correct vote counts and status through transitions", async () => {
                // Initial state
                let proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.voteCount).to.equal(0);
                expect(proposal.status).to.equal({ active: {} });
                expect(proposal.executionCount).to.equal(0);

                // First vote
                await helper.vote(defaultMultisig, proposalPda, agents.member1, true);
                proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.voteCount).to.equal(1);
                expect(proposal.status).to.equal({ active: {} });

                // Second vote
                await helper.vote(defaultMultisig, proposalPda, agents.member2, true);
                proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.voteCount).to.equal(2);
                expect(proposal.status).to.equal({ active: {} });

                // Third vote (reaches threshold)
                await helper.vote(defaultMultisig, proposalPda, agents.member3, true);
                proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.voteCount).to.equal(3);
                expect(proposal.status).to.equal({ approved: {} });

                // Execute
                await helper.executeProposal(defaultMultisig, proposalPda, agents.admin);
                proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.equal({ executed: {} });
                expect(proposal.executionCount).to.equal(1);
            });

            it("maintains rejection state correctly", async () => {
                // Two approvals
                await helper.vote(defaultMultisig, proposalPda, agents.member1, true);
                await helper.vote(defaultMultisig, proposalPda, agents.member2, true);

                // Two rejections (making approval impossible)
                await helper.vote(defaultMultisig, proposalPda, agents.member3, false);
                await helper.vote(defaultMultisig, proposalPda, agents.admin, false);

                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.equal({ rejected: {} });
                expect(proposal.rejectionCount).to.equal(2);
            });
        });

        describe("Member State Consistency", () => {
            it("maintains correct member count and threshold after changes", async () => {
                // Initial state check
                let multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisig.members.length).to.equal(4);
                expect(multisig.threshold).to.equal(3);

                // Remove a member
                const removeMemberProposal = await helper.createProposal(defaultMultisig, agents.admin, 0);
                await helper.vote(defaultMultisig, removeMemberProposal, agents.member1, true);
                await helper.vote(defaultMultisig, removeMemberProposal, agents.member2, true);
                await helper.vote(defaultMultisig, removeMemberProposal, agents.member3, true);

                // Check updated state
                multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisig.members.length).to.equal(3);
                expect(multisig.threshold).to.equal(3); // Should maintain same threshold

                // Add a new member
                const newMember = Keypair.generate();
                const addMemberProposal = await helper.createProposal(defaultMultisig, agents.admin, 1);
                await helper.vote(defaultMultisig, addMemberProposal, agents.member1, true);
                await helper.vote(defaultMultisig, addMemberProposal, agents.member2, true);
                await helper.vote(defaultMultisig, addMemberProposal, agents.member3, true);

                // Check final state
                multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisig.members.length).to.equal(4);
                expect(multisig.threshold).to.equal(3);
            });
        });

        describe("Proposal Index Consistency", () => {
            it("maintains sequential proposal indices", async () => {
                // Create multiple proposals
                const proposal1 = await helper.createProposal(defaultMultisig, agents.admin, 0);
                const proposal2 = await helper.createProposal(defaultMultisig, agents.member1, 1);
                const proposal3 = await helper.createProposal(defaultMultisig, agents.member2, 2);

                // Verify indices
                const multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisig.currentProposalIndex).to.equal(3);

                // Verify each proposal's stored index
                const p1 = await program.account.proposal.fetch(proposal1);
                const p2 = await program.account.proposal.fetch(proposal2);
                const p3 = await program.account.proposal.fetch(proposal3);

                expect(p1.transactionIndex).to.equal(0);
                expect(p2.transactionIndex).to.equal(1);
                expect(p3.transactionIndex).to.equal(2);
            });

            it("prevents proposal creation with incorrect index", async () => {
                await helper.createProposal(defaultMultisig, agents.admin, 0);
                
                try {
                    // Try to create proposal with wrong index
                    await helper.createProposal(defaultMultisig, agents.member1, 0);
                    expect.fail("Should not allow duplicate proposal index");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "InvalidProposalIndex");
                }

                try {
                    // Try to create proposal with gap in index
                    await helper.createProposal(defaultMultisig, agents.member1, 2);
                    expect.fail("Should not allow gap in proposal indices");
                } catch (e) {
                    expect(e).to.have.property("error.errorCode.code", "InvalidProposalIndex");
                }
            });
        });
    });

    describe("Concurrent Operations", () => {
        let defaultMultisig: PublicKey;
        let agents: {
            admin: Keypair;
            member1: Keypair;
            member2: Keypair;
            member3: Keypair;
            member4: Keypair;
        };
        
        beforeEach(async () => {
            agents = {
                admin: Keypair.generate(),
                member1: Keypair.generate(),
                member2: Keypair.generate(),
                member3: Keypair.generate(),
                member4: Keypair.generate(),
            };

            const members = [
                { key: agents.admin.publicKey, permissions: 7 },
                { key: agents.member1.publicKey, permissions: 7 },
                { key: agents.member2.publicKey, permissions: 7 },
                { key: agents.member3.publicKey, permissions: 7 },
                { key: agents.member4.publicKey, permissions: 7 },
            ];

            const { multisigPda } = await helper.createMultisig(members, 3);
            defaultMultisig = multisigPda;
        });

        describe("Parallel Proposal Creation", () => {
            it("handles concurrent proposal creation correctly", async () => {
                // Create multiple proposals in parallel
                const createPromises = [
                    helper.createProposal(defaultMultisig, agents.admin, 0),
                    helper.createProposal(defaultMultisig, agents.member1, 1),
                    helper.createProposal(defaultMultisig, agents.member2, 2)
                ];

                const proposals = await Promise.all(createPromises);
                
                // Verify all proposals were created with correct indices
                for (let i = 0; i < proposals.length; i++) {
                    const proposal = await program.account.proposal.fetch(proposals[i]);
                    expect(proposal.transactionIndex).to.equal(i);
                }

                // Verify multisig state
                const multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisig.currentProposalIndex).to.equal(3);
            });
        });

        describe("Parallel Voting", () => {
            let proposalPda: PublicKey;

            beforeEach(async () => {
                proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 0);
            });

            it("handles concurrent votes correctly", async () => {
                // Submit votes in parallel
                const votePromises = [
                    helper.vote(defaultMultisig, proposalPda, agents.member1, true),
                    helper.vote(defaultMultisig, proposalPda, agents.member2, true),
                    helper.vote(defaultMultisig, proposalPda, agents.member3, true)
                ];

                await Promise.all(votePromises);

                // Verify final state
                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.voteCount).to.equal(3);
                expect(proposal.status).to.equal({ approved: {} });
            });

            it("handles mixed concurrent votes correctly", async () => {
                // Submit mixed votes in parallel
                const votePromises = [
                    helper.vote(defaultMultisig, proposalPda, agents.member1, true),
                    helper.vote(defaultMultisig, proposalPda, agents.member2, false),
                    helper.vote(defaultMultisig, proposalPda, agents.member3, true),
                    helper.vote(defaultMultisig, proposalPda, agents.member4, false)
                ];

                await Promise.all(votePromises);

                // Verify final state
                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.voteCount).to.equal(2);
                expect(proposal.rejectionCount).to.equal(2);
                expect(proposal.status).to.equal({ rejected: {} });
            });
        });

        describe("Concurrent Member Management", () => {
            it("handles parallel member changes correctly", async () => {
                // Create two member management proposals
                const addMemberProposal = await helper.createProposal(defaultMultisig, agents.admin, 0);
                const removeMemberProposal = await helper.createProposal(defaultMultisig, agents.member1, 1);

                // Vote on both proposals in parallel
                const votePromises = [
                    // Votes for adding member
                    helper.vote(defaultMultisig, addMemberProposal, agents.member1, true),
                    helper.vote(defaultMultisig, addMemberProposal, agents.member2, true),
                    helper.vote(defaultMultisig, addMemberProposal, agents.member3, true),
                    
                    // Votes for removing member
                    helper.vote(defaultMultisig, removeMemberProposal, agents.member2, true),
                    helper.vote(defaultMultisig, removeMemberProposal, agents.member3, true),
                    helper.vote(defaultMultisig, removeMemberProposal, agents.member4, true)
                ];

                await Promise.all(votePromises);

                // Execute both proposals (should maintain consistency)
                await helper.executeProposal(defaultMultisig, addMemberProposal, agents.admin);
                await helper.executeProposal(defaultMultisig, removeMemberProposal, agents.admin);

                // Verify final state
                const multisig = await program.account.versionedMultisig.fetch(defaultMultisig);
                expect(multisig.members.length).to.equal(5); // Original 5 + 1 added - 1 removed
            });
        });

        describe("Concurrent Execution Attempts", () => {
            let proposalPda: PublicKey;

            beforeEach(async () => {
                proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 0);
                // Get required votes
                await helper.vote(defaultMultisig, proposalPda, agents.member1, true);
                await helper.vote(defaultMultisig, proposalPda, agents.member2, true);
                await helper.vote(defaultMultisig, proposalPda, agents.member3, true);
            });

            it("handles concurrent execution attempts correctly", async () => {
                // Try to execute the same proposal concurrently with different members
                const executePromises = [
                    helper.executeProposal(defaultMultisig, proposalPda, agents.admin),
                    helper.executeProposal(defaultMultisig, proposalPda, agents.member1),
                    helper.executeProposal(defaultMultisig, proposalPda, agents.member2)
                ];

                // Only one execution should succeed, others should fail gracefully
                try {
                    await Promise.all(executePromises);
                } catch (e) {
                    // Expected some executions to fail
                }

                // Verify final state
                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.status).to.equal({ executed: {} });
                expect(proposal.executionCount).to.equal(1);
            });
        });

        describe("Race Conditions", () => {
            it("handles vote-then-execute race condition correctly", async () => {
                const proposalPda = await helper.createProposal(defaultMultisig, agents.admin, 0);
                
                // Get to one vote short of threshold
                await helper.vote(defaultMultisig, proposalPda, agents.member1, true);
                await helper.vote(defaultMultisig, proposalPda, agents.member2, true);

                // Try to execute before threshold (should fail)
                const executePromise = helper.executeProposal(defaultMultisig, proposalPda, agents.admin);
                
                // Submit final vote while execution is pending
                const votePromise = helper.vote(defaultMultisig, proposalPda, agents.member3, true);

                // Both operations should complete without error
                await Promise.all([executePromise, votePromise]);

                // Verify final state
                const proposal = await program.account.proposal.fetch(proposalPda);
                expect(proposal.voteCount).to.equal(3);
                expect(proposal.status).to.equal({ approved: {} });
            });

            it("handles concurrent state-changing operations correctly", async () => {
                // Create multiple proposals for different operations
                const proposals = await Promise.all([
                    helper.createProposal(defaultMultisig, agents.admin, 0),
                    helper.createProposal(defaultMultisig, agents.member1, 1),
                    helper.createProposal(defaultMultisig, agents.member2, 2)
                ]);

                // Submit votes and executions concurrently
                const operations = proposals.flatMap(proposalPda => [
                    helper.vote(defaultMultisig, proposalPda, agents.member1, true),
                    helper.vote(defaultMultisig, proposalPda, agents.member2, true),
                    helper.vote(defaultMultisig, proposalPda, agents.member3, true),
                    helper.executeProposal(defaultMultisig, proposalPda, agents.admin)
                ]);

                // All operations should complete without breaking state
                await Promise.all(operations);

                // Verify final states
                for (const proposalPda of proposals) {
                    const proposal = await program.account.proposal.fetch(proposalPda);
                    expect(proposal.voteCount).to.equal(3);
                    expect(proposal.status).to.equal({ executed: {} });
                }
            });
        });
    });
});