import { PublicKey } from "@solana/web3.js";
import { BN } from "bn.js";
import { PROGRAM_ID } from "./generated";

export function deriveProposalPda({
  multisigPda,
  index,
  programId,
}: {
  multisigPda: PublicKey;
  index: number;
  programId?: PublicKey;
}): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("proposal"),
      multisigPda.toBuffer(),
      Buffer.from(new Uint8Array(new BN(index).toArray("le", 8))),
    ],
    programId ?? PROGRAM_ID
  );
} 