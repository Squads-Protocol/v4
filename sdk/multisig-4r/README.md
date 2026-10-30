# @sqds/multisig-4r

TypeScript SDK for the Squads Multisig 4r program (`SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5`),
built on [`@solana/kit`](https://github.com/anza-xyz/kit).

For the frozen Squads v4 program (`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`) use `@sqds/multisig` 2.1.x.
The two programs have the same account and instruction layout, but different program IDs and PDAs.

## Install

```sh
npm install @sqds/multisig-4r @solana/kit
```

## Contents

- **Generated** (`src/generated`, [Codama](https://github.com/codama-idl/codama)): instruction builders
  (`get*Instruction`, `get*InstructionAsync` with PDA defaults), account codecs, PDA finders
  (`find*Pda`), types, errors, and instruction/account parsers.
- **`compileTransactionMessage` / `getTransactionMessageBytes`**: compile instructions into the
  vault `TransactionMessage` bytes for `vaultTransactionCreate` and `batchAddTransaction`, with
  address lookup table support. The output is byte-identical to the Rust client.
- **`getVaultTransactionExecuteInstructionWithAccounts` / `getAccountsForExecute`**: add the
  remaining accounts that `vaultTransactionExecute` and `batchExecuteTransaction` need.
- **`fetch*Checked` / `decodeChecked`**: fetch and decode accounts after checking the owner and the
  discriminator. The generated `fetch*` functions check neither, so prefer the checked variants.
- **Migration from v4** (`multisigCreateFrom` and one `multisigMigrate*` instruction for each asset
  class): `findSuccessorPda`, `getMigrateSolInstruction`, `getMigrateTokensInstruction`,
  `getMigrateTokenAuthoritiesInstruction`, `getMigrateStakesInstruction`,
  `getMigrateVoteAccountsInstruction` and `getMigrateProgramsInstruction` (they add the item
  accounts), and the planner `planV4Migration` with `withMigrationLookupTables`,
  `getV4MigrationProposal`, `getV4VaultTransactionExecuteInstruction` and
  `getV4BatchExecuteInstructions`. See section 11 of `V4.5_REVISED.md`.
- **Migration from v3** (`multisigCreateFromV3` and one `multisigMigrateV3*` instruction for each
  asset class): the same `getMigrate*Instruction` builders with a source of `lineage: "v3"` and an
  `authorityIndex` (1 to 256; authority `N` moves to vault `N - 1`), the planner `planV3Migration`
  (it throws `V3DelegateMembersError` for v3 roles delegate members), `getV3MigrationProposal` and
  `getV3ExecuteInstructions`, and a v3 client (`v3.ts`: PDAs, account decoders, v3 instructions).
  See section 11.7 of `V4.5_REVISED.md`.
- **Address lookup tables** (no extra package): `getCreateLookupTablesTransactions`,
  `getExtendLookupTableInstruction`, `getDeactivateLookupTableInstruction`,
  `getCloseLookupTableInstruction` and `getLookupTableAddresses`.

Every builder and finder accepts `{ programAddress }` for localnet or staging deployments.

## Example

```ts
import { getProposalApproveInstruction, findProposalPda, fetchMultisigChecked } from "@sqds/multisig-4r";

const { data: multisigAccount } = await fetchMultisigChecked(rpc, multisig);
const [proposal] = await findProposalPda({ multisig, transactionIndex: multisigAccount.transactionIndex });
const approve = getProposalApproveInstruction({ multisig, member, proposal, memo: null });
```

`test/integration/vault-transaction-flow.test.ts` shows a complete flow: create a multisig, create,
approve and execute a vault transaction.

## Development

```sh
npm ci
npm run generate          # regenerate src/generated and ../rs/src/generated from ../../idl
npm run typecheck
npm test                  # unit tests, including the golden mainnet wire-format fixtures
npm run test:integration  # needs solana-test-validator with the testing build of the program
```
