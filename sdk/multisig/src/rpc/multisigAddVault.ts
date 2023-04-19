import { Connection, PublicKey, SendOptions, Signer } from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

export async function multisigAddVault({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  vaultIndex,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  vaultIndex: number;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}) {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigAddVault({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    vaultIndex,
    memo,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
