import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getTransactionPda, getVaultPda } from "../pda";
import { transactionMessageBeet } from "../types";
import { createVaultTransactionCreateInstruction } from "../generated";

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
