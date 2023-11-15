import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createConfigTransactionExecuteInstruction,
  PROGRAM_ID,
} from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

export function configTransactionExecute({
  multisigPda,
  transactionIndex,
  member,
  rentPayer,
  spendingLimits,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  rentPayer?: PublicKey;
  /** In case the transaction adds or removes SpendingLimits, pass the array of their Pubkeys here. */
  spendingLimits?: PublicKey[];
  programId?: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId,
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  return createConfigTransactionExecuteInstruction(
    {
      multisig: multisigPda,
      member,
      proposal: proposalPda,
      transaction: transactionPda,
      rentPayer,
      systemProgram: SystemProgram.programId,
      anchorRemainingAccounts: spendingLimits?.map((spendingLimit) => ({
        pubkey: spendingLimit,
        isWritable: true,
        isSigner: false,
      })),
    },
    programId
  );
}
