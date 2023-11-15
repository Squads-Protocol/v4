import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  Batch,
  createBatchExecuteTransactionInstruction,
  PROGRAM_ID,
  VaultBatchTransaction,
} from "../generated";
import {
  getBatchTransactionPda,
  getProposalPda,
  getTransactionPda,
  getVaultPda,
} from "../pda";
import { accountsForTransactionExecute } from "../utils";

export async function batchExecuteTransaction({
  connection,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  programId = PROGRAM_ID,
}: {
  connection: Connection;
  multisigPda: PublicKey;
  member: PublicKey;
  batchIndex: bigint;
  transactionIndex: number;
  programId?: PublicKey;
}): Promise<{
  instruction: TransactionInstruction;
  lookupTableAccounts: AddressLookupTableAccount[];
}> {
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

  const batchAccount = await Batch.fromAccountAddress(connection, batchPda);
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: batchAccount.vaultIndex,
    programId,
  });

  const batchTransactionAccount =
    await VaultBatchTransaction.fromAccountAddress(
      connection,
      batchTransactionPda
    );

  const { accountMetas, lookupTableAccounts } =
    await accountsForTransactionExecute({
      connection,
      message: batchTransactionAccount.message,
      ephemeralSignerBumps: [...batchTransactionAccount.ephemeralSignerBumps],
      vaultPda,
      transactionPda: batchPda,
    });

  return {
    instruction: createBatchExecuteTransactionInstruction(
      {
        multisig: multisigPda,
        member,
        proposal: proposalPda,
        batch: batchPda,
        transaction: batchTransactionPda,
        anchorRemainingAccounts: accountMetas,
      },
      programId
    ),
    lookupTableAccounts,
  };
}
