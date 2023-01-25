import {
  AccountMeta,
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import invariant from "invariant";
import {
  createMultisigAddMemberInstruction,
  createMultisigCreateInstruction,
  createTransactionApproveInstruction,
  createTransactionCreateInstruction,
  createTransactionExecuteInstruction,
  Member,
  MultisigTransaction,
} from "./generated";
import { getAuthorityPda, getTransactionPda } from "./pda";
import { transactionMessageBeet } from "./types";
import { isSignerIndex, isStaticWritableIndex } from "./utils";
import * as instructions from "./instructions.js";

/** Returns unsigned `VersionedTransaction` that needs to be signed by `creator` before sending it. */
export function multisigCreate({
  blockhash,
  configAuthority,
  creator,
  multisigPda,
  threshold,
  members,
  createKey,
  memo,
}: {
  blockhash: string;
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  threshold: number;
  members: Member[];
  createKey: PublicKey;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [
      instructions.multisigCreate({
        creator,
        multisigPda,
        configAuthority,
        threshold,
        members,
        createKey,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `configAuthority` and `feePayer` before sending it.
 */
export function multisigAddMember({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  newMember,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newMember: Member;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      createMultisigAddMemberInstruction(
        {
          multisig: multisigPda,
          configAuthority,
        },
        { args: { newMember, memo: memo ?? null } }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `creator` and `feePayer` before sending it.
 */
export function transactionCreate({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  authorityIndex,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  creator: PublicKey;
  authorityIndex: number;
  /** Transaction message to wrap into a multisig transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  memo?: string;
}): VersionedTransaction {
  const [authorityPDA] = getAuthorityPda({
    multisigPda,
    index: authorityIndex,
  });

  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  // Make sure authority is marked as non-signer in all instructions,
  // otherwise the message will be serialized in incorrect format.
  transactionMessage.instructions.forEach((instruction) => {
    instruction.keys.forEach((key) => {
      if (key.pubkey.equals(authorityPDA)) {
        key.isSigner = false;
      }
    });
  });

  const compiledMessage = transactionMessage.compileToV0Message(
    addressLookupTableAccounts
  );

  // We use custom serialization for `transaction_message` that ensures as small byte size as possible.
  const [transactionMessageBytes] = transactionMessageBeet.serialize({
    numSigners: compiledMessage.header.numRequiredSignatures,
    numWritableSigners:
      compiledMessage.header.numRequiredSignatures -
      compiledMessage.header.numReadonlySignedAccounts,
    numWritableNonSigners:
      compiledMessage.staticAccountKeys.length -
      compiledMessage.header.numRequiredSignatures -
      compiledMessage.header.numReadonlyUnsignedAccounts,
    accountKeys: compiledMessage.staticAccountKeys,
    instructions: compiledMessage.compiledInstructions.map((ix) => {
      return {
        programIdIndex: ix.programIdIndex,
        accountIndexes: ix.accountKeyIndexes,
        data: Array.from(ix.data),
      };
    }),
    addressTableLookups: compiledMessage.addressTableLookups,
  });

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      createTransactionCreateInstruction(
        {
          multisig: multisigPda,
          transaction: transactionPda,
          creator,
        },
        {
          args: {
            authorityIndex,
            transactionMessage: transactionMessageBytes,
            memo: memo ?? null,
          },
        }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

export function transactionApprove({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
}): VersionedTransaction {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      createTransactionApproveInstruction(
        {
          multisig: multisigPda,
          transaction: transactionPda,
          member,
        },
        {
          args: {
            memo: memo ?? null,
          },
        }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `member` and `feePayer` before sending it.
 */
export async function transactionExecute({
  connection,
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
}: {
  connection: Connection;
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
}): Promise<VersionedTransaction> {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });
  const transactionAccount = await MultisigTransaction.fromAccountAddress(
    connection,
    transactionPda
  );

  const [authorityPda] = getAuthorityPda({
    multisigPda,
    index: transactionAccount.authorityIndex,
  });

  const transactionMessage = transactionAccount.message;

  const addressLookupTableKeys = transactionMessage.addressTableLookups.map(
    ({ accountKey }) => accountKey
  );
  const addressLookupTableAccounts = new Map(
    await Promise.all(
      addressLookupTableKeys.map(async (key) => {
        const { value } = await connection.getAddressLookupTable(key);
        if (!value) {
          throw new Error(
            `Address lookup table account ${key.toBase58()} not found`
          );
        }
        return [key.toBase58(), value] as const;
      })
    )
  );

  // Populate remaining accounts required for execution of the transaction.
  const remainingAccounts: AccountMeta[] = [];
  // First add the lookup table accounts used by the transaction. They are needed for on-chain validation.
  remainingAccounts.push(
    ...addressLookupTableKeys.map((key) => {
      return { pubkey: key, isSigner: false, isWritable: false };
    })
  );
  // Then add static account keys included into the message.
  for (const [
    accountIndex,
    accountKey,
  ] of transactionMessage.accountKeys.entries()) {
    remainingAccounts.push({
      pubkey: accountKey,
      isWritable: isStaticWritableIndex(transactionMessage, accountIndex),
      // NOTE: authorityPda cannot be marked as signer because it's a PDA.
      isSigner:
        isSignerIndex(transactionMessage, accountIndex) &&
        !accountKey.equals(authorityPda),
    });
  }
  // Then add accounts that will be loaded with address lookup tables.
  for (const lookup of transactionMessage.addressTableLookups) {
    const lookupTableAccount = addressLookupTableAccounts.get(
      lookup.accountKey.toBase58()
    );
    invariant(
      lookupTableAccount,
      `Address lookup table account ${lookup.accountKey.toBase58()} not found`
    );

    for (const accountIndex of lookup.writableIndexes) {
      const pubkey: PublicKey =
        lookupTableAccount.state.addresses[accountIndex];
      invariant(
        pubkey,
        `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`
      );
      remainingAccounts.push({
        pubkey,
        isWritable: true,
        // Accounts in address lookup tables can not be signers.
        isSigner: false,
      });
    }
    for (const accountIndex of lookup.readonlyIndexes) {
      const pubkey: PublicKey =
        lookupTableAccount.state.addresses[accountIndex];
      invariant(
        pubkey,
        `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`
      );
      remainingAccounts.push({
        pubkey,
        isWritable: false,
        // Accounts in address lookup tables can not be signers.
        isSigner: false,
      });
    }
  }

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      createTransactionExecuteInstruction({
        multisig: multisigPda,
        transaction: transactionPda,
        member,
        anchorRemainingAccounts: remainingAccounts,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
