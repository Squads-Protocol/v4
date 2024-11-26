import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  SendOptions,
  Signer,
  TransactionMessage,
  TransactionSignature,
} from "@solana/web3.js";
import * as transactions from "../transactions";
import { translateAndThrowAnchorError } from "../errors";

/** Creates a new transaction buffer. */
export async function transactionBufferCreate({
  connection,
  feePayer,
  multisigPda,
  bufferIndex,
  creator,
  rentPayer,
  vaultIndex,
  transactionMessage,
  addressLookupTableAccounts,
  signers,
  sendOptions,
  programId,
}: {
  connection: Connection;
  feePayer: Signer;
  multisigPda: PublicKey;
  /* Transaction index of the buffer account to create. */
  bufferIndex: number;
  creator: PublicKey;
  rentPayer?: PublicKey;
  vaultIndex: number;
  /** Transaction message to serialize into a buffer for uploading. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccounts referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  signers?: Signer[];
  sendOptions?: SendOptions;
  programId?: PublicKey;
}): Promise<TransactionSignature> {
  const blockhash = (await connection.getLatestBlockhash()).blockhash;

  const tx = transactions.transactionBufferCreate({
    blockhash,
    feePayer: feePayer.publicKey,
    multisigPda,
    bufferIndex,
    creator,
    rentPayer,
    vaultIndex,
    transactionMessage,
    addressLookupTableAccounts,
    programId,
  });

  tx.sign([feePayer, ...(signers ?? [])]);

  try {
    return await connection.sendTransaction(tx, sendOptions);
  } catch (err) {
    translateAndThrowAnchorError(err);
  }
}
