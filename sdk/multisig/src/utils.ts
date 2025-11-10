import { u8, u32, u64, bignum } from "@metaplex-foundation/beet";
import { Buffer } from "buffer";
import { VaultTransactionMessage } from "./generated";
import {
  AccountMeta,
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { transactionMessageBeet } from "./types";
import { getEphemeralSignerPda } from "./pda";
import invariant from "invariant";
import { compileToWrappedMessageV0 } from "./utils/compileToWrappedMessageV0";

export function toUtfBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function toU8Bytes(num: number): Uint8Array {
  const bytes = Buffer.alloc(1);
  u8.write(bytes, 0, num);
  return bytes;
}

export function toU32Bytes(num: number): Uint8Array {
  const bytes = Buffer.alloc(4);
  u32.write(bytes, 0, num);
  return bytes;
}

export function toU64Bytes(num: bigint): Uint8Array {
  const bytes = Buffer.alloc(8);
  u64.write(bytes, 0, num);
  return bytes;
}

export function toBigInt(number: bignum): bigint {
  return BigInt(number.toString());
}

const MAX_TX_SIZE_BYTES = 1232;
const STRING_LEN_SIZE = 4;
export function getAvailableMemoSize(
  txWithoutMemo: VersionedTransaction
): number {
  const txSize = txWithoutMemo.serialize().length;
  return (
    MAX_TX_SIZE_BYTES -
    txSize -
    STRING_LEN_SIZE -
    // Sometimes long memo can trigger switching from 1 to 2 bytes length encoding in Compact-u16,
    // so we reserve 1 extra byte to make sure.
    1
  );
}

export function isStaticWritableIndex(
  message: VaultTransactionMessage,
  index: number
) {
  const numAccountKeys = message.accountKeys.length;
  const { numSigners, numWritableSigners, numWritableNonSigners } = message;

  if (index >= numAccountKeys) {
    // `index` is not a part of static `accountKeys`.
    return false;
  }

  if (index < numWritableSigners) {
    // `index` is within the range of writable signer keys.
    return true;
  }

  if (index >= numSigners) {
    // `index` is within the range of non-signer keys.
    const indexIntoNonSigners = index - numSigners;
    // Whether `index` is within the range of writable non-signer keys.
    return indexIntoNonSigners < numWritableNonSigners;
  }

  return false;
}

export function isSignerIndex(message: VaultTransactionMessage, index: number) {
  return index < message.numSigners;
}

/** We use custom serialization for `transaction_message` that ensures as small byte size as possible. */
export function transactionMessageToMultisigTransactionMessageBytes({
  message,
  addressLookupTableAccounts,
  vaultPda,
}: {
  message: TransactionMessage;
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  vaultPda: PublicKey;
}): Uint8Array {
  // // Make sure authority is marked as non-signer in all instructions,
  // // otherwise the message will be serialized in incorrect format.
  // message.instructions.forEach((instruction) => {
  //   instruction.keys.forEach((key) => {
  //     if (key.pubkey.equals(vaultPda)) {
  //       key.isSigner = false;
  //     }
  //   });
  // });

  // Use custom implementation of `message.compileToV0Message` that allows instruction programIds
  // to also be loaded from `addressLookupTableAccounts`.
  const compiledMessage = compileToWrappedMessageV0({
    payerKey: message.payerKey,
    recentBlockhash: message.recentBlockhash,
    instructions: message.instructions,
    addressLookupTableAccounts,
  });
  // const compiledMessage = message.compileToV0Message(
  //   addressLookupTableAccounts
  // );

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

  return transactionMessageBytes;
}

/** Populate remaining accounts required for execution of the transaction. */
export async function accountsForTransactionExecute({
  connection,
  transactionPda,
  vaultPda,
  message,
  ephemeralSignerBumps,
  programId,
  addressLookupTableAccounts: localAddressLookupTableAccounts,
}: {
  connection: Connection;
  message: VaultTransactionMessage;
  ephemeralSignerBumps: number[];
  vaultPda: PublicKey;
  transactionPda: PublicKey;
  programId?: PublicKey;
  addressLookupTableAccounts?: AddressLookupTableAccount[];
}): Promise<{
  /** Account metas used in the `message`. */
  accountMetas: AccountMeta[];
  /** Address lookup table accounts used in the `message`. */
  lookupTableAccounts: AddressLookupTableAccount[];
}> {
  const ephemeralSignerPdas = ephemeralSignerBumps.map(
    (_, additionalSignerIndex) => {
      return getEphemeralSignerPda({
        transactionPda,
        ephemeralSignerIndex: additionalSignerIndex,
        programId,
      })[0];
    }
  );

  const addressLookupTableKeys = message.addressTableLookups.map(
    ({ accountKey }) => accountKey
  );
  const addressLookupTableAccounts = new Map(
    await Promise.all(
      addressLookupTableKeys.map(async (key) => {
        const keyBase58 = key.toBase58();
        const localAccount = localAddressLookupTableAccounts?.find((a) => a.key.toBase58() === keyBase58)
        if (localAccount) {
          return [keyBase58, localAccount] as const;
        }

        const { value } = await connection.getAddressLookupTable(key);
        if (!value) {
          throw new Error(
            `Address lookup table account ${keyBase58} not found`
          );
        }
        return [keyBase58, value] as const;
      })
    )
  );

  // Populate account metas required for execution of the transaction.
  const accountMetas: AccountMeta[] = [];
  // First add the lookup table accounts used by the transaction. They are needed for on-chain validation.
  accountMetas.push(
    ...addressLookupTableKeys.map((key) => {
      return { pubkey: key, isSigner: false, isWritable: false };
    })
  );
  // Then add static account keys included into the message.
  for (const [accountIndex, accountKey] of message.accountKeys.entries()) {
    accountMetas.push({
      pubkey: accountKey,
      isWritable: isStaticWritableIndex(message, accountIndex),
      // NOTE: vaultPda and ephemeralSignerPdas cannot be marked as signers,
      // because they are PDAs and hence won't have their signatures on the transaction.
      isSigner:
        isSignerIndex(message, accountIndex) &&
        !accountKey.equals(vaultPda) &&
        !ephemeralSignerPdas.find((k) => accountKey.equals(k)),
    });
  }
  // Then add accounts that will be loaded with address lookup tables.
  for (const lookup of message.addressTableLookups) {
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
      accountMetas.push({
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
      accountMetas.push({
        pubkey,
        isWritable: false,
        // Accounts in address lookup tables can not be signers.
        isSigner: false,
      });
    }
  }

  return {
    accountMetas,
    lookupTableAccounts: [...addressLookupTableAccounts.values()],
  };
}
