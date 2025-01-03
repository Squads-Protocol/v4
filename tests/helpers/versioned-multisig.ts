import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage } from "@solana/web3.js";
import { BN } from "bn.js";
import * as versionedMultisig from "../../sdk/versioned_multisig/";
import { VersionedMember } from "../../sdk/versioned_multisig/lib/generated";
import { Permissions } from "../../sdk/versioned_multisig/lib/types";
import { getVersionedTestProgramId } from "../suites/versioned_multisig/versioned-utils";
import { generateFundedKeypair } from "../utils";

export class VersionedMultisigTestHelper {

    private connection: Connection;
    constructor(connection: Connection) {
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

    async getProgramConfig() {
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
    async getVersionedVaultTransaction(multisig: PublicKey, index: number) {
        const [vaultPda] = versionedMultisig.getVaultPda({
            multisigPda: multisig,
            index: 0,
        });

        const [transactionPda] = versionedMultisig.getTransactionPda({
            multisigPda: multisig,
            index: BigInt(index),
            programId: getVersionedTestProgramId(),
        });

        return versionedMultisig.accounts.VaultTransaction.fromAccountAddress(this.connection, transactionPda);
    }

    async sendSolToCreatorMessage(multisig: PublicKey, creator: Keypair) {
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
        return transferMessage;
    }

    async createVersionedVaultSwapMessage(multisig: PublicKey, creator: Keypair, 
        inputMint: PublicKey = new PublicKey("So11111111111111111111111111111111111111112"), 
        outputMint: PublicKey = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), 
        amount: number = 1 * LAMPORTS_PER_SOL) {

            const [vaultPda] = versionedMultisig.getVaultPda({
                multisigPda: multisig,
                index: 0,
            });

            const swapInstruction = new TransactionInstruction({
                keys: [
                    {
                        "pubkey": new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("GGztQqQ6pCPaJQnNpXBgELr5cs3WwDakRbh1iEMzjgSJ"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("5Dv7YteieVf2Z2sXmPMupU2nRmTwWf8KcFoXdzRbAn9z"),
                        "isSigner": true,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("AtBARd7SooPcKRukNzU1RVFB8wja2cSrn1EZ4UMvECzW"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("DVCeozFGbe6ew3eWTnZByjHeYqTq1cvbrB7JJhkLxaRJ"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("37PWdQKR55JCk7PQrSZqQQA5fMeHAVXBUM5E94X7Nf7H"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("iVJr5HNmqbub3G6F2UeryAt13GMG4VTKSAcYvxZuNUV"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("D8cy77BBepLMngZx6ZukaTff5hCt1HrWyKk3Hnd9oitf"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("swapNyd8XiQwJ6ianp9snpu4brUqFxadzvHebnAXjJZ"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("GGztQqQ6pCPaJQnNpXBgELr5cs3WwDakRbh1iEMzjgSJ"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("DVCeozFGbe6ew3eWTnZByjHeYqTq1cvbrB7JJhkLxaRJ"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("HkphEpUqnFBxBuCPEq5j1HA9L8EwmsmRT6UcFKziptM1"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("AioJRQXvcDLRhHMd6DAkTbbMpgVx63qSGQYmRBS2vHYA"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("95QUtvDkuoDZrNJiuh9MdahkpRNtSVhZRe83oepd8AM7"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("4CQUrzq6qaVtMVtWEL2CvaZjqBUxnMJtBgM6M3hHHDsJ"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("HzSLnvskLm9q78shVY6zVSPjHSdeSJBMxz7Qc3N9nxPd"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("8BSWYgAczR36C7ukr32v7uTepoRhYJYxAVnpBtYniZTm"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("stab1io8dHvK26KoHmTwwHyYmHRbUWbyEJx6CdrGabC"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("7imnGYfCovXjMWKdbQvETFVMe72MQDX4S5zW4GFxMJME"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("vo1tWgqZMjG61Z2T9qUaMYKqZ75CYzMuaZ2LZP1n7HV"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("swapFpHZwjELNnjvThjajtiVmkz3yPQEHjLtka2fwHW"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("GGztQqQ6pCPaJQnNpXBgELr5cs3WwDakRbh1iEMzjgSJ"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("HkphEpUqnFBxBuCPEq5j1HA9L8EwmsmRT6UcFKziptM1"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("g7dD1FHSemkUQrX1Eak37wzvDjscgBW2pFCENwjLdMX"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("8ixuhwF2JqyT9VgRCdT8bt2YeKNRh6RFH9P7e98Fdk9D"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("HoAHDQss5qzYkoKPXtRJRHCQrUWxcHvs4vmZ8QsN4nSq"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("BsbLpWV33QXj1rSmNeNvMjAgUfe548ayzbYEFsoCfWfq"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("2KRa7iFpRUHXczLkeGG4KeRFcpoR7vVKZYT7a5uBwuim"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("BXj5a4J5YDByKzd3Y7NU59QDrjy1KcH1dCbftsxJGmna"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("w8edo9a9TDw52c1rBmVbP6dNakaAuFiPjDd52ZJwwVi"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("7HkzG4LYyCJSrD3gopPQv3VVzQQKbHBZcm9fbjj5fuaH"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("vo1tWgqZMjG61Z2T9qUaMYKqZ75CYzMuaZ2LZP1n7HV"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("GGztQqQ6pCPaJQnNpXBgELr5cs3WwDakRbh1iEMzjgSJ"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("6BiuT5BT2ZUVgvtzrsn7fReRquKY78C7TFsp57qXkczu"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("So11111111111111111111111111111111111111112"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("ED5nyyWEzpPPiWimP8vYm7sD7TD3LAt3Q3gRTWHzPJBY"),
                        "isSigner": false,
                        "isWritable": false
                    },
                    {
                        "pubkey": new PublicKey("g7dD1FHSemkUQrX1Eak37wzvDjscgBW2pFCENwjLdMX"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("B6UQ2e4VEaWsEJijSvFMfgbrr6TwU7gh25DAv69Ug2pd"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("37PWdQKR55JCk7PQrSZqQQA5fMeHAVXBUM5E94X7Nf7H"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("82cDbc7FoiQcNNqGEhrp8H3ny454ofC8cqiKa5cVy1ar"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("6d7wtS7fFkr8sWHUwzezpQPebVDBfSV88e6Fzw6VoLw2"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("24DYyaxEvcrDfnoEUj2WSkW3muzqLmRZgbwkM55rZ9qb"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("EiKcLpJA7BuFwHc48ykNWAtYd98vTyUJB9iNowj6wqhb"),
                        "isSigner": false,
                        "isWritable": true
                    },
                    {
                        "pubkey": new PublicKey("BPTkmyhmxhZu83wY9zs3f1QX3o19gD2SgBrhnQbV9THz"),
                        "isSigner": false,
                        "isWritable": true
                    }
                ],
                programId: new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"),
                data: Buffer.from("wSCbM0HWnIEAAwAAADhkAAE5ZAECLwEAZAIDQuH1BQAAAADFhW0UAAAAADIAAA==", "base64"),
            });
            
        return new TransactionMessage({
            payerKey: vaultPda,
            recentBlockhash: (await this.connection.getLatestBlockhash()).blockhash,
            instructions: [swapInstruction],
        });
    }

    async createVersionedVaultTransaction(
        multisig: PublicKey,
        creator: Keypair,
    ) {
        return this.createVersionedVaultTransactionWithMessage(multisig, creator, await this.sendSolToCreatorMessage(multisig, creator));
    }

    async createVersionedVaultTransactionWithMessage(
        multisig: PublicKey,
        creator: Keypair,
        message: TransactionMessage
    ) {
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
            transactionMessage: message,
            memo: "Transfer 0.1 SOL to creator",
            programId: getVersionedTestProgramId(),
        });
        console.log("signature1", signature1);
        await this.connection.confirmTransaction(signature1);
        console.log("versionedVaultTransactionCreate", await this.connection.getTransaction(signature1, {
            maxSupportedTransactionVersion: 0,
        }));

        const [transactionPda] = versionedMultisig.getTransactionPda({
            multisigPda: multisig,
            index: newTransactionIndex,
            programId: getVersionedTestProgramId(),
        });
        console.log("transactionPda", transactionPda.toBase58());
        return { signature1, transactionPda };
    }

    async createVersionedProposal(
        multisig: PublicKey,
        creator: Keypair,
        index: number
    ) {
        const [proposalPda, _] = await this.getVersionedProposalPda(multisig, index);
        console.log("proposalPda", proposalPda.toBase58());
        const sig = await versionedMultisig.rpc.versionedProposalCreate({
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

        return { sig, proposalPda };
    }

    async vote(
        multisig: PublicKey,
        proposal: PublicKey,
        voter: Keypair,
        approve: boolean
    ) {
        const sig = await versionedMultisig.rpc.versionedProposalVote({
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
    generateMembers(count: number, permissions: Permissions = Permissions.all(), joinProposalIndex: number = 0): (VersionedMember & { keyPair: Keypair })[] {
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




    async executeVaultTransaction(
        multisig: PublicKey,
        transactionIndex: number,
        executor: Keypair
    ) {
        const sig = await versionedMultisig.rpc.vaultTransactionExecute({
            connection: this.connection,
            feePayer: executor,
            multisigPda: multisig,
            transactionIndex: BigInt(transactionIndex),
            member: executor.publicKey,
            programId: getVersionedTestProgramId(),
        });
        await this.connection.confirmTransaction(sig);
        // console.log("versionedVaultTransactionExecute", await this.connection.getTransaction(sig, {
        //     maxSupportedTransactionVersion: 0,
        // }));
        return sig;
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