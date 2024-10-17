import {
  createTransactionBufferCreateInstruction,
  PROGRAM_ID,
} from "../generated";
import {
  AddressLookupTableAccount,
  PublicKey,
  TransactionMessage,
} from "@solana/web3.js";
import * as crypto from "crypto";
import { getTransactionBufferPda, getVaultPda } from "../pda";
import { transactionMessageToMultisigTransactionMessageBytes } from "../utils";

export function transactionBufferCreate({
  multisigPda,
  bufferIndex,
  creator,
  rentPayer,
  vaultIndex,
  transactionMessage,
  addressLookupTableAccounts,
  programId = PROGRAM_ID,
}: {
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
}) {
  const [vaultPda] = getVaultPda({
    multisigPda,
    index: vaultIndex,
    programId,
  });

  const [transactionBuffer] = getTransactionBufferPda({
    multisigPda,
    creator,
    bufferIndex,
    programId,
  });

  const messageBuffer = transactionMessageToMultisigTransactionMessageBytes({
    message: transactionMessage,
    addressLookupTableAccounts,
    vaultPda,
  });

  const finalBufferHash = crypto
    .createHash("sha256")
    .update(messageBuffer)
    .digest();

  return createTransactionBufferCreateInstruction(
    {
      multisig: multisigPda,
      transactionBuffer: transactionBuffer,
      creator,
      rentPayer: rentPayer ?? creator,
    },
    {
      args: {
        bufferIndex: bufferIndex,
        vaultIndex: vaultIndex,
        finalBufferHash: Array.from(finalBufferHash),
        finalBufferSize: messageBuffer.length,
        buffer: messageBuffer,
      },
    },
    programId
  );
}
