import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Change the `threshold` of a controlled multisig. */
export async function multisigChangeThreshold({
  connection,
  multisigPda,
  configAuthority,
  rentPayer,
  newThreshold,
  memo,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  multisigPda: PublicKey;
  configAuthority: PublicKey;
  /** Pays the transaction fee. */
  rentPayer: Signer;
  newThreshold: number;
  memo?: string;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.multisigChangeThreshold({
    blockhash,
    multisigPda,
    configAuthority,
    rentPayer: rentPayer.publicKey,
    newThreshold,
    memo,
    programId,
  });

  tx.sign([rentPayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
