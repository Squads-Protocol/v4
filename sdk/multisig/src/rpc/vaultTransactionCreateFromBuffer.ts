import {
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Convert the final buffer contents into a VaultTransaction. */
export async function vaultTransactionCreateFromBuffer({
  connection,
  feePayer,
  multisigPda,
  bufferIndex,
  creator,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  /* Transaction index of the buffer account to convert. */
  bufferIndex: number;
  creator: PublicKey;
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.vaultTransactionCreateFromBuffer({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    bufferIndex,
    creator,
    programId,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
