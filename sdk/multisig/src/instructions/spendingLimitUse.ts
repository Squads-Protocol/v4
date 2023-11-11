import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createSpendingLimitUseInstruction, PROGRAM_ID } from "../generated";
import { getVaultPda } from "../pda";

export function spendingLimitUse({
  multisigPda,
  member,
  spendingLimit,
  mint,
  vaultIndex,
  amount,
  decimals,
  destination,
  tokenProgram = TOKEN_PROGRAM_ID,
  memo,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  member: PublicKey;
  spendingLimit: PublicKey;
  /** Provide if `spendingLimit` is for an SPL token, omit if it's for SOL. */
  mint?: PublicKey;
  vaultIndex: number;
  amount: number;
  decimals: number;
  destination: PublicKey;
  tokenProgram?: PublicKey;
  memo?: string;
  programId?: PublicKey;
}): TransactionInstruction {
  const [vaultPda] = getVaultPda({ multisigPda, index: vaultIndex, programId });

  const vaultTokenAccount =
    mint &&
    getAssociatedTokenAddressSync(
      mint,
      vaultPda,
      true,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

  const destinationTokenAccount =
    mint &&
    getAssociatedTokenAddressSync(
      mint,
      destination,
      true,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

  return createSpendingLimitUseInstruction(
    {
      multisig: multisigPda,
      member,
      spendingLimit,
      vault: vaultPda,
      destination,
      systemProgram: SystemProgram.programId,
      mint,
      vaultTokenAccount,
      destinationTokenAccount,
      tokenProgram: mint ? tokenProgram : undefined,
    },
    { args: { amount, decimals, memo: memo ?? null } },
    programId
  );
}
