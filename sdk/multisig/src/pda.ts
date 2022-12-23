import { PublicKey } from "@solana/web3.js";
import { PROGRAM_ID } from "./generated";
import { toU32Bytes, toUtfBytes } from "./utils";

/** ["multisig", createKey, "multisig"] */
export function getMultisigPda({
  createKey,
  programId = PROGRAM_ID,
}: {
  createKey: PublicKey;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [toUtfBytes("multisig"), createKey.toBytes(), toUtfBytes("multisig")],
    programId
  );
}

/** ["multisig", multisigPda, index, "authority"] */
export function getAuthorityPda({
  multisigPda,
  index,
  programId = PROGRAM_ID,
}: {
  multisigPda: PublicKey;
  index: number;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      toUtfBytes("multisig"),
      multisigPda.toBytes(),
      toU32Bytes(index),
      toUtfBytes("authority"),
    ],
    programId
  );
}
