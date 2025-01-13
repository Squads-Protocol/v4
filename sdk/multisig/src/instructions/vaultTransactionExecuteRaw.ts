import {
  AccountMeta,
  PublicKey,
  TransactionInstruction
} from "@solana/web3.js";
import {
  createVaultTransactionExecuteInstruction,
  PROGRAM_ID
} from "../generated";
import { getProposalPda, getTransactionPda, getVaultPda } from "../pda";

export function vaultTransactionExecuteRaw({
  multisigPda,
  transactionIndex,
  member,
  vaultIndex,
  accounts,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  transactionIndex: bigint;
  vaultIndex: bigint
  accounts: AccountMeta[];
  member: PublicKey;
  programId?: PublicKey;
}): TransactionInstruction {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
    programId,
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
    programId,
  });

  const [vaultPda] = getVaultPda({
    multisigPda,
    index: Number(vaultIndex),
    programId,
  });


  return createVaultTransactionExecuteInstruction(
    {
      multisig: multisigPda,
      member,
      proposal: proposalPda,
      transaction: transactionPda,
      anchorRemainingAccounts: accounts,
    },
    programId
  );
}
