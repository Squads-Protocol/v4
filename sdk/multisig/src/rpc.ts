import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "./transactions.js";
import { Member } from "./generated";

/** Creates a new multisig. */
export async function create({
  connection,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  createKey,
  allowExternalSigners,
  memo,
  sendOptions,
}: {
  connection: Connection;
  creator: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  threshold: number;
  members: Member[];
  createKey: PublicKey;
  allowExternalSigners?: boolean;
  memo?: string;
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.create({
    blockhash,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    createKey,
    allowExternalSigners,
    memo,
  });

  tx.sign([creator]);

  return await connection.sendTransaction(tx, sendOptions);
}
