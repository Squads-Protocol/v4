import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./generated";
import { toU64Bytes, toU8Bytes, toUtfBytes } from "./utils";

const SEED_PREFIX = toUtfBytes("multisig");
const SEED_MULTISIG = toUtfBytes("multisig");
const SEED_AUTHORITY = toUtfBytes("authority");
const SEED_TRANSACTION = toUtfBytes("transaction");
const SEED_ADDITIONAL_SIGNER = toUtfBytes("additional_signer");

export function getMultisigPda({
  createKey,
  programId = PROGRAM_ID,
}: {
  createKey: PublicKey;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX, createKey.toBytes(), SEED_MULTISIG],
    programId
  );
}

export function getAuthorityPda({
  multisigPda,
  /** Authority index. */
  index,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  index: number;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEED_PREFIX, multisigPda.toBytes(), toU8Bytes(index), SEED_AUTHORITY],
    programId
  );
}

export function getAdditionalSignerPda({
  transactionPda,
  additionalSignerIndex,
  programId = PROGRAM_ID,
}: {
  transactionPda: PublicKey;
  additionalSignerIndex: number;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      SEED_PREFIX,
      transactionPda.toBytes(),
      toU8Bytes(additionalSignerIndex),
      SEED_ADDITIONAL_SIGNER,
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
    [SEED_PREFIX, multisigPda.toBytes(), toU64Bytes(index), SEED_TRANSACTION],
    programId
  );
}
