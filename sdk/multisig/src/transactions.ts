import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  createMultisigAddMemberInstruction,
  createTransactionApproveInstruction,
  createTransactionCreateInstruction,
  createTransactionRejectInstruction,
  Member,
} from "./generated";
import { getAuthorityPda, getTransactionPda } from "./pda";
import { transactionMessageBeet } from "./types";
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
  additionalSigners,
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
  /** Number of additional signing PDAs required by the transaction. */
  additionalSigners: number;
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
            additionalSigners,
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

export function transactionReject({
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
      createTransactionRejectInstruction(
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
  const ix = await instructions.transactionExecute({
    connection,
    multisigPda,
    member,
    transactionIndex,
  });

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
