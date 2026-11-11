// Generates the TypeScript client (src/generated) for the Squads Multisig 4r program from
// idl/squads_multisig_4r_program.json. The Rust client re-exports the program crate's core.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addPdasVisitor,
  arrayTypeNode,
  bottomUpTransformerVisitor,
  bytesTypeNode,
  constantPdaSeedNodeFromString,
  createFromRoot,
  definedTypeNode,
  flattenInstructionDataArgumentsVisitor,
  numberTypeNode,
  pdaNode,
  prefixedCountNode,
  programNode,
  publicKeyTypeNode,
  rootNode,
  sizePrefixTypeNode,
  structFieldTypeNode,
  structTypeNode,
  definedTypeLinkNode,
  unwrapDefinedTypesVisitor,
  updateProgramsVisitor,
  variablePdaSeedNode,
} from "codama";
import { rootNodeFromAnchor } from "@codama/nodes-from-anchor";
import { renderVisitor as renderJs } from "@codama/renderers-js";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const idl = JSON.parse(readFileSync(join(repo, "idl", "squads_multisig_4r_program.json"), "utf8"));
const PROGRAM = "squadsMultisig4r";

const u8 = () => numberTypeNode("u8");
const u8Prefixed = (item) => arrayTypeNode(item, prefixedCountNode(u8()));
const field = (name, type) => structFieldTypeNode({ name, type });
const seed = (value) => constantPdaSeedNodeFromString("utf8", value);

// The SmallVec-based message types are excluded from the IDL; they define the
// `transaction_message` bytes of vault_transaction_create and batch_add_transaction.
const transactionMessageTypes = [
  definedTypeNode({
    name: "compiledInstruction",
    type: structTypeNode([
      field("programIdIndex", u8()),
      field("accountIndexes", u8Prefixed(u8())),
      field("data", sizePrefixTypeNode(bytesTypeNode(), numberTypeNode("u16"))),
    ]),
  }),
  definedTypeNode({
    name: "messageAddressTableLookup",
    type: structTypeNode([
      field("accountKey", publicKeyTypeNode()),
      field("writableIndexes", u8Prefixed(u8())),
      field("readonlyIndexes", u8Prefixed(u8())),
    ]),
  }),
  definedTypeNode({
    name: "transactionMessage",
    type: structTypeNode([
      field("numSigners", u8()),
      field("numWritableSigners", u8()),
      field("numWritableNonSigners", u8()),
      field("accountKeys", u8Prefixed(publicKeyTypeNode())),
      field("instructions", u8Prefixed(definedTypeLinkNode("compiledInstruction"))),
      field("addressTableLookups", u8Prefixed(definedTypeLinkNode("messageAddressTableLookup"))),
    ]),
  }),
];

// Seeds mirror programs/squads_multisig_program/src/state/seeds.rs.
const pdas = [
  pdaNode({ name: "vault", seeds: [seed("multisig"), variablePdaSeedNode("multisig", publicKeyTypeNode()), seed("vault"), variablePdaSeedNode("index", u8())] }),
  pdaNode({ name: "transaction", seeds: [seed("multisig"), variablePdaSeedNode("multisig", publicKeyTypeNode()), seed("transaction"), variablePdaSeedNode("index", numberTypeNode("u64"))] }),
  pdaNode({ name: "proposal", seeds: [seed("multisig"), variablePdaSeedNode("multisig", publicKeyTypeNode()), seed("transaction"), variablePdaSeedNode("transactionIndex", numberTypeNode("u64")), seed("proposal")] }),
  pdaNode({ name: "batchTransaction", seeds: [seed("multisig"), variablePdaSeedNode("multisig", publicKeyTypeNode()), seed("transaction"), variablePdaSeedNode("batchIndex", numberTypeNode("u64")), seed("batch_transaction"), variablePdaSeedNode("transactionIndex", numberTypeNode("u32"))] }),
  pdaNode({ name: "ephemeralSigner", seeds: [seed("multisig"), variablePdaSeedNode("transaction", publicKeyTypeNode()), seed("ephemeral_signer"), variablePdaSeedNode("index", u8())] }),
  pdaNode({ name: "spendingLimit", seeds: [seed("multisig"), variablePdaSeedNode("multisig", publicKeyTypeNode()), seed("spending_limit"), variablePdaSeedNode("createKey", publicKeyTypeNode())] }),
  pdaNode({ name: "transactionBuffer", seeds: [seed("multisig"), variablePdaSeedNode("multisig", publicKeyTypeNode()), seed("transaction_buffer"), variablePdaSeedNode("creator", publicKeyTypeNode()), variablePdaSeedNode("bufferIndex", u8())] }),
];

