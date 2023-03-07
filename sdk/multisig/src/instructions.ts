import {
  AccountMeta,
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import invariant from "invariant";
import {
  createMultisigCreateInstruction,
  createVaultTransactionExecuteInstruction,
  createConfigTransactionExecuteInstruction,
  Member,
  VaultTransaction,
  ConfigTransaction,
} from "./generated";
import { getEphemeralSignerPda, getVaultPda, getTransactionPda } from "./pda";
import { isSignerIndex, isStaticWritableIndex } from "./utils";

export function multisigCreate({
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  createKey,
  memo,
}: {
  creator: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  createKey: PublicKey;
  memo?: string;
}): TransactionInstruction {
  return createMultisigCreateInstruction(
    {
      creator,
      createKey,
      multisig: multisigPda,
    },
    {
      args: {
        configAuthority,
        threshold,
        members,
        timeLock,
        memo: memo ?? null,
      },
    }
  );
}

export async function vaultTransactionExecute({
  connection,
  multisigPda,
  transactionIndex,
  member,
}: {
  connection: Connection;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
}) {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });
  const transactionAccount = await VaultTransaction.fromAccountAddress(
    connection,
    transactionPda
  );

  const [vaultPda] = getVaultPda({
    multisigPda,
    index: transactionAccount.vaultIndex,
  });
  const ephemeralSignerPdas = [...transactionAccount.ephemeralSignerBumps].map(
    (_, additionalSignerIndex) => {
      return getEphemeralSignerPda({
        transactionPda,
        ephemeralSignerIndex: additionalSignerIndex,
      })[0];
    }
  );

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
      // NOTE: vaultPda and ephemeralSignerPdas cannot be marked as signers because they are PDAs.
      isSigner:
        isSignerIndex(transactionMessage, accountIndex) &&
        !accountKey.equals(vaultPda) &&
        !ephemeralSignerPdas.find((k) => accountKey.equals(k)),
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

  return createVaultTransactionExecuteInstruction({
    multisig: multisigPda,
    transaction: transactionPda,
    member,
    anchorRemainingAccounts: remainingAccounts,
  });
}
