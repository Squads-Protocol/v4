import { PublicKey } from "@solana/web3.js";
import {
  ConfigAction,
  createConfigTransactionCreateInstruction,
} from "../generated";
import { getTransactionPda } from "../pda";

export function configTransactionCreate({
  multisigPda,
  creator,
  transactionIndex,
  actions,
  memo,
}: {
  multisigPda: PublicKey;
  creator: PublicKey;
  transactionIndex: bigint;
  actions: ConfigAction[];
  memo?: string;
}) {
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });

  return createConfigTransactionCreateInstruction(
    { creator, multisig: multisigPda, transaction: transactionPda },
    { args: { actions, memo: memo ?? null } }
  );
}
