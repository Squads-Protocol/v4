import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import * as instructions from "../instructions/index.js";

export function transactionBufferCreate({
  blockhash,
  feePayer,
  multisigPda,
  bufferIndex,
  creator,
  rentPayer,
  vaultIndex,
  transactionMessage,
  addressLookupTableAccounts,
  programId,
}: {
  blockhash: string;
  feePayer: PublicKey;
  multisigPda: PublicKey;
  bufferIndex: number;
  creator: PublicKey;
  rentPayer?: PublicKey;
  vaultIndex: number;
  /** Transaction message to serialize into a buffer for uploading. */
  transactionMessage: TransactionMessage;
  /** `AddressLookupTableAccounts referenced in `transaction_message`. */
  addressLookupTableAccounts?: AddressLookupTableAccount[];
  programId?: PublicKey;
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: feePayer,
    recentBlockhash: blockhash,
    instructions: [
      instructions.transactionBufferCreate({
        multisigPda,
        bufferIndex,
        creator,
        rentPayer,
        vaultIndex,
        transactionMessage,
        addressLookupTableAccounts,
        programId,
      }),
    ],
  }).compileToV0Message();

  return new VersionedTransaction(message);
}
