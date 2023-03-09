import { PublicKey } from "@solana/web3.js";
import { createConfigTransactionExecuteInstruction } from "../generated";
import { getTransactionPda } from "../pda";

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
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  return createConfigTransactionExecuteInstruction({
    member,
    multisig: multisigPda,
    transaction: transactionPda,
    rentPayer,
  });
}
