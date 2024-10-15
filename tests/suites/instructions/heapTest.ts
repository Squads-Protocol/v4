import {
    ComputeBudgetProgram,
    Keypair,
    LAMPORTS_PER_SOL,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import {
    HeapTestInstructionArgs
} from "@sqds/multisig/lib/generated";
import {
    createLocalhostConnection,
    getTestProgramId
} from "../../utils";

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / transaction_buffer_close", () => {
    it("heap test", async () => {

        let keypair = Keypair.generate();
        // Request airdrop
        let signature = await connection.requestAirdrop(
            keypair.publicKey,
            10 * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(signature);
        const createArgs: HeapTestInstructionArgs = {
            length: 25000,
        };
        const heapTestIx = multisig.generated.createHeapTestInstruction(
            {
                authority: keypair.publicKey,
            },
            createArgs,
            programId
        );
        const computeBudgetIx = ComputeBudgetProgram.requestHeapFrame({
            bytes: 8 * 32 * 1024
        });
        const computeBudgetCUIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_400_000
        });
        // const heapTestMessage = new TransactionMessage({
        //     payerKey: keypair.publicKey,
        //     recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
        //     instructions: [computeBudgetIx, computeBudgetCUIx, heapTestIx],
        // }).compileToV0Message();
        const heapTestMessage = new TransactionMessage({
            payerKey: keypair.publicKey,
            recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
            instructions: [computeBudgetCUIx, heapTestIx],
        }).compileToV0Message();
        const heapTestTx = new VersionedTransaction(heapTestMessage);
        heapTestTx.sign([keypair]);
        const heapTestSig = await connection.sendRawTransaction(heapTestTx.serialize(), { skipPreflight: true });
        console.log(heapTestSig);
        await connection.confirmTransaction(heapTestSig);



    });
});