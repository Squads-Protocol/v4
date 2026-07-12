import { Keypair } from "@solana/web3.js";
import { instructions } from "../..";
import { PROGRAM_ID, ProgramConfig } from "../../generated";
import { getMultisigPda, getProgramConfigPda } from "../../pda";
import { CreateMultisigActionArgs, CreateMultisigResult } from "./types";

export async function createMultisigCore(
  args: CreateMultisigActionArgs,
  createKey: Keypair
): Promise<CreateMultisigResult> {
  const {
    connection,
    creator,
    threshold,
    members,
    timeLock = 0,
    configAuthority,
    rentCollector,
    programId = PROGRAM_ID,
  } = args;

  const [multisigPda] = getMultisigPda({
    createKey: createKey.publicKey,
    programId,
  });
  const programConfigPda = getProgramConfigPda({ programId })[0];

  const programConfig = await ProgramConfig.fromAccountAddress(
    connection,
    programConfigPda
  );

  const ix = instructions.multisigCreateV2({
    creator,
    threshold,
    members,
    multisigPda: multisigPda,
    treasury: programConfig.treasury,
    createKey: createKey.publicKey,
    timeLock: timeLock ?? 0,
    rentCollector: rentCollector ?? null,
    configAuthority: configAuthority ?? null,
    programId: programId ?? PROGRAM_ID,
  });

  return {
    instructions: [ix],
    multisigKey: multisigPda,
  };
}
