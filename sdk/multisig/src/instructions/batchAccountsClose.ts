import { PublicKey } from "@solana/web3.js";
import { createBatchAccountsCloseInstruction, PROGRAM_ID } from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

/**
 * Closes Batch and the corresponding Proposal accounts for proposals in terminal states:
 * `Executed`, `Rejected`, or `Cancelled` or stale proposals that aren't Approved.
 *
 * WARNING: Make sure to call this instruction only after all `VaultBatchTransaction`s
 * are already closed via `vault_batch_transaction_account_close`,
 * because the latter requires existing `Batch` and `Proposal` accounts, which this instruction closes.
 * There is no on-chain check preventing you from closing the `Batch` and `Proposal` accounts
 * first, so you will end up with no way to close the corresponding `VaultBatchTransaction`s.
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
