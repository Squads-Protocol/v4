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

/**
 * @deprecated This instruction is deprecated and will be removed soon. Please use `multisigCreateV2` to ensure future compatibility.
 *
 * Creates a new multisig.
 */
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
  programId,
}: {
  connection: Connection;
  createKey: Signer;
  creator: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey | null;
  threshold: number;
  members: Member[];
  timeLock: number;
  memo?: string;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigCreate({
    blockhash,
    createKey: createKey.publicKey,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    timeLock,
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
