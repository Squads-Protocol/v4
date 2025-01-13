import { AddressLookupTableAccount, AddressLookupTableProgram, ComputeBudgetProgram, Connection, Keypair, PublicKey, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import fs from "fs";


const programID = new PublicKey("STAG3xkFMyVK3sRtQhipsKuLpRGbgospDpVdNyJqDpS");
const { Permissions } = multisig.types
const connection = new Connection(process.env.HELIUS_RPC || "")

const multisigPda = new PublicKey("41FocSURJh7gCyrjdY7kaZ4LNcERfTbdPAgkZxqbHsov")
const member = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('swpHVEsK1x3GvhFsFvbuLCypnphg9EY5EyUKu5RWFvx.json', 'utf-8'))));

const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
    microLamports: 800_000,
})
const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
    units: 100_000,
})
const jupComputeLimit = ComputeBudgetProgram.setComputeUnitLimit({
    units: 1_400_000,
})
const heapIx = ComputeBudgetProgram.requestHeapFrame({
    bytes: 262144
})
const alt = new PublicKey("6UpjQ9oG6sW6psqmtmEwghjzeHGaZT7rNNEqzrGggSeZ")

const createMultisig = async () => {
    const member = Keypair.fromSecretKey(new Uint8Array(JSON.parse(fs.readFileSync('swpHVEsK1x3GvhFsFvbuLCypnphg9EY5EyUKu5RWFvx.json', 'utf-8'))));
    console.log(member.publicKey.toBase58())
    const programConfigPda = multisig.getProgramConfigPda({
        programId: programID,
    })
    const programConfig = await multisig.accounts.ProgramConfig.fromAccountAddress(connection, programConfigPda[0]);
    const createKey = Keypair.generate();
    const multisigPda = multisig.getMultisigPda({
        programId: programID,
        createKey: createKey.publicKey,
    })
    const tx = await multisig.rpc.multisigCreateV2({
        connection,
        treasury: programConfig.treasury,
        createKey: createKey,
        creator: member,
        multisigPda: multisigPda[0],
        configAuthority: null,
        threshold: 1,
        members: [{
            key: member.publicKey,
            permissions: Permissions.all()
        }],
        timeLock: 0,
        rentCollector: member.publicKey,
        memo: "",
        programId: programID,
    })
    console.log("tx: ", tx)
    console.log("multisig: ", multisigPda[0].toBase58())
}

