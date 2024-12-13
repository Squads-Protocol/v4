import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./generated";
import { toU32Bytes, toU64Bytes, toU8Bytes, toUtfBytes } from "./utils";
import invariant from "invariant";

const SEED_PREFIX = toUtfBytes("multisig");
const SEED_PROGRAM_CONFIG = toUtfBytes("program_config");
const SEED_MULTISIG = toUtfBytes("multisig");
const SEED_VAULT = toUtfBytes("vault");
const SEED_TRANSACTION = toUtfBytes("transaction");
const SEED_PROPOSAL = toUtfBytes("proposal");
const SEED_BATCH_TRANSACTION = toUtfBytes("batch_transaction");
const SEED_EPHEMERAL_SIGNER = toUtfBytes("ephemeral_signer");
const SEED_SPENDING_LIMIT = toUtfBytes("spending_limit");

export function getProgramConfigPda({
  programId = PROGRAM_ID,
}: {
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX, SEED_PROGRAM_CONFIG],
    programId
  );
}

export function getMultisigPda({
  createKey,
  programId = PROGRAM_ID,
}: {
  createKey: PublicKey;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX, SEED_MULTISIG, createKey.toBytes()],
    programId
  );
}

export function getVaultPda({
  multisigPda,
  /** Authority index. */
  index,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  index: number;
  programId?: PublicKey;
}): [PublicKey, number] {
  invariant(index >= 0 && index < 256, "Invalid vault index");

  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX, multisigPda.toBytes(), SEED_VAULT, toU8Bytes(index)],
    programId
  );
}

export function getEphemeralSignerPda({
  transactionPda,
  ephemeralSignerIndex,
  programId = PROGRAM_ID,
}: {
  transactionPda: PublicKey;
  ephemeralSignerIndex: number;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      transactionPda.toBytes(),
      SEED_EPHEMERAL_SIGNER,
      toU8Bytes(ephemeralSignerIndex),
    ],
    programId
  );
}

export function getTransactionPda({
  multisigPda,
  index,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  /** Transaction index. */
  index: bigint;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX, multisigPda.toBytes(), SEED_TRANSACTION, toU64Bytes(index)],
    programId
  );
}

export function getProposalPda({
  multisigPda,
  transactionIndex,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  /** Transaction index. */
  transactionIndex: bigint;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      multisigPda.toBytes(),
      SEED_TRANSACTION,
      toU64Bytes(transactionIndex),
      SEED_PROPOSAL,
    ],
    programId
  );
}

export function getBatchTransactionPda({
  multisigPda,
  batchIndex,
  transactionIndex,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  batchIndex: bigint;
  transactionIndex: number;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      multisigPda.toBytes(),
      SEED_TRANSACTION,
      toU64Bytes(batchIndex),
      SEED_BATCH_TRANSACTION,
      toU32Bytes(transactionIndex),
    ],
    programId
  );
}

export function getSpendingLimitPda({
  multisigPda,
  createKey,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  createKey: PublicKey;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      multisigPda.toBytes(),
      SEED_SPENDING_LIMIT,
      createKey.toBytes(),
    ],
    programId
  );
}
