import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";
import { createBatchAddTransactionInstruction, PROGRAM_ID } from "../generated";
import {
  getBatchTransactionPda,
  getProposalPda,
  getTransactionPda,
  getVaultPda,
} from "../pda";
import { transactionMessageToMultisigTransactionMessageBytes } from "../utils";

export function batchAddTransaction({
  vaultIndex,
  multisigPda,
  member,
  rentPayer,
  batchIndex,
  transactionIndex,
  ephemeralSigners,
  transactionMessage,
  addressLookupTableAccounts,
  programId = PROGRAM_ID,
}: {
  vaultIndex: number;
  multisigPda: PublicKey;
  /** Member of the multisig that is adding the transaction. */
  member: PublicKey;
  /** Payer for the transaction account rent. If not provided, `member` is used. */
  rentPayer?: PublicKey;
  batchIndex: bigint;
  transactionIndex: number;
  /** Number of additional signing PDAs required by the transaction. */
  ephemeralSigners: number;
  /** Transaction message to wrap into a batch transaction. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccount`s referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  programId?: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex: batchIndex,
    programId,
  });
  const [batchPda] = getTransactionPda({
    multisigPda,
    index: batchIndex,
    programId,
  });
  const [batchTransactionPda] = getBatchTransactionPda({
    multisigPda,
    batchIndex,
    transactionIndex,
    programId,
  });
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: vaultIndex,
    programId,
  });

  const transactionMessageBytes =
    transactionMessageToMultisigTransactionMessageBytes({
      message: transactionMessage,
      addressLookupTableAccounts,
      vaultPda,
    });

  return createBatchAddTransactionInstruction(
    {
      multisig: multisigPda,
      member,
      proposal: proposalPda,
      rentPayer: rentPayer ?? member,
      batch: batchPda,
      transaction: batchTransactionPda,
    },
    {
      args: {
        ephemeralSigners,
        transactionMessage: transactionMessageBytes,
      },
    },
    programId
  );
}
