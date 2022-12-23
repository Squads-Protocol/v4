import {
  Connection,
  PublicKey,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "./transactions.js";

/** Creates a new multisig. */
export async function create({
  connection,
  creator,
  configAuthority,
  members,
  memo,
}: {
  connection: Connection;
  creator: Signer;
  configAuthority: PublicKey;
  members: PublicKey[];
  memo?: string;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.create({
    blockhash,
    creator: creator.publicKey,
    configAuthority,
    members,
    memo,
  });

  tx.sign([creator]);

  return await connection.sendTransaction(tx);
}
