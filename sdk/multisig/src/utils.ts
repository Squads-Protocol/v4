import { u8, u32, u64, bignum } from "@metaplex-foundation/beet";
import { Buffer } from "buffer";
import { MultisigTransactionMessage } from "./generated";
import { VersionedTransaction } from "@solana/web3.js";

export function toUtfBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function toU8Bytes(num: number): Uint8Array {
  const bytes = Buffer.alloc(1);
  u8.write(bytes, 0, num);
  return bytes;
}

export function toU32Bytes(num: number): Uint8Array {
  const bytes = Buffer.alloc(4);
  u32.write(bytes, 0, num);
  return bytes;
}

export function toU64Bytes(num: bigint): Uint8Array {
  const bytes = Buffer.alloc(8);
  u64.write(bytes, 0, num);
  return bytes;
}

export function toBigInt(number: bignum): bigint {
  return BigInt(number.toString());
}

const MAX_TX_SIZE_BYTES = 1232;
const STRING_LEN_SIZE = 4;
export function getAvailableMemoSize(
  txWithoutMemo: VersionedTransaction
): number {
  const txSize = txWithoutMemo.serialize().length;
  return (
    MAX_TX_SIZE_BYTES -
    txSize -
    STRING_LEN_SIZE -
    1 /*TODO: Figure out where this extra byte is coming from*/
  );
}

export function isStaticWritableIndex(
  message: MultisigTransactionMessage,
  index: number
) {
  const numAccountKeys = message.accountKeys.length;
  const { numSigners, numWritableSigners, numWritableNonSigners } = message;

  if (index >= numAccountKeys) {
    // `index` is not a part of static `accountKeys`.
    return false;
  }

  if (index < numWritableSigners) {
    // `index` is within the range of writable signer keys.
    return true;
  }

  if (index >= numSigners) {
    // `index` is within the range of non-signer keys.
    const indexIntoNonSigners = index - numSigners;
    // Whether `index` is within the range of writable non-signer keys.
    return indexIntoNonSigners < numWritableNonSigners;
  }

  return false;
}

export function isSignerIndex(
  message: MultisigTransactionMessage,
  index: number
) {
  return index < message.numSigners;
}