// The shared accounts of the `multisig_migrate_*` instructions read `vault_index` (v4) or
// `authority_index` (v3), the first field of each instruction's `args`. Name the seed by its path
// in `args` so that Codama can resolve it. The v3 successor vault (`authority_index - 1`) has no
// IDL seeds, so callers pass it.
const withArgSeedPaths = (accounts) =>
  accounts.map((account) =>
    account.accounts
      ? { ...account, accounts: withArgSeedPaths(account.accounts) }
      : account.pda
        ? {
            ...account,
            pda: {
              ...account.pda,
              seeds: account.pda.seeds.map((seed) =>
                seed.kind === "arg" && ["vault_index", "authority_index"].includes(seed.path)
                  ? { ...seed, path: `args.${seed.path}` }
                  : seed,
              ),
            },
          }
        : account,
  );
idl.instructions = idl.instructions.map((ix) => ({ ...ix, accounts: withArgSeedPaths(ix.accounts) }));

const anchorRoot = rootNodeFromAnchor(idl);
const argsTypes = anchorRoot.program.definedTypes.map((t) => t.name).filter((name) => name.endsWith("Args"));
const root = rootNode(
  programNode({ ...anchorRoot.program, definedTypes: [...anchorRoot.program.definedTypes, ...transactionMessageTypes] }),
  anchorRoot.additionalPrograms,
);

const codama = createFromRoot(root);
codama.update(updateProgramsVisitor({ [anchorRoot.program.name]: { name: PROGRAM } }));
codama.update(addPdasVisitor({ [PROGRAM]: pdas }));
// The IDL has two multisig PDAs with the same seeds: `create_key` (multisig_create_v2) and
// `source_multisig` (the v4 successor). Keep `findMultisigPda({ createKey })` and name the
// other one `findSuccessorPda({ sourceMultisig })`.
const renamePda = (from, to) =>
  codama.update(
    bottomUpTransformerVisitor(
      ["pdaNode", "pdaLinkNode"].map((kind) => ({
        select: `[${kind}]${from}`,
        transform: (node) => ({ ...node, name: to }),
      })),
    ),
  );
renamePda("multisig", "successor");
renamePda("multisigCreateV2Multisig", "multisig");
const seedNames = (name) =>
  codama
    .getRoot()
    .program.pdas.find((pda) => pda.name === name)
    ?.seeds.filter((seed) => seed.kind === "variablePdaSeedNode")
    .map((seed) => seed.name)
    .join();
if (seedNames("multisig") !== "createKey" || seedNames("successor") !== "sourceMultisig") {
  throw new Error("unexpected multisig PDAs from the IDL; update the renames in generate.mjs");
}
// Inline the `*Args` structs and lift their fields to top-level instruction arguments.
// The encoded bytes do not change: borsh writes struct fields inline.
codama.update(unwrapDefinedTypesVisitor(argsTypes));
codama.update(flattenInstructionDataArgumentsVisitor());

await codama.accept(
  renderJs(join(here, ".."), {
    generatedFolder: "src/generated",
    deleteFolderBeforeRendering: true,
    syncPackageJson: false,
    formatCode: true,
    kitImportStrategy: "rootOnly",
  }),
);
console.log(`generated ${PROGRAM}: ${argsTypes.length} args structs flattened, ${pdas.length} PDAs added`);
