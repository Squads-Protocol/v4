import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Execute a transaction from a batch. */
export async function batchExecuteTransaction({
  connection,
  feePayer,
  multisigPda,
  member,
  batchIndex,
  transactionIndex,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  member: Signer;
  batchIndex: bigint;
  transactionIndex: number;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = await transactions.batchExecuteTransaction({
    connection,
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    member: member.publicKey,
    batchIndex,
    transactionIndex,
    programId,
  });

  tx.sign([feePayer, member, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
