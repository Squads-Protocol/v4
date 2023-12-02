import { PublicKey } from "@solana/web3.js";
import {
  createConfigTransactionAccountsCloseInstruction,
  PROGRAM_ID,
} from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

export function configTransactionAccountsClose({
  multisigPda,
  rentCollector,
  transactionIndex,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  rentCollector: PublicKey;
  transactionIndex: bigint;
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

  return createConfigTransactionAccountsCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      transaction: transactionPda,
    },
    programId
  );
}
