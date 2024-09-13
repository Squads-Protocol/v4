import { AccountMeta, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import * as multisig from "@sqds/multisig";
import { VaultTransactionExecuteWithHookInstructionAccounts } from "@sqds/multisig/src/generated";
import assert from "assert";
import {
    createAutonomousMultisig,
    createLocalhostConnection,
    generateMultisigMembers,
    getTestProgramId,
    Period,
    serializeInitializeSpendingLimitHookArgs,
    TestMembers
} from "../../utils";

const { Multisig, Proposal } = multisig.accounts;

const programId = getTestProgramId();
const connection = createLocalhostConnection();

describe("Instructions / config_transaction_execute", () => {
    let members: TestMembers;

    before(async () => {
        members = await generateMultisigMembers(connection);
    });

    it("Create and execute with hook action", async () => {
        // Create new autonomous multisig without.
        const multisigPda = (
            await createAutonomousMultisig({
                connection,
                members,
                threshold: 1,
                timeLock: 0,
                programId,
            })
        )[0];

        const multisigAccountInfoPreExecution = await connection.getAccountInfo(
            multisigPda
        )!;

        const [multisigInfo] = Multisig.fromAccountInfo(multisigAccountInfoPreExecution!);

        const vaultPda = multisig.getVaultPda({
            multisigPda,
            index: 0,
            programId,
        })[0];

        const hookProgram = new PublicKey("HookYW72xzkWmZE8bHJEjFmxYWpamG1ym8JgW8cpgHj")

        // Create a config transaction.
        const transactionIndex = BigInt(Number(multisigInfo.transactionIndex)) + 1n;
        let signature = await multisig.rpc.configTransactionCreate({
            connection,
            feePayer: members.proposer,
            multisigPda,
            transactionIndex,
            creator: members.proposer.publicKey,
            actions: [{
                __kind: "AddHook",
                hookProgramId: hookProgram,
                hookInstructionName: "spending_limit",
                seralizedArgs: serializeInitializeSpendingLimitHookArgs({
                    amount: BigInt(1000000000), // 1 SOL in lamports
                    period: Period.OneTime,
                    mint: new PublicKey('So11111111111111111111111111111111111111112'),
                    members: [
                        members.almighty.publicKey,
                    ],
                    destinations: [
                        members.voter.publicKey,
                    ],
                }),
            }],
            programId,
        });
        await connection.confirmTransaction(signature);

        // Create a proposal for the transaction (Approved).
        signature = await multisig.rpc.proposalCreate({
            connection,
            feePayer: members.proposer,
            multisigPda,
            transactionIndex,
            creator: members.proposer,
            programId,
        });
        await connection.confirmTransaction(signature);

        // Approve the proposal.
        signature = await multisig.rpc.proposalApprove({
            connection,
            feePayer: members.voter,
            multisigPda,
            transactionIndex,
            member: members.voter,
            programId,
        });
        await connection.confirmTransaction(signature);
        const spendingLimitHookAccount = await PublicKey.findProgramAddressSync(
            [Buffer.from("hook"), multisigPda.toBuffer(), Buffer.from("spending_limit")], hookProgram
        )
        // Execute the approved config transaction.
        signature = await multisig.rpc.configTransactionExecute({
            connection,
            feePayer: members.almighty,
            multisigPda,
            transactionIndex,
            member: members.almighty,
            rentPayer: members.almighty,
            programId,
            spendingLimits: [spendingLimitHookAccount[0], hookProgram],
            sendOptions: { skipPreflight: true },
        });
        console.log(signature);

        await connection.confirmTransaction(signature);

        // Verify the proposal account.
        const [proposalPda] = multisig.getProposalPda({
            multisigPda,
            transactionIndex,
            programId,
        });
        const proposalAccount = await Proposal.fromAccountAddress(
            connection,
            proposalPda
        );
        assert.ok(multisig.types.isProposalStatusExecuted(proposalAccount.status));

        // Verify the multisig account.
        const multisigAccountInfoPostExecution = await connection.getAccountInfo(
            multisigPda
        );
        const [multisigAccountPostExecution] = Multisig.fromAccountInfo(
            multisigAccountInfoPostExecution!
        );
        // The hook should be updated.
        assert.strictEqual(
            multisigAccountPostExecution.hook?.instructionName,
            "spending_limit"
        );
        // The stale transaction index should be updated.
        assert.strictEqual(
            multisigAccountPostExecution.staleTransactionIndex.toString(),
            "1"
        );
        // multisig space should not be reallocated because we allocate 32 bytes for potential rent_collector when we create multisig.
        assert.ok(
            multisigAccountInfoPostExecution!.data.length ===
            multisigAccountInfoPreExecution!.data.length
        );
        // Create a vault transaction to system transfer SOL to vote keypair.

        let transferIx = SystemProgram.transfer({
            fromPubkey: vaultPda,
            toPubkey: members.voter.publicKey,
            lamports: 500000000,
        })
        let fundVaultIx = SystemProgram.transfer({
            fromPubkey: members.almighty.publicKey,
            toPubkey: vaultPda,
            lamports: 500000000,
        })
        let transferMessage = new TransactionMessage(
            {
                payerKey: vaultPda,
                recentBlockhash: "Not needed",
                instructions: [transferIx],
            }
        )
        let createVaultTxInstruction = multisig.instructions.vaultTransactionCreate({
            multisigPda,
            transactionIndex: transactionIndex + 1n,
            creator: members.almighty.publicKey,
            vaultIndex: 0,
            ephemeralSigners: 0,
            transactionMessage: transferMessage,
            programId,
        })
        let createProposalIx = multisig.instructions.proposalCreate({
            multisigPda,
            transactionIndex: transactionIndex + 1n,
            creator: members.almighty.publicKey,
            programId,
        })
        let proposalApproveIx = multisig.instructions.proposalApprove({
            multisigPda,
            transactionIndex: transactionIndex + 1n,
            member: members.almighty.publicKey,
            programId,
        })
        let transactionPda = multisig.getTransactionPda({
            multisigPda,
            index: transactionIndex + 1n,
            programId,
        })[0];
        let hookAuthority = await PublicKey.findProgramAddressSync(
            [Buffer.from("multisig"), multisigPda.toBuffer(), Buffer.from("hook_authority")], programId
        )
        let newProposalPda = multisig.getProposalPda({
            multisigPda,
            transactionIndex: transactionIndex + 1n,
            programId,
        })[0];
        let extraAccounts: AccountMeta[] = [
            { pubkey: vaultPda, isWritable: true, isSigner: false },
            { pubkey: members.voter.publicKey, isWritable: true, isSigner: false },
            { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
        ];
        let executeWithHookAccounts: VaultTransactionExecuteWithHookInstructionAccounts = {
            multisig: multisigPda,
            proposal: newProposalPda,
            transaction: transactionPda,
            member: members.almighty.publicKey,
            hookConfig: spendingLimitHookAccount[0],
            hookProgram: hookProgram,
            hookAuthority: hookAuthority[0],
            anchorRemainingAccounts: extraAccounts,
        }
        let executeWithHookIx = multisig.generated.createVaultTransactionExecuteWithHookInstruction(
            executeWithHookAccounts,
            programId
        )
        let blockhash = await connection.getLatestBlockhash();
        let txMessage = new TransactionMessage({
            payerKey: members.almighty.publicKey,
            recentBlockhash: blockhash.blockhash,
            instructions: [fundVaultIx, createVaultTxInstruction, createProposalIx, proposalApproveIx, executeWithHookIx],
        }).compileToV0Message();

        let tx = new VersionedTransaction(txMessage);

        tx.sign([members.almighty]);

        let createSignature = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: true,
        });
        console.log("Signature: ", createSignature);
        await connection.confirmTransaction({
            signature: createSignature,
            blockhash: blockhash.blockhash,
            lastValidBlockHeight: blockhash.lastValidBlockHeight,
        });


    });
});