const { Keypair } = require("@solana/web3.js");
const { readFileSync } = require("fs");
const path = require("path");

const PROGRAM_NAME = "squads_multisig_program";

const programDir = path.join(__dirname, "..", "..", "programs", PROGRAM_NAME);
const idlDir = path.join(__dirname, "idl");
const sdkDir = path.join(__dirname, "src", "generated");
const binaryInstallDir = path.join(__dirname, "..", "..", ".crates");

const ignoredTypes = new Set([
  // Exclude `Permission` enum from the IDL because it is not correctly represented there.
  "Permission",
  // Exclude the types that use `SmallVec` because anchor doesn't have it in the IDL.
  "TransactionMessage",
  "CompiledInstruction",
  "MessageAddressTableLookup",
]);

function loadKeypairFromFile(relativePath) {
  try {
    const absolutePath = path.join(__dirname, relativePath);
    return Keypair.fromSecretKey(
      Buffer.from(JSON.parse(readFileSync(absolutePath, "utf-8")))
    );
  } catch (error) {
    console.error("Error reading keypair from file:", error);
    return {
      publicKey: {
        toBase58: () => "SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf",
      },
    };
  }
}

const keypair = loadKeypairFromFile(
  `../../target/deploy/${PROGRAM_NAME}-keypair.json`
);

const pubkey = keypair.publicKey.toBase58();
console.log("Generating SDK for Program ID:", pubkey);

module.exports = {
  idlGenerator: "anchor",
  programName: PROGRAM_NAME,
  programId: pubkey,
  idlDir,
  sdkDir,
  binaryInstallDir,
  programDir,
  idlHook: (idl) => {
    return {
      ...idl,
      types: idl.types.filter((type) => {
        return !ignoredTypes.has(type.name);
      }),
    };
  },
};
