import * as multisig from "@sqds/multisig";
import invariant from "invariant";
import { AccountMeta, AddressLookupTableAccount, PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

import assert from "assert";
import {
  createAutonomousMultisig,
  createLocalhostConnection,
  generateMultisigMembers,
  getTestProgramId,
  TestMembers,
} from "../../utils";

const { Multisig } = multisig.accounts;

const programId = getTestProgramId();

/** 
 * Populate remaining accounts required for execution of the transaction. 
 * See the sdk/multisig/src/utils.ts file for the full implementation.
*/
export function accountMetasForTransactionExecute({
  transactionPda,
  vaultPda,
  message,
  programId,
  ephemeralSignerBumps = [],
  addressLookupTableAccounts = [],
}: {
  message: multisig.generated.VaultTransactionMessage;
  ephemeralSignerBumps?: number[];
  vaultPda: PublicKey;
  transactionPda: PublicKey;
  programId: PublicKey;
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}): {
  /** Account metas used in the `message`. */
  accountMetas: AccountMeta[];
} {
  const ephemeralSignerPdas = ephemeralSignerBumps.map((_, additionalSignerIndex) => {
    return multisig.getEphemeralSignerPda({
      transactionPda,
      ephemeralSignerIndex: additionalSignerIndex,
      programId,
    })[0];
  });

  const addressLookupTableKeys = message.addressTableLookups.map(({ accountKey }) => accountKey);
  const addressLookupTableAccountsMap = new Map(addressLookupTableAccounts.map((account) => [account.key.toBase58(), account]));
  // Populate account metas required for execution of the transaction.
  const accountMetas: AccountMeta[] = [];
  // First add the lookup table accounts used by the transaction. They are needed for on-chain validation.
  accountMetas.push(
    ...addressLookupTableKeys.map((key) => {
      return { pubkey: key, isSigner: false, isWritable: false };
    }),
  );
  // Then add static account keys included into the message.
  for (const [accountIndex, accountKey] of message.accountKeys.entries()) {
    accountMetas.push({
      pubkey: accountKey,
      isWritable: multisig.utils.isStaticWritableIndex(message, accountIndex),
      // NOTE: vaultPda and ephemeralSignerPdas cannot be marked as signers,
      // because they are PDAs and hence won't have their signatures on the transaction.
      isSigner:
        multisig.utils.isSignerIndex(message, accountIndex) &&
        !accountKey.equals(vaultPda) &&
        !ephemeralSignerPdas.find((k) => accountKey.equals(k)),
    });
  }
  // Then add accounts that will be loaded with address lookup tables.
  for (const lookup of message.addressTableLookups) {
    const lookupTableAccount = addressLookupTableAccountsMap.get(lookup.accountKey.toBase58());
    invariant(lookupTableAccount, `Address lookup table account ${lookup.accountKey.toBase58()} not found`);

    for (const accountIndex of lookup.writableIndexes) {
      const pubkey: PublicKey = lookupTableAccount.state.addresses[accountIndex];
      invariant(pubkey, `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`);
      accountMetas.push({
        pubkey,
        isWritable: true,
        // Accounts in address lookup tables can not be signers.
        isSigner: false,
      });
    }
    for (const accountIndex of lookup.readonlyIndexes) {
      const pubkey: PublicKey = lookupTableAccount.state.addresses[accountIndex];
      invariant(pubkey, `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`);
      accountMetas.push({
        pubkey,
        isWritable: false,
        // Accounts in address lookup tables can not be signers.
        isSigner: false,
      });
    }
  }

  return { accountMetas };
}

/**
 * If user can sign a transaction with enough member keys to reach the threshold,
 * they can batch all multisig instructions required to create, approve and execute the multisig transaction
 * into one Solana transaction, so the transaction is executed immediately.
 */
describe("Examples / Immediate Vault Execution", () => {
  const connection = createLocalhostConnection();

  let members: TestMembers;
  before(async () => {
    members = await generateMultisigMembers(connection);
  });

  it("create, approve and execute, all in 1 Solana transaction", async () => {
    const [multisigPda] = await createAutonomousMultisig({
      connection,
      members,
      threshold: 2,
      timeLock: 0,
      programId,
    });

    // Vault index
    const vaultIndex = 0;
    const [vaultPda] = multisig.getVaultPda({
      multisigPda,
      index: vaultIndex,
      programId,
    });

    // Airdrop SOL amount required for the payout to the Vault.
    const airdropSig = await connection.requestAirdrop(
      vaultPda,
      2 * LAMPORTS_PER_SOL
    );
    var latestBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature: airdropSig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });

    const balance = await connection.getBalance(vaultPda);
    assert.strictEqual(balance, 2 * LAMPORTS_PER_SOL);
    
    const multisigAccount = await Multisig.fromAccountAddress(
      connection,
      multisigPda
    );
    const { blockhash } = await connection.getLatestBlockhash("finalized");
    const transactionIndex = multisig.utils.toBigInt(multisigAccount.transactionIndex) + 1n;
    
    // Transaction, index -> transactionPda.
    const [transactionPda] = multisig.getTransactionPda({
      multisigPda,
      index: transactionIndex,
      programId,
    });

    // Transaction, index -> proposalPda.
    const [proposalPda] = multisig.getProposalPda({
      multisigPda,
      transactionIndex,
      programId,
    });

    const txMsg = new TransactionMessage({
      payerKey: vaultPda,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: vaultPda,
          toPubkey: Keypair.generate().publicKey,
          lamports: 1 * LAMPORTS_PER_SOL,
        }),
      ],
    });
  
    // Create a vault transaction (Executed).
    const createTransactionIx = multisig.instructions.vaultTransactionCreate({
      programId,
      multisigPda,
      vaultIndex,
      transactionIndex,
      /** Number of additional signing PDAs required by the transaction. */
      ephemeralSigners: 0,
      /** Transaction message to wrap into a multisig transaction. */
      transactionMessage: txMsg,
      /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
      // addressLookupTableAccounts,
      memo: 'send 1 sol',

      creator: members.almighty.publicKey,
      // rentPayer: rentPayer, // rent payer is the creator.
    });

    const createProposalIx = multisig.instructions.proposalCreate({
      programId,
      multisigPda,
      transactionIndex,

      creator: members.proposer.publicKey,
    });

    const approveProposalIx = multisig.instructions.proposalApprove({
      programId,
      multisigPda,
      transactionIndex,

      member: members.almighty.publicKey,
    });

    const approveProposalIx2 = multisig.instructions.proposalApprove({
      programId,
      multisigPda,
      transactionIndex,

      member: members.voter.publicKey,
    });

    const transactionMessageBytes = multisig.utils.transactionMessageToMultisigTransactionMessageBytes({
      vaultPda,
      message: txMsg,
    });

    const [valueTxMsg] = multisig.types.transactionMessageBeet.deserialize(Buffer.from(transactionMessageBytes), 0);
    
    const { accountMetas: anchorRemainingAccounts } = accountMetasForTransactionExecute({
      programId,
      vaultPda,
      transactionPda,
      message: valueTxMsg as unknown as multisig.generated.VaultTransactionMessage,
    });

    const executeTransactionIx = multisig.generated.createVaultTransactionExecuteInstruction({
      multisig: multisigPda,
      proposal: proposalPda,
      transaction: transactionPda,
      anchorRemainingAccounts,

      member: members.almighty.publicKey,
    }, programId);

    const message = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: members.almighty.publicKey,
      instructions: [
        createTransactionIx,
        createProposalIx,
        approveProposalIx,
        approveProposalIx2,
        executeTransactionIx,
      ],
    }).compileToV0Message();;
  
    const tx = new VersionedTransaction(message);
  
    tx.sign([members.almighty, members.proposer, members.voter]);

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,
    });
    await connection.confirmTransaction(signature);

    // Verify the multisig balance.
    const newBalance = await connection.getBalance(vaultPda);
    assert.strictEqual(newBalance, 1 * LAMPORTS_PER_SOL);
  });
});
