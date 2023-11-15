import {
  createVaultTransactionCreateInstruction,
  PROGRAM_ID,
} from "../generated";
import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";
import { getTransactionPda, getVaultPda } from "../pda";
import { transactionMessageToMultisigTransactionMessageBytes } from "../utils";

export function vaultTransactionCreate({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  vaultIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  creator: PublicKey;
  rentPayer?: PublicKey;
  vaultIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a multisig transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  memo?: string;
  programId?: PublicKey;
}) {
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: vaultIndex,
    programId,
  });

  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  const transactionMessageBytes =
    transactionMessageToMultisigTransactionMessageBytes({
      message: transactionMessage,
      addressLookupTableAccounts,
      vaultPda,
    });

  return createVaultTransactionCreateInstruction(
    {
      multisig: multisigPda,
      transaction: transactionPda,
      creator,
      rentPayer: rentPayer ?? creator,
    },
    {
      args: {
        vaultIndex,
        ephemeralSigners,
        transactionMessage: transactionMessageBytes,
        memo: memo ?? null,
      },
    },
    programId
  );
}
