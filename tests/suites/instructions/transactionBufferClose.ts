import {
    Keypair,
    LAMPORTS_PER_SOL,
    PublicKey,
    SystemProgram,
    TransactionMessage,
    VersionedTransaction,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
    TransactionBufferCreateArgs,
    TransactionBufferCreateInstructionArgs,
} from "@sqds/multisig/lib/generated";
import assert from "assert";
import { BN } from "bn.js";
import * as crypto from "crypto";
import {
    TestMembers,
    createAutonomousMultisigV2,
    createLocalhostConnection,
    createTestTransferInstruction,
    generateMultisigMembers,
    getTestProgramId,
} from "../../utils";

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / transaction_buffer_close", () => {
    let members: TestMembers;
    let multisigPda: PublicKey;
    let vaultPda: PublicKey;
    let transactionBuffer: PublicKey;

    const createKey = Keypair.generate();

    before(async () => {
        members = await generateMultisigMembers(connection);

        multisigPda = (await createAutonomousMultisigV2({
            connection,
            createKey,
            members,
            threshold: 2,
            timeLock: 0,
            rentCollector: vaultPda,
            programId,
        }))[0];

        [vaultPda] = multisig.getVaultPda({
            multisigPda,
            index: 0,
            programId,
        });

        let signature = await connection.requestAirdrop(
            vaultPda,
            10 * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(signature);

        const transactionIndex = 1n;
        const testIx = await createTestTransferInstruction(
            vaultPda,
            Keypair.generate().publicKey,
            0.1 * LAMPORTS_PER_SOL
        );

        const testTransferMessage = new TransactionMessage({
            payerKey: vaultPda,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [testIx],
        });

        const messageBuffer = multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
            message: testTransferMessage,
            addressLookupTableAccounts: [],
            vaultPda,
        });

        [transactionBuffer] = await PublicKey.findProgramAddressSync(
            [
                Buffer.from("multisig"),
                multisigPda.toBuffer(),
                Buffer.from("transaction_buffer"),
                new BN(Number(transactionIndex)).toBuffer("le", 8),
            ],
            programId
        );

        const messageHash = crypto
            .createHash("sha256")
            .update(messageBuffer)
            .digest();

        const createIx = multisig.generated.createTransactionBufferCreateInstruction(
            {
                multisig: multisigPda,
                transactionBuffer,
                creator: members.proposer.publicKey,
                rentPayer: members.proposer.publicKey,
                systemProgram: SystemProgram.programId,
            },
            {
                args: {
                    vaultIndex: 0,
                    finalBufferHash: Array.from(messageHash),
                    finalBufferSize: messageBuffer.length,
                    buffer: messageBuffer,
                } as TransactionBufferCreateArgs,
            } as TransactionBufferCreateInstructionArgs,
            programId
        );

        const createMessage = new TransactionMessage({
            payerKey: members.proposer.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [createIx],
        }).compileToV0Message();

        const createTx = new VersionedTransaction(createMessage);
        createTx.sign([members.proposer]);

        const createSig = await connection.sendTransaction(createTx, { skipPreflight: true });
        await connection.confirmTransaction(createSig);
    });

    it("error: close buffer with non-creator signature", async () => {
        const closeIx = multisig.generated.createTransactionBufferCloseInstruction(
            {
                multisig: multisigPda,
                transactionBuffer,
                creator: members.voter.publicKey,
            },
            programId
        );

        const closeMessage = new TransactionMessage({
            payerKey: members.voter.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [closeIx],
        }).compileToV0Message();

        const closeTx = new VersionedTransaction(closeMessage);
        closeTx.sign([members.voter]);

        await assert.rejects(
            () =>
                connection
                    .sendTransaction(closeTx)
                    .catch(multisig.errors.translateAndThrowAnchorError),
            /Unauthorized/
        );
    });

    it("close buffer with creator signature", async () => {
        const closeIx = multisig.generated.createTransactionBufferCloseInstruction(
            {
                multisig: multisigPda,
                transactionBuffer,
                creator: members.proposer.publicKey,
            },
            programId
        );

        const closeMessage = new TransactionMessage({
            payerKey: members.proposer.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [closeIx],
        }).compileToV0Message();

        const closeTx = new VersionedTransaction(closeMessage);
        closeTx.sign([members.proposer]);

        const closeSig = await connection.sendTransaction(closeTx, { skipPreflight: true });
        await connection.confirmTransaction(closeSig);
        const transactionBufferAccount = await connection.getAccountInfo(transactionBuffer);
        assert.equal(transactionBufferAccount, null, "Transaction buffer account should be closed");
    });
});