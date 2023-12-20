import { PublicKey } from "@solana/web3.js";
import { createBatchAccountsCloseInstruction, PROGRAM_ID } from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

/**
 * Closes Batch and the corresponding Proposal accounts for proposals in terminal states:
 * `Executed`, `Rejected`, or `Cancelled` or stale proposals that aren't Approved.
 *
 * This instruction is only allowed to be executed when all `VaultBatchTransaction` accounts
 * in the `batch` are already closed: `batch.size == 0`.
 */
export function batchAccountsClose({
  multisigPda,
  rentCollector,
  batchIndex,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  rentCollector: PublicKey;
  batchIndex: bigint;
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

  return createBatchAccountsCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      batch: batchPda,
    },
    programId
  );
}
