import { getTransactionPda } from "../pda";
import { createConfigTransactionCancelInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function configTransactionCancel({
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

  return createConfigTransactionCancelInstruction(
    { multisig: multisigPda, transaction: transactionPda, member },
    { args: { memo: memo ?? null } }
  );
}
