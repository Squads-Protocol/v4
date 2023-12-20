import { PublicKey } from "@solana/web3.js";
import {
  createVaultBatchTransactionAccountCloseInstruction,
  PROGRAM_ID,
} from "../generated";
import {
  getBatchTransactionPda,
  getProposalPda,
  getTransactionPda,
} from "../pda";

/**
 * Closes a VaultBatchTransaction belonging to the Batch and Proposal defined by `batchIndex`.
 * VaultBatchTransaction can be closed if either:
 * - it's marked as executed within the batch;
 * - the proposal is in a terminal state: `Executed`, `Rejected`, or `Cancelled`.
 * - the proposal is stale and not `Approved`.
 */
export function vaultBatchTransactionAccountClose({
  multisigPda,
  rentCollector,
  batchIndex,
  transactionIndex,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  rentCollector: PublicKey;
  batchIndex: bigint;
  transactionIndex: number;
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

  return createVaultBatchTransactionAccountCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      batch: batchPda,
      transaction: batchTransactionPda,
    },
    programId
  );
}
