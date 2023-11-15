import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions/index.js";
import { translateAndThrowAnchorError } from "../errors";

/**
 * Close the Proposal and ConfigTransaction accounts associated with a config transaction.
 */
export async function configTransactionAccountsClose({
  connection,
  feePayer,
  multisigPda,
  rentCollector,
  transactionIndex,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  rentCollector: PublicKey;
  transactionIndex: bigint;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.configTransactionAccountsClose({
    blockhash,
    feePayer: feePayer.publicKey,
    rentCollector,
    transactionIndex,
    multisigPda,
    programId,
  });

  tx.sign([feePayer]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
