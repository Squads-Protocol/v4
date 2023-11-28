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
 * Closes Batch and the corresponding Proposal accounts for proposals in terminal states:
 * `Executed`, `Rejected`, or `Cancelled` or stale proposals that aren't Approved.
 *
 * WARNING: Make sure to call this instruction only after all `VaultBatchTransaction`s
 * are already closed via `vault_batch_transaction_account_close`,
 * because the latter requires existing `Batch` and `Proposal` accounts, which this instruction closes.
 * There is no on-chain check preventing you from closing the `Batch` and `Proposal` accounts
 * first, so you will end up with no way to close the corresponding `VaultBatchTransaction`s.
 */
export async function batchAccountsClose({
  connection,
  feePayer,
  multisigPda,
  member,
  rentCollector,
  batchIndex,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  member: Signer;
  rentCollector: PublicKey;
  batchIndex: bigint;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.batchAccountsClose({
    blockhash,
    feePayer: feePayer.publicKey,
    member: member.publicKey,
    rentCollector,
    batchIndex,
    multisigPda,
    programId,
  });

  tx.sign([feePayer, member]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
