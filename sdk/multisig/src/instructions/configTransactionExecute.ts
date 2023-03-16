import { PublicKey } from "@solana/web3.js";
import { createConfigTransactionExecuteInstruction } from "../generated";
import { getProposalPda, getTransactionPda } from "../pda";

export function configTransactionExecute({
  multisigPda,
  transactionIndex,
  member,
  rentPayer,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  rentPayer: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  return createConfigTransactionExecuteInstruction({
    multisig: multisigPda,
    member,
    proposal: proposalPda,
    transaction: transactionPda,
    rentPayer,
  });
}
