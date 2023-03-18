import { Connection, PublicKey } from "@solana/web3.js";
import { getProposalPda, getTransactionPda, getVaultPda } from "../pda";
import {
  createVaultTransactionExecuteInstruction,
  VaultTransaction,
} from "../generated";
import { remainingAccountsForTransactionExecute } from "../utils";

export async function vaultTransactionExecute({
  connection,
  multisigPda,
  transactionIndex,
  member,
}: {
  connection: Connection;
  multisigPda: PublicKey;
  transactionIndex: bigint;
  member: PublicKey;
}) {
  const [proposalPda] = getProposalPda({
    multisigPda,
    transactionIndex,
  });
  const [transactionPda] = getTransactionPda({
    multisigPda,
    index: transactionIndex,
  });
  const transactionAccount = await VaultTransaction.fromAccountAddress(
    connection,
    transactionPda
  );

  const [vaultPda] = getVaultPda({
    multisigPda,
    index: transactionAccount.vaultIndex,
  });

  const remainingAccounts = await remainingAccountsForTransactionExecute({
    connection,
    message: transactionAccount.message,
    ephemeralSignerBumps: [...transactionAccount.ephemeralSignerBumps],
    vaultPda,
    transactionPda,
  });

  return createVaultTransactionExecuteInstruction({
    multisig: multisigPda,
    member,
    proposal: proposalPda,
    transaction: transactionPda,
    anchorRemainingAccounts: remainingAccounts,
  });
}
