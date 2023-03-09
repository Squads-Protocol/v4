import { getTransactionPda } from "../pda";
import { createConfigTransactionRejectInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function configTransactionReject({
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

  return createConfigTransactionRejectInstruction(
    { multisig: multisigPda, transaction: transactionPda, member },
    { args: { memo: memo ?? null } }
  );
}
