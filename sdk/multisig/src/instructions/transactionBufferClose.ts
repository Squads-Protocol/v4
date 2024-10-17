import {
  createTransactionBufferCloseInstruction,
  PROGRAM_ID,
} from "../generated";
import { PublicKey } from "@solana/web3.js";
import { getTransactionBufferPda } from "../pda";

export function transactionBufferClose({
  multisigPda,
  bufferIndex,
  creator,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  /* Transaction index of the buffer account to close. */
  bufferIndex: number;
  creator: PublicKey;
  programId?: PublicKey;
}) {
  const [transactionBuffer] = getTransactionBufferPda({
    multisigPda,
    creator,
    bufferIndex,
    programId,
  });

  return createTransactionBufferCloseInstruction(
    {
      multisig: multisigPda,
      transactionBuffer: transactionBuffer,
      creator,
    },
    programId
  );
}
