import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

export async function spendingLimitUse({
  connection,
  feePayer,
  member,
  multisigPda,
  spendingLimit,
  mint,
  vaultIndex,
  amount,
  decimals,
  destination,
  tokenProgram,
  memo,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  member: Signer;
  multisigPda: PublicKey;
  spendingLimit: PublicKey;
  /** Provide if `spendingLimit` is for an SPL token, omit if it's for SOL. */
  mint?: PublicKey;
  vaultIndex: number;
  amount: number;
  decimals: number;
  destination: PublicKey;
  tokenProgram?: PublicKey;
  memo?: string;
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.spendingLimitUse({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    member: member.publicKey,
    spendingLimit,
    mint,
    vaultIndex,
    amount,
    decimals,
    destination,
    tokenProgram,
    memo,
    programId,
  });

  tx.sign([feePayer, member]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
