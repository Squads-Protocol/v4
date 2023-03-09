import { getTransactionPda } from "../pda";
import { createConfigTransactionApproveInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function configTransactionApprove({
  multisigPda,
  transactionIndex,
  member,
  memo,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
}) {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  return createConfigTransactionApproveInstruction(
    { multisig: multisigPda, transaction: transactionPda, member },
    { args: { memo: memo ?? null } }
  );
}
