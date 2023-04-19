import {
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index";

export function multisigAddVault({
  blockhash,
  feePayer,
  multisigPda,
  configAuthority,
  vaultIndex,
  memo,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  vaultIndex: number;
  memo?: string;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.multisigAddVault({
        multisigPda,
        configAuthority,
        vaultIndex,
        memo,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
