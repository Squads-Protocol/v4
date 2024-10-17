import {
  createVaultTransactionCreateFromBufferInstruction,
  PROGRAM_ID,
} from "../generated";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { getTransactionBufferPda } from "../pda";

export function vaultTransactionCreateFromBuffer({
  multisigPda,
  bufferIndex,
  creator,
  programId = PROGRAM_ID,
  memo,
}: {
  multisigPda: PublicKey;
  bufferIndex: number;
  creator: PublicKey;
  memo?: string;
  programId?: PublicKey;
}) {
  const [transactionBuffer] = getTransactionBufferPda({
    multisigPda,
    creator,
    bufferIndex,
    programId,
  });

  return createVaultTransactionCreateFromBufferInstruction(
    {
      vaultTransactionCreateItemCreator: creator,
      vaultTransactionCreateItemMultisig: multisigPda,
      vaultTransactionCreateItemTransaction: transactionBuffer,
      vaultTransactionCreateItemRentPayer: creator,
      vaultTransactionCreateItemSystemProgram: SystemProgram.programId,
      creator,
      transactionBuffer,
    },
    {
      args: {
        vaultIndex: 0,
        transactionMessage: new Uint8Array(6).fill(0),
        ephemeralSigners: 0,
        memo: memo ?? null,
      },
    },
    programId
  );
}
