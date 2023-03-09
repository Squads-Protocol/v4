import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { getTransactionPda } from "../pda";
import { createVaultTransactionRejectInstruction } from "../generated";

export function vaultTransactionReject({
  blockhash,
  feePayer,
  multisigPda,
  transactionIndex,
  member,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
}): VersionedTransaction {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      createVaultTransactionRejectInstruction(
        {
          multisig: multisigPda,
          transaction: transactionPda,
          member,
        },
        {
          args: {
            memo: memo ?? null,
          },
        }
      ),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
