import { PublicKey } from "@solana/web3.js";
import {
  createVaultTransactionAccountsCloseInstruction,
  PROGRAM_ID,
} from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

export function vaultTransactionAccountsClose({
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

  return createVaultTransactionAccountsCloseInstruction(
    {
      multisig: multisigPda,
      rentCollector,
      proposal: proposalPda,
      transaction: transactionPda,
    },
    programId
  );
}
