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
export async function multisigCreateV2({
  connection,
  treasury,
  createKey,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  timeLock,
  rentCollector,
  memo,
  sendOptions,
  programId,
}: {
  connection: Connection;
  treasury: PublicKey;
  createKey: Signer;
  creator: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  rentCollector: PublicKey | null;
  memo?: string;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigCreateV2({
    blockhash,
    treasury,
    createKey: createKey.publicKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
    rentCollector,
    memo,
    programId,
  });

  tx.sign([creator, createKey]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
