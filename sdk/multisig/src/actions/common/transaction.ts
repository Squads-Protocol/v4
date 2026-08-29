import { PROGRAM_ID, accounts, instructions } from "../..";
import {
  BatchAddTransactionActionArgs,
  BatchAddTransactionResult,
  CreateBatchActionArgs,
  CreateBatchResult,
  CreateConfigTransactionActionArgs,
  CreateConfigTransactionResult,
  CreateVaultTransactionActionArgs,
  CreateVaultTransactionResult,
  ExecuteBatchActionArgs,
  ExecuteBatchResult,
  ExecuteConfigTransactionActionArgs,
  ExecuteConfigTransactionResult,
  ExecuteVaultTransactionActionArgs,
  ExecuteVaultTransactionResult,
  ProposalResult,
  ReclaimRentActionArgs,
} from "./types";

//region VaultTransaction
export async function createVaultTransactionCore(
  args: CreateVaultTransactionActionArgs,
  transactionIndex?: number
): Promise<CreateVaultTransactionResult> {
  const {
    connection,
    multisig,
    creator,
    message,
    vaultIndex = 0,
    ephemeralSigners = 0,
    rentPayer = creator,
    memo,
    programId = PROGRAM_ID,
  } = args;

  const multisigInfo = await accounts.Multisig.fromAccountAddress(
    connection,
    multisig
  );
  let index;
  if (transactionIndex) {
    index = BigInt(transactionIndex);
  } else {
    const currentTransactionIndex = Number(multisigInfo.transactionIndex);
    index = BigInt(currentTransactionIndex + 1);
  }

  const ix = instructions.vaultTransactionCreate({
    multisigPda: multisig,
    transactionIndex: index,
    creator: creator,
    vaultIndex: vaultIndex,
    ephemeralSigners: ephemeralSigners,
    transactionMessage: message,
    memo: memo,
    rentPayer,
    programId: programId,
  });

  return { instructions: [ix], index: Number(index) };
}

export async function executeVaultTransactionCore(
  args: ExecuteVaultTransactionActionArgs
): Promise<ExecuteVaultTransactionResult> {
  const { connection, multisig, index, member, programId = PROGRAM_ID } = args;
  const ix = await instructions.vaultTransactionExecute({
    connection,
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(index),
    programId: programId,
  });

  return {
    ...ix,
  };
}

export async function reclaimRentCore(
  args: ReclaimRentActionArgs
): Promise<ProposalResult> {
  const { connection, multisig, index, programId = PROGRAM_ID } = args;
  const multisigInfo = await accounts.Multisig.fromAccountAddress(
    connection,
    multisig
  );

  if (!multisigInfo.rentCollector) {
    throw new Error("No rent collector found in Multisig config.");
  }

  const ix = instructions.vaultTransactionAccountsClose({
    multisigPda: multisig,
    rentCollector: multisigInfo.rentCollector,
    transactionIndex: BigInt(index),
    programId: programId,
  });

  return {
    instruction: ix,
  };
}
//endregion

//region ConfigTransaction
export async function createConfigTransactionCore(
  args: CreateConfigTransactionActionArgs
): Promise<CreateConfigTransactionResult> {
  const {
    connection,
    multisig,
    creator,
    actions,
    rentPayer = creator,
    memo,
    programId = PROGRAM_ID,
  } = args;

  const multisigInfo = await accounts.Multisig.fromAccountAddress(
    connection,
    multisig
  );

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const index = BigInt(currentTransactionIndex + 1);

  const ix = instructions.configTransactionCreate({
    multisigPda: multisig,
    transactionIndex: index,
    creator: creator,
    actions,
    memo: memo,
    rentPayer,
    programId: programId,
  });

  return { instructions: [ix], index: Number(index) };
}

export async function executeConfigTransactionCore(
  args: ExecuteConfigTransactionActionArgs
): Promise<ExecuteConfigTransactionResult> {
  const { multisig, index, member, programId = PROGRAM_ID } = args;
  const ix = instructions.configTransactionExecute({
    multisigPda: multisig,
    member: member,
    transactionIndex: BigInt(index),
    programId: programId,
  });

  return { instruction: ix };
}
//endregion

//region Batch
export async function createBatchCore(
  args: CreateBatchActionArgs
): Promise<CreateBatchResult> {
  const {
    connection,
    multisig,
    creator,
    vaultIndex = 0,
    rentPayer = creator,
    memo,
    programId = PROGRAM_ID,
  } = args;

  const multisigInfo = await accounts.Multisig.fromAccountAddress(
    connection,
    multisig
  );

  const currentTransactionIndex = Number(multisigInfo.transactionIndex);
  const index = BigInt(currentTransactionIndex + 1);

  const ix = instructions.batchCreate({
    multisigPda: multisig,
    batchIndex: index,
    creator: creator,
    vaultIndex: vaultIndex,
    memo: memo,
    rentPayer,
    programId: programId,
  });

  return { instructions: [ix], index: Number(index) };
}

export async function addBatchTransactionCore(
  args: BatchAddTransactionActionArgs
): Promise<BatchAddTransactionResult> {
  const {
    multisig,
    globalIndex,
    innerIndex,
    message,
    vaultIndex,
    ephemeralSigners,
    member,
    programId = PROGRAM_ID,
  } = args;
  const ix = instructions.batchAddTransaction({
    multisigPda: multisig,
    member: member,
    batchIndex: BigInt(globalIndex),
    transactionIndex: innerIndex,
    transactionMessage: message,
    vaultIndex: vaultIndex ?? 0,
    ephemeralSigners: ephemeralSigners ?? 0,
    programId: programId,
  });

  return { instruction: ix };
}

export async function executeBatchTransactionCore(
  args: ExecuteBatchActionArgs
): Promise<ExecuteBatchResult> {
  const { connection, multisig, index, member, programId = PROGRAM_ID } = args;
  const ix = instructions.batchExecuteTransaction({
    connection,
    multisigPda: multisig,
    member: member,
    batchIndex: BigInt(index),
    transactionIndex: index,
    programId: programId,
  });

  return { ...ix };
}
//endregion
