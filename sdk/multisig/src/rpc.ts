import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "./transactions.js";
import { Member } from "./generated";
import { translateAndThrowAnchorError } from "./errors";

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

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
