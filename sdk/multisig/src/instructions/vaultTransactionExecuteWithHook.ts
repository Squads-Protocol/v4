import {
    AddressLookupTableAccount,
    Connection,
    PublicKey,
    TransactionInstruction,
} from "@solana/web3.js";
import {
    createVaultTransactionExecuteWithHookInstruction,
    PROGRAM_ID,
    VaultTransaction,
} from "../generated";
import { getProposalPda, getTransactionPda, getVaultPda } from "../pda";
import { accountsForTransactionExecute } from "../utils";

export async function vaultTransactionExecuteWithHook({
    connection,
    multisigPda,
    transactionIndex,
    member,
    hookConfig,
    hookAuthority,
    hookProgram,
    programId = PROGRAM_ID,
}: {
    connection: Connection;
    multisigPda: PublicKey;
    transactionIndex: bigint;
    member: PublicKey;
    hookConfig: PublicKey;
    hookAuthority: PublicKey;
    hookProgram: PublicKey;
    programId?: PublicKey;
}): Promise<{
    instruction: TransactionInstruction;
    lookupTableAccounts: AddressLookupTableAccount[];
}> {
    const [proposalPda] = getProposalPda({
        multisigPda,
        transactionIndex,
        programId,
    });
    const [transactionPda] = getTransactionPda({
        multisigPda,
        index: transactionIndex,
        programId,
    });
    const transactionAccount = await VaultTransaction.fromAccountAddress(
        connection,
        transactionPda
    );

    const [vaultPda] = getVaultPda({
        multisigPda,
        index: transactionAccount.vaultIndex,
        programId,
    });

    const { accountMetas, lookupTableAccounts } =
        await accountsForTransactionExecute({
            connection,
            message: transactionAccount.message,
            ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
            vaultPda,
            transactionPda,
            programId,
        });

    return {
        instruction: createVaultTransactionExecuteWithHookInstruction(
            {
                multisig: multisigPda,
                member,
                proposal: proposalPda,
                transaction: transactionPda,
                hookConfig,
                hookAuthority,
                hookProgram,
                anchorRemainingAccounts: accountMetas,
            },
            programId
        ),
        lookupTableAccounts,
    };
}
