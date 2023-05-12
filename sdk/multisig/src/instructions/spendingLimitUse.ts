import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { createSpendingLimitUseInstruction } from "../generated";
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
  memo,
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
  memo?: string;
}): TransactionInstruction {
  const [vaultPda] = getVaultPda({ multisigPda, index: vaultIndex });

  const vaultTokenAccount =
    mint &&
    getAssociatedTokenAddressSync(
      mint,
      vaultPda,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

  const destinationTokenAccount =
    mint &&
    getAssociatedTokenAddressSync(
      mint,
      destination,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

  const tokenProgram = mint ? TOKEN_2022_PROGRAM_ID : undefined;

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
      tokenProgram,
    },
    { args: { amount, decimals, memo: memo ?? null } }
  );
}
