import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { SquadsMultisigProgram } from "../../target/types/squads_multisig_program";
import { Token, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { BN } from "@project-serum/anchor";
import { RetryConditionManager, RetryScenario } from './retry-conditions';

export class VersionedMultisigTestHelper {
    private retryManager?: RetryConditionManager;

    constructor(
        private program: Program<SquadsMultisigProgram>,
        private provider: anchor.AnchorProvider,
        enableRetryConditions: boolean = false
    ) {
        if (enableRetryConditions) {
            this.retryManager = new RetryConditionManager(program, provider);
        }
    }

    async createMultisig(
        members: { key: PublicKey; permissions: number }[],
        threshold: number,
        timeLock: number = 0
    ) {
        const createKey = Keypair.generate();
        
        const [multisigPda] = PublicKey.findProgramAddressSync(
            [Buffer.from("squad"), createKey.publicKey.toBuffer()],
            this.program.programId
        );

        await this.program.methods
            .createVersionedMultisig(threshold, timeLock, members)
            .accounts({
                creator: this.provider.wallet.publicKey,
                createKey: createKey.publicKey,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([createKey])
            .rpc();

        return { multisigPda, createKey };
    }

    async createProposal(
        multisig: PublicKey,
        creator: Keypair,
        index: number
    ) {
        const [proposalPda] = PublicKey.findProgramAddressSync(
            [
                Buffer.from("proposal"),
                multisig.toBuffer(),
                Buffer.from(index.toString())
            ],
            this.program.programId
        );

        await this.program.methods
            .createVersionedProposal()
            .accounts({
                multisig,
                proposal: proposalPda,
                creator: creator.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([creator])
            .rpc();

        return proposalPda;
    }

    async vote(
        multisig: PublicKey,
        proposal: PublicKey,
        voter: Keypair,
        approve: boolean
    ) {
        await this.program.methods
            .voteOnVersionedProposal(approve)
            .accounts({
                multisig,
                proposal,
                voter: voter.publicKey,
            })
            .signers([voter])
            .rpc();
    }

    // Helper to generate test members
    generateMembers(count: number, permissions: number = 7) {
        return Array(count)
            .fill(0)
            .map(() => ({
                key: Keypair.generate().publicKey,
                permissions,
            }));
    }

    async createProposalWithInstruction(
        multisig: PublicKey,
        creator: Keypair,
        instruction: TransactionInstruction
    ) {
        return this.createProposalWithInstructions(multisig, creator, [instruction]);
    }

    async createProposalWithInstructions(
        multisig: PublicKey,
        creator: Keypair,
        instructions: TransactionInstruction[]
    ) {
        const [proposalPda] = await this.getProposalPda(multisig);
        
        await this.program.methods
            .createVersionedProposal({ instructions })
            .accounts({
                multisig,
                proposal: proposalPda,
                creator: creator.publicKey,
                systemProgram: SystemProgram.programId,
            })
            .signers([creator])
            .rpc();

        return proposalPda;
    }

    async createProposalWithRetryableInstruction(
        multisig: PublicKey,
        creator: Keypair,
        scenario?: RetryScenario
    ) {
        if (!this.retryManager) {
            throw new Error("Retry conditions not enabled");
        }

        const instruction = scenario 
            ? await this.retryManager.createRetryableInstruction(scenario)
            : {
                programId: SystemProgram.programId,
                keys: [],
                data: Buffer.from([])
            };
        
        return this.createProposalWithInstruction(multisig, creator, instruction);
    }

    async setupSuccessConditions(scenario: RetryScenario) {
        if (!this.retryManager) {
            throw new Error("Retry conditions not enabled");
        }
        
        return this.retryManager.setupConditions(scenario);
    }

    async executeProposal(
        multisig: PublicKey,
        proposal: PublicKey,
        executor: Keypair
    ) {
        await this.program.methods
            .executeVersionedProposal()
            .accounts({
                multisig,
                proposal,
                executor: executor.publicKey,
            })
            .signers([executor])
            .rpc();
    }
}