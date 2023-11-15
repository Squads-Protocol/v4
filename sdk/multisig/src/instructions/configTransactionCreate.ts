import { PublicKey } from "@solana/web3.js";
import {
  ConfigAction,
  createConfigTransactionCreateInstruction,
  PROGRAM_ID,
} from "../generated";
import { getTransactionPda } from "../pda";

export function configTransactionCreate({
  multisigPda,
  transactionIndex,
  creator,
  rentPayer,
  actions,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  /** Member of the multisig that is creating the transaction. */
  creator: PublicKey;
  /** Payer for the transaction account rent. If not provided, `creator` is used. */
  rentPayer?: PublicKey;
  transactionIndex: bigint;
  actions: ConfigAction[];
  memo?: string;
  programId?: PublicKey;
}) {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  return createConfigTransactionCreateInstruction(
    {
      multisig: multisigPda,
      transaction: transactionPda,
      creator,
      rentPayer: rentPayer ?? creator,
    },
    { args: { actions, memo: memo ?? null } },
    programId
  );
}
