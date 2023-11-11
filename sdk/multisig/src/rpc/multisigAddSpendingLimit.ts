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
export async function multisigAddSpendingLimit({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  spendingLimit,
  rentPayer,
  createKey,
  vaultIndex,
  mint,
  amount,
  period,
  members,
  destinations,
  memo,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  configAuthority: PublicKey;
  rentPayer: Signer;
  createKey: PublicKey;
  vaultIndex: number;
  mint: PublicKey;
  amount: bigint;
  period: Period;
  members: PublicKey[];
  destinations: PublicKey[];
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigAddSpendingLimit({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    spendingLimit,
    rentPayer: rentPayer.publicKey,
    createKey,
    vaultIndex,
    mint,
    amount,
    period,
    members,
    destinations,
    memo,
    programId,
  });

  tx.sign([feePayer, rentPayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
