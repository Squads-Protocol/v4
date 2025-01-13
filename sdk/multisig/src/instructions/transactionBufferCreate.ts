import { AddressLookupTableAccount, PublicKey, TransactionInstruction, TransactionMessage } from "@solana/web3.js";
import { createTransactionBufferCreateInstruction, PROGRAM_ID } from "../generated";
import { getTransactionBufferPda, getVaultPda } from "../pda";
import { transactionMessageToMultisigTransactionMessageBytes } from "../utils";

export async function createTransactionBuffer({
    multisig,
    creator,
    rentPayer,
    vaultIndex,
    bufferIndex,
    transactionMessage,
    lookupTableAccounts,
    programId = PROGRAM_ID,
}: {
    multisig: PublicKey,
    creator: PublicKey,
    rentPayer: PublicKey,
    vaultIndex: number,
    bufferIndex: number,
    transactionMessage: TransactionMessage,
    lookupTableAccounts: AddressLookupTableAccount[],
    programId?: PublicKey,
}): Promise<{ instruction: TransactionInstruction, remainingBuffer: Uint8Array }> {
    const [vaultPda] = getVaultPda({
        multisigPda: multisig,
        index: vaultIndex,
        programId: programId,
    })
    const [transactionBuffer] = getTransactionBufferPda({
        multisig,
        creator,
        bufferIndex,
        programId: programId,
    })

    const transactionBytes = transactionMessageToMultisigTransactionMessageBytes({
        message: transactionMessage,
        addressLookupTableAccounts: lookupTableAccounts,
        vaultPda: vaultPda,
    })

    // Hash the transaction bytes using SHA-256
    const finalBufferHash = Buffer.from(
        await crypto.subtle.digest('SHA-256', transactionBytes)
    )

    // Set the buffer chunk and size
    const finalBufferSize = transactionBytes.length

    // First Buffer Chunk
    const firstBufferChunk = transactionBytes.slice(0, 800)
    const remainingBuffer = transactionBytes.slice(800)
    const instruction = createTransactionBufferCreateInstruction({
        multisig: multisig,
        transactionBuffer: transactionBuffer,
        creator: creator,
        rentPayer: rentPayer,
    }, {
        args: {
            vaultIndex: vaultIndex,
            bufferIndex: bufferIndex,
            buffer: firstBufferChunk,
            finalBufferSize: finalBufferSize,
            finalBufferHash: [...finalBufferHash],
        }
    },
        programId
    )
    return {
        instruction: instruction,
        remainingBuffer: remainingBuffer,
    }

}