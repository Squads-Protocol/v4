import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";
import { PROGRAM_ID } from "../generated";

export async function versionedProposalCreate({
  connection,
  multisigPda,
  creator,
  payer,
  transactionIndex,
  sendOptions,
  programId,
}: {
  connection: Connection;
  multisigPda: PublicKey;
  creator: Signer;
  payer: Signer;
  transactionIndex: bigint;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.versionedProposalCreate({
    blockhash,
    multisigPda,
    creator: creator.publicKey,
    payer: payer.publicKey,
    transactionIndex,
    programId: programId ?? PROGRAM_ID,
  });

  const transaction = new VersionedTransaction(tx);

  transaction.sign([creator]);

  try {
    return await connection.sendTransaction(transaction, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
} 