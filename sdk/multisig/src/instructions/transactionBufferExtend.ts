import { PublicKey, AddressLookupTableAccount, TransactionInstruction } from "@solana/web3.js";
import { createTransactionBufferExtendInstruction, PROGRAM_ID } from "../generated";
import { getTransactionBufferPda } from "../pda";

export async function createTransactionBufferExtend({
    multisig,
    creator,
    bufferIndex,
    buffer,
    programId = PROGRAM_ID,
}: {
    multisig: PublicKey,
    creator: PublicKey,
    bufferIndex: number,
    buffer: Uint8Array,
    programId?: PublicKey,
}): Promise<{ instruction: TransactionInstruction, remainingBuffer: Uint8Array }> {

    const [transactionBuffer] = getTransactionBufferPda({
        multisig,
        creator,
        bufferIndex,
        programId,
    })

    const chunk = buffer.slice(0, 800);
    const remainingBuffer = buffer.slice(800)

    const instruction = createTransactionBufferExtendInstruction({
        multisig: multisig,
        transactionBuffer: transactionBuffer,
        creator: creator,
    }, {
        args: {
            buffer: chunk,
        }
    },
        programId
    );
    return {
        instruction: instruction,
        remainingBuffer: remainingBuffer,
    }

}