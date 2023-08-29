import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import { Period } from "../generated";
import * as transactions from "../transactions/index";
import { translateAndThrowAnchorError } from "../errors";

/**
 * Create a new spending limit for the controlled multisig.
 */
export async function multisigRemoveSpendingLimit({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentCollector,
  memo,
  signers,
  sendOptions,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentCollector: PublicKey;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigRemoveSpendingLimit({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    spendingLimit,
    rentCollector,
    memo,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
