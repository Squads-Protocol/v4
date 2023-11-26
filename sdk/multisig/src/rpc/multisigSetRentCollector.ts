import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Set the multisig `rent_collector`. */
export async function multisigSetRentCollector({
  connection,
  feePayer,
  multisigPda,
  configAuthority,
  newRentCollector,
  rentPayer,
  memo,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  newRentCollector: PublicKey | null;
  rentPayer: PublicKey;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigSetRentCollector({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    configAuthority,
    newRentCollector,
    rentPayer,
    memo,
    programId,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
