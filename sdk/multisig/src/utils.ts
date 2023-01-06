import { u8, u32, u64, bignum } from "@metaplex-foundation/beet";
import { Buffer } from "buffer";

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