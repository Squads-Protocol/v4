import {
  createTransactionBufferExtendInstruction,
  PROGRAM_ID,
} from "../generated";
import { PublicKey } from "@solana/web3.js";
import { getTransactionBufferPda } from "../pda";

/* Extends an existing transaction buffer. */
export function transactionBufferExtend({
  multisigPda,
  bufferIndex,
  bufferSlice,
  creator,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  /* Transaction index of the buffer account to extend. */
  bufferIndex: number;
  /* Slice of the buffer to append. It's recommended to update in chunks of 400-750 bytes. */
  bufferSlice: Uint8Array;
  creator: PublicKey;
  programId?: PublicKey;
}) {
  const [transactionBuffer] = getTransactionBufferPda({
    multisigPda,
    creator,
    bufferIndex,
    programId,
  });

  return createTransactionBufferExtendInstruction(
    {
      multisig: multisigPda,
      transactionBuffer,
      creator,
    },
    {
      args: {
        buffer: bufferSlice,
      },
    },
    programId
  );
}
