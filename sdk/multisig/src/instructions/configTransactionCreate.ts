import { PublicKey } from "@solana/web3.js";
import {
  ConfigAction,
  createConfigTransactionCreateInstruction,
} from "../generated";
import { getTransactionPda } from "../pda";

export function configTransactionCreate({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  actions,
  memo,
}: {
  multisigPda: PublicKey;
  /** Member of the multisig that is creating the transaction. */
  creator: PublicKey;
  /** Payer for the transaction account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
  transactionIndex: bigint;
  actions: ConfigAction[];
  memo?: string;
}) {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  return createConfigTransactionCreateInstruction(
    {
      multisig: multisigPda,
      transaction: transactionPda,
      creator,
      rentPayer: rentPayer ?? creator,
    },
    { args: { actions, memo: memo ?? null } }
  );
}
