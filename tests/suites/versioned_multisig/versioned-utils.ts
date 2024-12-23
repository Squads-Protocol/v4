import {
  Keypair
} from "@solana/web3.js";
import fs from "fs";
import { readFileSync } from "fs";
import path from "path";

function loadKeypairFromFile(filename: string): Keypair {
  
  const secret = JSON.parse(fs.readFileSync(filename).toString()) as number[];
  const secretKey = Uint8Array.from(secret);
  return Keypair.fromSecretKey(secretKey);
}
export function getVersionedTestProgramId() {
  const programKeypair = Keypair.fromSecretKey(
    Buffer.from(
      JSON.parse(
        readFileSync(
          path.join(
            __dirname,
            "../../../target/deploy/versioned_squads_multisig_program-keypair.json"
          ),
          "utf-8"
        )
      )
    )
  );

  return programKeypair.publicKey;
}


export function getVersionedTestProgramConfigAuthority() {
    return loadKeypairFromFile("~/workplace/squads-v4/tests/suites/versioned_multisig/versioned-keys/program-config-auth.json");
  }
  
  export function getVersionedTestProgramTreasury() {
    return loadKeypairFromFile("~/workplace/squads-v4/tests/suites/versioned_multisig/versioned-keys/program-treasury.json");
  }