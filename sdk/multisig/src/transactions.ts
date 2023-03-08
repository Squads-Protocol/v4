import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  ConfigAction,
  createMultisigAddMemberInstruction,
  createVaultTransactionApproveInstruction,
  createVaultTransactionCreateInstruction,
  createVaultTransactionRejectInstruction,
  Member,
} from "./generated";
import { getTransactionPda, getVaultPda } from "./pda.js";
import { transactionMessageBeet } from "./types.js";
import * as instructions from "./instructions/index.js";

/** Returns unsigned `VersionedTransaction` that needs to be signed by `creator` and `createKey` before sending it. */
export function multisigCreate({
  blockhash,
  configAuthority,
  createKey,
  creator,
  multisigPda,
  threshold,
  members,
  timeLock,
  memo,
}: {
  blockhash: string;
  createKey: PublicKey;
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  memo?: string;
}): VersionedTransaction {
  const ix = instructions.multisigCreate({
    creator,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    createKey,
    memo,
  });

  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [ix],
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
  rentPayer,
  newMember,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  rentPayer: PublicKey;
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
          rentPayer,
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
export function configTransactionCreate({
  blockhash,
  feePayer,
  creator,
  multisigPda,
  transactionIndex,
  actions,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  creator: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  actions: ConfigAction[];
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.configTransactionCreate({
        creator,
        multisigPda,
        transactionIndex,
        actions,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

/**
 * Returns unsigned `VersionedTransaction` that needs to be
 * signed by `creator` and `feePayer` before sending it.
 */
export function vaultTransactionCreate({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  creator,
  vaultIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  creator: PublicKey;
  vaultIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a multisig transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  memo?: string;
}): VersionedTransaction {
  const [authorityPDA] = getVaultPda({
    multisigPda,
    index: vaultIndex,
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
      createVaultTransactionCreateInstruction(
        {
          multisig: multisigPda,
          transaction: transactionPda,
          creator,
        },
        {
          args: {
            vaultIndex,
            ephemeralSigners,
            transactionMessage: transactionMessageBytes,
            memo: memo ?? null,
          },
        }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}

export function vaultTransactionApprove({
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
      createVaultTransactionApproveInstruction(
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

export function vaultTransactionReject({
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
      createVaultTransactionRejectInstruction(
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
export async function vaultTransactionExecute({
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
  const ix = await instructions.vaultTransactionExecute({
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
