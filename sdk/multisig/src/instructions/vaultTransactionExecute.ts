import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { getProposalPda, getTransactionPda, getVaultPda } from "../pda";
import {
  createVaultTransactionExecuteInstruction,
  PROGRAM_ID,
  VaultTransaction,
} from "../generated";
import { accountsForTransactionExecute } from "../utils";

export async function vaultTransactionExecute({
  connection,
  multisigPda,
  transactionIndex,
  member,
  programId = PROGRAM_ID,
}: {
  connection: Connection;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
  programId?: PublicKey;
}): Promise<{
  instruction: TransactionInstruction;
  lookupTableAccounts: AddressLookupTableAccount[];
}> {
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
  const transactionAccount = await VaultTransaction.fromAccountAddress(
    connection,
    transactionPda
  );

  const [vaultPda] = getVaultPda({
    multisigPda,
    index: transactionAccount.vaultIndex,
    programId,
  });

  const { accountMetas, lookupTableAccounts } =
    await accountsForTransactionExecute({
      connection,
      message: transactionAccount.message,
      ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
      vaultPda,
      transactionPda,
      programId,
    });

  return {
    instruction: createVaultTransactionExecuteInstruction(
      {
        multisig: multisigPda,
        member,
        proposal: proposalPda,
        transaction: transactionPda,
        anchorRemainingAccounts: accountMetas,
      },
      programId
    ),
    lookupTableAccounts,
  };
}
