import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";
import { createVaultTransactionCreateFromBufferInstruction, PROGRAM_ID } from "../generated";
import { getTransactionBufferPda, getTransactionPda } from "../pda";

export async function createVaultTransactionFromBuffer({
    multisig,
    creator,
    rentPayer,
    vaultIndex,
    transactionIndex,
    ephemeralSigners,
    bufferIndex,
    programId = PROGRAM_ID,
}: {
    multisig: PublicKey,
    creator: PublicKey,
    rentPayer?: PublicKey,
    vaultIndex: number,
    transactionIndex: bigint,
    ephemeralSigners: number,
    bufferIndex: number,
    programId?: PublicKey,
}): Promise<TransactionInstruction> {
    const [vaultTransactionPda] = getTransactionPda({
        multisigPda: multisig,
        index: transactionIndex,
        programId: programId,
    })
    const [transactionBuffer] = getTransactionBufferPda({
        multisig,
        creator,
        bufferIndex,
        programId: programId,
    })


    return createVaultTransactionCreateFromBufferInstruction({
        vaultTransactionCreateItemMultisig: multisig,
        vaultTransactionCreateItemCreator: creator,
        vaultTransactionCreateItemTransaction: vaultTransactionPda,
        vaultTransactionCreateItemRentPayer: rentPayer ?? creator,
        vaultTransactionCreateItemSystemProgram: SystemProgram.programId,
        transactionBuffer: transactionBuffer,
        creator: creator,
    }, {
        args: {
            vaultIndex: vaultIndex,
            ephemeralSigners: ephemeralSigners,
            transactionMessage: new Uint8Array(6).fill(0),
            memo: null,
        }
    },
        programId
    )


}