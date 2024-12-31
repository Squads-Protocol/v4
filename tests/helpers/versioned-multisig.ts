import { Connection, Keypair, PublicKey, TransactionInstruction,SystemProgram, TransactionMessage, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as versionedMultisig from "../../sdk/versioned_multisig/";
import { VersionedMember } from "../../sdk/versioned_multisig/lib/generated";
import { Permissions } from "../../sdk/versioned_multisig/lib/types";
import { getVersionedTestProgramId } from "../suites/versioned_multisig/versioned-utils";
import { generateFundedKeypair } from "../utils";
import { BN } from "bn.js";

export class VersionedMultisigTestHelper {

    private connection: Connection;
    constructor( connection: Connection) {
        this.connection = connection;
    }

    async addVersionedMultisigMember(
        multisig: PublicKey,
        feePayer: Keypair,
        configAuthority: PublicKey,
        rentPayer: Keypair,
        member: VersionedMember,
        signers: Keypair[]
    ) {
        const [result, blockhash] = await versionedMultisig.rpc.versionedMultisigAddMember({
            connection: this.connection,
            feePayer: feePayer,
            configAuthority: configAuthority,
            rentPayer: rentPayer,
            multisigPda: multisig,
            newMember: member,
            programId: getVersionedTestProgramId(),
            signers
        });
        await this.connection.confirmTransaction({
            signature: result,
            blockhash: blockhash.blockhash,
            lastValidBlockHeight: blockhash.lastValidBlockHeight
        });
        console.log("versionedMultisigAddMember", await this.connection.getTransaction(result, {
            maxSupportedTransactionVersion: 0,
        }));
    }

    async getProgramConfig(){ 
        const programConfigPda = versionedMultisig.getProgramConfigPda({ programId: getVersionedTestProgramId() })[0];
        const programConfig =
            await versionedMultisig.accounts.ProgramConfig.fromAccountAddress(
                this.connection,
                programConfigPda
            );
        return programConfig;
    }

    async createVersionedMultisig(
        members: VersionedMember[],
        threshold: number,
        timeLock: number = 0
    ) {
        const programConfigPda = versionedMultisig.getProgramConfigPda({ programId: getVersionedTestProgramId() })[0];
        const programConfig =
            await versionedMultisig.accounts.ProgramConfig.fromAccountAddress(
                this.connection,
                programConfigPda
            );
        // console.log("programConfig", JSON.stringify(programConfig, null, 2));
        const creator = await generateFundedKeypair(this.connection);
            const [multisigPda, multisigBump] = versionedMultisig.getMultisigPda({
                createKey: creator.publicKey,
                programId: getVersionedTestProgramId(),
            });
            console.log("multisigPda", multisigPda.toBase58());
            const [signature, blockhash] = await versionedMultisig.rpc.versionedMultisigCreate({
                connection: this.connection,
                treasury: programConfig.treasury,
                createKey: creator,
                creator,
                multisigPda,
                configAuthority: programConfig.authority,
                threshold,
                members: members,
                rentCollector: null,
                timeLock,
                programId: getVersionedTestProgramId(),
            });
            console.log("versionedMultisigCreate - sig", signature);
            await this.connection.confirmTransaction({
                signature,
                blockhash: blockhash.blockhash,
                lastValidBlockHeight: blockhash.lastValidBlockHeight,
            });
        return { multisigPda, createKey: creator };
    }

    async getVersionedProposalPda(multisig: PublicKey, index: number) {
        return PublicKey.findProgramAddressSync(
            [
                Buffer.from("multisig"),
                multisig.toBuffer(),
                Buffer.from("transaction"),
                Buffer.from(new Uint8Array(new BN(index).toArray("le", 8))),
                Buffer.from("proposal"),
              ],
            getVersionedTestProgramId()
        );
    }

    async airdrop(to: PublicKey, lamports: number) {
        const sig = await this.connection.requestAirdrop(to, lamports);
        await this.connection.confirmTransaction(sig);
        return sig;
    }

    async getVersionedProposal(multisig: PublicKey, index: number) {
        const [proposalPda] = await this.getVersionedProposalPda(multisig, index);
        return versionedMultisig.accounts.Proposal.fromAccountAddress(this.connection, proposalPda);
    }

    async createVersionedVaultTransaction(
        multisig: PublicKey,
        creator: Keypair,
    ) {

        const [vaultPda] = versionedMultisig.getVaultPda({
            multisigPda: multisig,
            index: 0,
          });

          const instruction = SystemProgram.transfer({
            // The transfer is being signed from the Squads Vault, that is why we use the VaultPda
            fromPubkey: vaultPda,
            toPubkey: creator.publicKey,
            lamports: 1 * LAMPORTS_PER_SOL,
          });
          // This message contains the instructions that the transaction is going to execute
          const transferMessage = new TransactionMessage({
            payerKey: vaultPda,
            recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
            instructions: [instruction],
          });
      
          // Get the current multisig transaction index
          const multisigInfo = await versionedMultisig.accounts.VersionedMultisig.fromAccountAddress(
            this.connection,
            multisig
          );
  
      const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  
        const newTransactionIndex = BigInt(currentTransactionIndex + 1);

        const [signature1, blockhash] = await versionedMultisig.rpc.vaultTransactionCreate({
            connection: this.connection,
            feePayer: creator,
            multisigPda: multisig,
            transactionIndex: newTransactionIndex,
            creator: creator.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: transferMessage,
            memo: "Transfer 0.1 SOL to creator",
            programId: getVersionedTestProgramId(),
        });
        console.log("signature1", signature1);
        await this.connection.confirmTransaction(signature1);
        return signature1;
    }

    async createVersionedProposal(
        multisig: PublicKey,
        creator: Keypair,
        index: number
    ) {
        const [proposalPda, _] = await this.getVersionedProposalPda(multisig, index);
        console.log("proposalPda", proposalPda.toBase58());
        const sig =  await versionedMultisig.rpc.versionedProposalCreate({
            connection: this.connection,
            multisigPda: multisig,
            creator: creator,
            transactionIndex: BigInt(index),
            programId: getVersionedTestProgramId(),
        });
        await this.connection.confirmTransaction(sig);
        console.log("versionedProposalCreate", await this.connection.getTransaction(sig, {
            maxSupportedTransactionVersion: 0,
        }));

        return {sig,proposalPda};
    }

    async vote(
        multisig: PublicKey,
        proposal: PublicKey,
        voter: Keypair,
        approve: boolean
    ) {
        const sig =  await versionedMultisig.rpc.versionedProposalVote({
            connection: this.connection,
            multisigPda: multisig,
            proposalPda: proposal,
            voter: voter,
            approve: approve,
            programId: getVersionedTestProgramId(),
        });
        await this.connection.confirmTransaction(sig);
        console.log("versionedProposalVote", await this.connection.getTransaction(sig, {
            maxSupportedTransactionVersion: 0,
        }));
        return sig;
    }

    // Helper to generate test members
    generateMembers(count: number, permissions: Permissions = Permissions.all(), joinProposalIndex: number = 0): (VersionedMember & {keyPair: Keypair})[] {
        return Array(count)
            .fill(0)
            .map(() => {
                const keyPair = Keypair.generate();
                return ({
                    key: keyPair.publicKey,
                    keyPair,
                    permissions,
                    joinProposalIndex
                });
            });
    }


    async createProposalWithInstruction(
        multisig: PublicKey,
        creator: Keypair,
        index: number,
        instruction: TransactionInstruction
    ) {
        return this.createVersionedProposalWithInstructions(multisig, creator, index, [instruction]);
    }

    async createVersionedProposalWithInstructions(
        multisig: PublicKey,
        creator: Keypair,
        index: number,
        instructions: TransactionInstruction[]
    ) {
        const [proposalPda] = await this.getVersionedProposalPda(multisig, index);
        await this.createVersionedProposal(multisig, creator, index);
        await versionedMultisig.rpc.versionedProposalCreate({
            connection: this.connection,
            multisigPda: multisig,
            creator: creator,
            transactionIndex: BigInt(index),
            programId: getVersionedTestProgramId(),
        });
        await versionedMultisig.rpc.vaultTransactionCreate({
            connection: this.connection,
            feePayer: creator,
            multisigPda: multisig,
            transactionIndex: BigInt(index),
            creator: creator.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: new TransactionMessage({
                payerKey: creator.publicKey,
                recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
                instructions: instructions,
            }),
            programId: getVersionedTestProgramId(),
        });
        
        return proposalPda;
    }


    async executeVaultTransaction(
        multisig: PublicKey,
        transactionIndex: number,
        executor: Keypair
    ) {
        await versionedMultisig.rpc.vaultTransactionExecute({
            connection: this.connection,
            feePayer: executor,
            multisigPda: multisig,
            transactionIndex: BigInt(transactionIndex),
            member: executor.publicKey,
            programId: getVersionedTestProgramId(),
        });
    }

    async removeVersionedMultisigMember(
        multisig: PublicKey,
        feePayer: Keypair,
        configAuthority: PublicKey,
        rentCollector: Keypair,
        memberKey: PublicKey,
        signers: Keypair[]
    ) {
        const [result, blockhash] = await versionedMultisig.rpc.versionedMultisigRemoveMember({
            connection: this.connection,
            feePayer,
            configAuthority,
            oldMember: memberKey,
            multisigPda: multisig,
            programId: getVersionedTestProgramId(),
            signers
        });
        await this.connection.confirmTransaction(result);
        return result;
    }
}