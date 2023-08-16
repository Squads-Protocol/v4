import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import { Member } from "../generated";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Creates a new multisig. */
export async function multisigCreate({
  connection,
  createKey,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  memo,
  sendOptions,
}: {
  connection: Connection;
  createKey: PublicKey;
  creator: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  memo?: string;
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigCreate({
    blockhash,
    createKey: createKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    memo,
  });

  tx.sign([creator]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
