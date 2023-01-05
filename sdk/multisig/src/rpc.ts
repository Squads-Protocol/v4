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
export async function multisigCreate({
  connection,
  creator,
  multisigPda,
  configAuthority,
  threshold,
  members,
  createKey,
  allowExternalExecute,
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
  allowExternalExecute?: boolean;
  memo?: string;
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigCreate({
    blockhash,
    creator: creator.publicKey,
    multisigPda,
    configAuthority,
    threshold,
    members,
    createKey,
    allowExternalExecute,
    memo,
  });

  tx.sign([creator]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}

/** Add a member/key to the multisig and reallocate space if necessary. */
export async function multisigAddMember({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  newMember,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newMember: Member;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigAddMember({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    newMember,
    memo,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