const swap = async () => {
    const computeUnitPriceIx = ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 200_000,
    })
    const computeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
        units: 200_000,
    })
    const vaultPda = multisig.getVaultPda({
        programId: programID,
        index: 0,
        multisigPda: multisigPda,
    })

    const quoteResponse = await (
        await fetch('https://quote-api.jup.ag/v6/quote?inputMint=prgnSYr57EiEMUknwPrdaUSMyd4eFpdZDVBaa1xR2jY\&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\&amount=52590000\&slippageBps=50\&maxAccounts=59'
        )
    ).json();
    console.log("quoteResponse: ", quoteResponse)
    const { swapTransaction } = await (
        await fetch('https://quote-api.jup.ag/v6/swap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                // quoteResponse from /quote api
                quoteResponse,
                // user public key to be used for the swap
                userPublicKey: vaultPda[0].toString(),
                // auto wrap and unwrap SOL. default is true
                wrapAndUnwrapSol: true,
                // feeAccount is optional. Use if you want to charge a fee.  feeBps must have been passed in /quote API.
                // feeAccount: "fee_account_public_key"
            })
        })
    ).json();

    const swapTransactionBuf = Buffer.from(swapTransaction, 'base64');
    var transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    const addressLookupTableAccounts = await Promise.all(transaction.message.addressTableLookups.map(async (lookup) => {
        const accountInfo = await connection.getAccountInfo(lookup.accountKey)
        if (!accountInfo?.data) {
            throw new Error("Account info not found")
        }
        const state = AddressLookupTableAccount.deserialize(accountInfo.data)
        return {
            key: lookup.accountKey,
            state: state,
            isActive: () => true,
        }
    }))
    console.log("addressLookupTableAccounts: ", transaction.message.addressTableLookups.length)
    const transactionMessage = TransactionMessage.decompile(transaction.message, { addressLookupTableAccounts })
    const legacyMessage = transactionMessage.compileToLegacyMessage()
    console.log("account length: ", legacyMessage.accountKeys.length)
    if (legacyMessage.accountKeys.length < 45) throw new Error("Account keys length is less than 50")
    // Wait 3s
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log("lookups legacy:", legacyMessage.addressTableLookups.length)
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
    const transactionIndex = Number(multisigAccount.transactionIndex) + 1
    const createTransactionTx = await multisig.rpc.vaultTransactionCreate({
        connection,
        feePayer: member,
        multisigPda: multisigPda,
        transactionIndex: BigInt(transactionIndex),
        creator: member.publicKey,
        rentPayer: member.publicKey,
        programId: programID,
        ephemeralSigners: 0,
        vaultIndex: 0,
        transactionMessage: transactionMessage,
        addressLookupTableAccounts: addressLookupTableAccounts,
    })
    console.log("createTransactionTx: ", createTransactionTx)
    const proposalCreateIx = multisig.instructions.proposalCreate({
        multisigPda: multisigPda,
        creator: member.publicKey,
        transactionIndex: BigInt(transactionIndex),
        isDraft: false,
        programId: programID,
    })
    const proposalVoteIx = multisig.instructions.proposalApprove({
        multisigPda: multisigPda,
        member: member.publicKey,
        transactionIndex: BigInt(transactionIndex),
        programId: programID,
    })
    const latestBlockhash = await connection.getLatestBlockhash()
    const secondMessage = new TransactionMessage({
        payerKey: member.publicKey,
        recentBlockhash: latestBlockhash.blockhash,
        instructions: [computeUnitPriceIx, computeUnitLimitIx, proposalCreateIx, proposalVoteIx],
    }).compileToV0Message([])
    const secondTransaction = new VersionedTransaction(secondMessage);
    secondTransaction.sign([member]);
    const secondTransactionSignature = await connection.sendRawTransaction(secondTransaction.serialize(), { skipPreflight: true });
    await connection.confirmTransaction({
        signature: secondTransactionSignature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }, "confirmed")
    console.log("Proposal Create & Vote : ", secondTransactionSignature)
    // Wait 5s before executing the transaction
    const [proposalPda] = await multisig.getProposalPda({
        multisigPda: multisigPda,
        transactionIndex: BigInt(transactionIndex),
        programId: programID,
    })
    const [transactionPda] = await multisig.getTransactionPda({
        multisigPda: multisigPda,
        index: BigInt(transactionIndex),
        programId: programID,
    })
    //await extendALT([proposalPda, transactionPda])
    // Wait 5s before executing the transaction
    await new Promise(resolve => setTimeout(resolve, 5000));
    const { instruction, lookupTableAccounts } = await multisig.instructions.vaultTransactionExecute({
        connection,
        multisigPda: multisigPda,
        transactionIndex: BigInt(transactionIndex),
        member: member.publicKey,
        programId: programID,
    })
    const ourLookupTableResponse = await connection.getAddressLookupTable(alt)
    const ourLookupTable = ourLookupTableResponse.value
    if (!ourLookupTable) throw new Error("Our lookup table not found")

    const combinedLookupTables: AddressLookupTableAccount[] = [...lookupTableAccounts, ourLookupTable]
    console.log("combinedLookupTables: ", combinedLookupTables.length)
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const thirdMessage = new TransactionMessage({
        payerKey: member.publicKey,
        recentBlockhash: blockhash,
        instructions: [computeUnitPriceIx, jupComputeLimit, heapIx, instruction],
    }).compileToV0Message(combinedLookupTables)

    const thirdTransaction = new VersionedTransaction(thirdMessage);
    console.log("static account keys: ", thirdTransaction.message.staticAccountKeys.length)
    thirdTransaction.sign([member]);
    const thirdTransactionSignature = await connection.sendRawTransaction(thirdTransaction.serialize(), {
        skipPreflight: true,
    });
    console.log("Execute Transaction: ", thirdTransactionSignature)

}
const invalidateOldAccounts = async () => {
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);

    const txIndex = Number(multisigAccount.transactionIndex) + 1
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const createIx = multisig.instructions.configTransactionCreate({
        multisigPda: multisigPda,
        creator: member.publicKey,
        transactionIndex: BigInt(txIndex),
        actions: [
            {
                __kind: "AddMember",
                newMember: {
                    key: PublicKey.default,
                    permissions: Permissions.all()
                },
            },
            {
                __kind: "RemoveMember",
                oldMember: PublicKey.default,
            }
        ],
        programId: programID,
    })
    const createProposalIx = multisig.instructions.proposalCreate({
        multisigPda: multisigPda,
        creator: member.publicKey,
        transactionIndex: BigInt(txIndex),
        isDraft: false,
        programId: programID,
    })
    const voteIx = multisig.instructions.proposalApprove({
        multisigPda: multisigPda,
        member: member.publicKey,
        transactionIndex: BigInt(txIndex),
        programId: programID,
    })
    const executeIx = multisig.instructions.configTransactionExecute({
        multisigPda: multisigPda,
        member: member.publicKey,
        transactionIndex: BigInt(txIndex),
        programId: programID,
    })
    const txMessage = new TransactionMessage({
        payerKey: member.publicKey,
        recentBlockhash: blockhash,
        instructions: [computeUnitPriceIx, computeUnitLimitIx, createIx, createProposalIx, voteIx, executeIx],
    }).compileToV0Message([])
    const tx = new VersionedTransaction(txMessage);
    tx.sign([member]);
    const txSignature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
    });
    console.log("Tx Signature: ", txSignature)
    await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
    })
}
const altTest = async () => {
    const ourLookupTableResponse = await connection.getAddressLookupTable(alt)
    console.log("ourLookupTableResponse: ", ourLookupTableResponse)
    const ourLookupTable = ourLookupTableResponse.value
    if (!ourLookupTable) throw new Error("Our lookup table not found")
}
const closeTxAccounts = async () => {
    const multisigAccount = await multisig.accounts.Multisig.fromAccountAddress(connection, multisigPda);
    const txIndex = Number(multisigAccount.transactionIndex)
    for (let i = 1; i < txIndex; i++) {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
        const tx1 = multisig.transactions.proposalCancel({
            blockhash,
            feePayer: member.publicKey,
            multisigPda: multisigPda,
            transactionIndex: BigInt(i),
            member: member.publicKey,
            programId: programID,
        })
        const tx2 = multisig.transactions.vaultTransactionAccountsClose({
            blockhash,
            multisigPda: multisigPda,
            feePayer: member.publicKey,
            rentCollector: member.publicKey,
            transactionIndex: BigInt(i),
            programId: programID,
        })
        const tx3 = multisig.transactions.configTransactionAccountsClose({
            blockhash,
            feePayer: member.publicKey,
            multisigPda: multisigPda,
            rentCollector: member.publicKey,
            transactionIndex: BigInt(i),
            programId: programID,
        })
        tx1.sign([member])
        tx2.sign([member])
        tx3.sign([member])
        // Try voting to cancel
        try {
            const txSignature = await connection.sendTransaction(tx1)
            await connection.confirmTransaction({
                signature: txSignature,
                blockhash,
                lastValidBlockHeight,
            })
        } catch (e) {
            console.log("VOTING -- Tx Index: ", i)

            // Try closing
            try {
                const txSignature = await connection.sendTransaction(tx2)
                await connection.confirmTransaction({
                    signature: txSignature,
                    blockhash,
                    lastValidBlockHeight,
                })
            } catch (e) {
                console.log("CLOSING -- Tx Index: ", i,)
            }
            // Try closing config
            try {
                const txSignature = await connection.sendTransaction(tx3)
                await connection.confirmTransaction({
                    signature: txSignature,
                    blockhash,
                    lastValidBlockHeight,
                })
            } catch (e) {
                console.log("CLOSING CONFIG -- Tx Index: ", i)
            }
        }
    }
    console.log("Closed all transaction accounts")
    return
}
const createALT = async () => {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const slot = await connection.getSlot() - 50
    const [createInstruction, lookupTable] = AddressLookupTableProgram.createLookupTable({
        authority: member.publicKey,
        payer: member.publicKey,
        recentSlot: slot,
    })
    console.log("lookupTable: ", lookupTable.toBase58())
    const executeInstruction = AddressLookupTableProgram.extendLookupTable({
        lookupTable: new PublicKey("6UpjQ9oG6sW6psqmtmEwghjzeHGaZT7rNNEqzrGggSeZ"),
        authority: member.publicKey,
        payer: member.publicKey,
        addresses: [
            member.publicKey,
            multisigPda,
            new PublicKey("Hgw5Bxpi5o1h9TeNh3F6zwQnG7wsMUzVxSRiQDyPYaPw")
        ]
    });
    const txMessage = new TransactionMessage({
        payerKey: member.publicKey,
        recentBlockhash: blockhash,
        instructions: [computeUnitPriceIx, computeUnitLimitIx, executeInstruction],
    }).compileToV0Message([])
    const tx = new VersionedTransaction(txMessage);
    tx.sign([member]);
    const txSignature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
    });
    console.log("txSignature: ", txSignature)
    await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
    })
}
const extendALT = async (pubkeys: PublicKey[]) => {
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const executeInstruction = AddressLookupTableProgram.extendLookupTable({
        lookupTable: new PublicKey("6UpjQ9oG6sW6psqmtmEwghjzeHGaZT7rNNEqzrGggSeZ"),
        authority: member.publicKey,
        payer: member.publicKey,
        addresses: pubkeys
    });
    const txMessage = new TransactionMessage({
        payerKey: member.publicKey,
        recentBlockhash: blockhash,
        instructions: [computeUnitPriceIx, computeUnitLimitIx, executeInstruction],
    }).compileToV0Message([])
    const tx = new VersionedTransaction(txMessage);
    tx.sign([member]);
    const txSignature = await connection.sendRawTransaction(tx.serialize());
    console.log("Extend ALT Signature: ", txSignature)
    await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
    })
}
const closeBuffer = async () => {
    const [bufferPda] = multisig.getTransactionBufferPda({
        multisig: multisigPda,
        creator: member.publicKey,
        bufferIndex: 0,
        programId: programID,
    })
    const ix = multisig.generated.createTransactionBufferCloseInstruction({
        multisig: multisigPda,
        creator: member.publicKey,
        transactionBuffer: bufferPda,
    },
        programID,
    )
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()
    const txMessage = new TransactionMessage({
        payerKey: member.publicKey,
        recentBlockhash: blockhash,
        instructions: [ix],
    }).compileToV0Message([])
    const tx = new VersionedTransaction(txMessage);
    tx.sign([member]);
    const txSignature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
    })
    console.log("txSignature: ", txSignature)
}

swap()
//closeBuffer()
//invalidateOldAccounts()
//closeTxAccounts()
//createALT()
//altTest()