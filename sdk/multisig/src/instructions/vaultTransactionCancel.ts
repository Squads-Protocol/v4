import { getTransactionPda } from "../pda";
import { createVaultTransactionCancelInstruction } from "../generated";
import { PublicKey } from "@solana/web3.js";

export function vaultTransactionCancel({
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

  return createVaultTransactionCancelInstruction(
    { multisig: multisigPda, transaction: transactionPda, member },
    { args: { memo: memo ?? null } }
  );
}
