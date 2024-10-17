import {
  createTransactionBufferExtendInstruction,
  PROGRAM_ID,
} from "../generated";
import { PublicKey } from "@solana/web3.js";
import { getTransactionBufferPda } from "../pda";

export function transactionBufferExtend({
  multisigPda,
  bufferIndex,
  bufferSlice,
  creator,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  bufferIndex: number;
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
