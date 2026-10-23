# Changelog

## Squads Multisig 4r 0.1.0 — Unreleased

Squads Multisig 4r ("version 4, revised") is a **new program** at
`SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5`. The Squads v4 program
`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` has no upgrade authority and does not change.

### Compatibility

- **Account and instruction wire format: unchanged.** Account layouts, instruction
  arguments and Anchor discriminators are byte-for-byte identical to Squads v4. 4r adds eight
  instructions (`log_event`, `multisig_create_from` and six `multisig_migrate_*`) and six errors
  (6045 to 6050); see Events and Migration from v4. `tests/compatibility.rs` pins the 36 v4
  instruction entries of the IDL and checks that every discriminator is unique.
  `programs/squads_multisig_program/tests/golden_wire_format.rs` checks this against
  real mainnet data. A v4 decoder reads 4r data when it filters on the 4r program ID.
- **All PDAs are different.** Every PDA (multisig, vault, proposal, transaction,
  spending limit, program config) uses the program ID as a derivation input. A v4
  multisig and its vaults do not exist on 4r. Assets in v4 vaults move only through
  v4 vault transactions (see Migration from v4).
- **Do not mix SDKs.** Use the 4r packages for 4r and the v4 packages for v4.

### Events (new)

- The program emits events as inner instructions: a self-CPI to the new `log_event`
  instruction, signed by the `Multisig` PDA (or the `ProgramConfig` PDA). The instruction data
  carries a borsh `MultisigEvent` enum. Inner-instruction data is not truncated, as program logs
  can be.
- **Events are opt-in.** A client appends the program ID as one extra read-only account at the
  end of the instruction (after any remaining accounts). Without it, the program emits nothing
  and behaves as before. Old clients, including `@sqds/multisig`, keep working.
- Events carry account snapshots (multisig, proposal, transaction, spending limit). If an event
  would be longer than the 10 KiB CPI data limit, its snapshots are left out.
- Helpers: `builders::with_events` and `events::decode_verified_log_event` (Rust core),
  `withEvents`, `decodeVerifiedLogEvent` and `getMultisigEventsFromTransaction`
  (`@sqds/multisig-4r`). The verified decoders check that the multisig (or program config) that
  the event names signed it. The CLI enables events by default.
- Cost: about 2,200 compute units per event with small snapshots; more for large ones.
  Measured: `vault_transaction_execute` uses 15,577 CU without events and 19,999 CU with its
  2 events. The program binary grows from 703,928 to 811,792 bytes.
- In the Rust core, snapshot and content fields are `Cow`: the program borrows the accounts
  (no copy, no heap), and `decode_log_event` returns owned values (`MultisigEvent<'static>`).
- The program has its own entrypoint (default feature `custom-entrypoint`). It answers
  `log_event` before Anchor's dispatch, with the same checks and errors as the Anchor handler:
  550 instead of 779 compute units in each `log_event` call. All other instructions go to
  Anchor's `entry` unchanged.
- Heap: events add little heap use, because they do not copy the accounts. At the default 32 KiB
  heap, `multisig_add_member` works up to about 244 members with or without events, and
  `vault_transaction_create_from_buffer` with events works with a 5 KB buffer. Larger multisigs and
  buffers need a heap frame (`ComputeBudgetProgram.requestHeapFrame`, up to 256 KiB) also without
  events.
- An emitting instruction uses one more CPI level and more compute units. A program that calls
  4r at the maximum CPI depth must not add the event account.
- `log_event` runs only as a CPI from the program itself. A vault transaction that calls it fails
  with `ProtectedInstruction` (6045).

### Migration from v4 (new)

- `multisig_create_from` creates the 4r **successor** of a v4 multisig: the multisig PDA with
  `create_key` = the v4 multisig address. A v4 vault signs it through a v4 vault transaction, so
  the v4 members approve it. v4 never signs as a multisig PDA, so nobody can create the successor
  first with `multisig_create_v2`. The successor copies the v4 members, permissions, threshold,
  time lock, config authority and rent collector. The v4 vault pays the rent and the creation fee.
  The fee is read at execution, so the members approve a cap (`max_creation_fee`); a larger fee
  fails with `MigrationCreationFeeTooHigh` (6050).
- Six instructions move the assets of a v4 vault to the successor vault with the same index, one
  asset class each, so one call reaches only the programs of its class:
  `multisig_migrate_sol`, `multisig_migrate_tokens` (whole balance, Token or Token-2022, optional
  close of the source), `multisig_migrate_token_authorities` (token account owner, mint and freeze,
  the Token-2022 extension authorities and the metadata update authority; `TokenAuthorityKind`),
  `multisig_migrate_stakes` (staker, withdrawer and lockup custodian), `multisig_migrate_vote_accounts` (withdrawer)
  and `multisig_migrate_programs` (loader-v3 upgrade authority). The program calculates the
  destination. The successor must have the same governance as the v4 multisig at execution
  (members, permissions, threshold, time lock, config authority), else `MigrationGovernanceMismatch`.
  Loader-v4 programs and durable nonce accounts are not supported (section 11.6 of
  `V4.5_REVISED.md`).
- An item with nothing to move (zero balance, closed account, missing extension, frozen account,
  authority already moved, stake lockup) is skipped, not an error, so one item cannot block a v4
  batch. The new `Migration` event (tag 9) records the class (`scope`) and each outcome.
- New errors: `MigrationGovernanceMismatch` (6046), `MigrationInvalidVaultHint` (6047),
  `MigrationInvalidAssetAccounts` (6048), `MigrationInvalidAmount` (6049),
  `MigrationCreationFeeTooHigh` (6050).
- Helpers: `migration::{get_successor_pda, mirror, check_same_governance, TokenItem}` and
  `builders::{MultisigCreateFrom, MigrationAccounts, MultisigMigrateSol, MultisigMigrateTokens,
  MultisigMigrateTokenAuthorities, MultisigMigrateStakes, MultisigMigrateVoteAccounts,
  MultisigMigratePrograms}` (Rust core); `findSuccessorPda` and `getMigrateSolInstruction`,
  `getMigrateTokensInstruction`, `getMigrateTokenAuthoritiesInstruction`,
  `getMigrateStakesInstruction`, `getMigrateVoteAccountsInstruction`, `getMigrateProgramsInstruction`
  (`@sqds/multisig-4r`).
- **Planner.** `planV4Migration` (`@sqds/multisig-4r`) and `planner::plan_v4_migration`
  (`squads-multisig-4r`, feature `fetch`) find the assets and authorities of a v4 vault (including
  vote accounts, Token-2022 extension authorities, and the close authority of token accounts of
  any owner), group them by class (SOL last), split each
  group into batch items within the message size, account and worst-case instruction-trace limits,
  and build the v4 proposals and execute instructions. Both planners give the same batch items;
  their tests share the sizes. A delegate role of the vault cannot move; the plan gives a note.
- **Lookup tables.** Hand-built address lookup table instructions (`lookupTables.ts`,
  `lookup_tables.rs`; the CLI test checks them against `solana-address-lookup-table-interface`).
  `withMigrationLookupTables` / `with_migration_lookup_tables` re-plan with the tables: fewer, larger
  batch items. The tables are not frozen, so their rent comes back after deactivate and close.
- **CLI.** New commands `migrate-plan` (read only), `migrate-propose` (creates the v4 vault
  transaction and batch; `--lookup-tables` creates the tables first), `migrate-execute` (runs an
  approved v4 vault transaction or the remaining batch entries in order, with the tables of the
  batch messages) and `migrate-lookup-tables` (`--deactivate` or `--close`). `--yes` skips the
  confirmation.
- Measured through a v4 batch (whole execute transaction, with events): about 79,000 compute
  units for one token with a new ATA, 43,700 for one vote account, 54,200 for one program, 39,000
  for SOL. The program binary grows from 811,792 to 940,928 bytes.
- Tests: `tests/migration.rs` and `tests/compatibility.rs` (core), `sdk/rs/tests/planner.rs`, and
  `sdk/multisig-4r/test/integration/v4-migration.test.ts`, which runs the mainnet v4 program from
  `tests/fixtures/v4-mainnet` (one test for each class, Token-2022 authorities, the guards, the
  attempts to create the successor with `multisig_create_v2`, and the planner with lookup
  tables, a close authority and a delegate). `tla/Migration.tla` models the lineage, governance and creation fee rules;
  `tla/MigrationStake.tla` models the stake roles and the order of their CPIs.
- **Property tests** (`proptest`, dev dependency only) of the account readers in the program and
  both planners: no panic on any bytes, and the same values as the official stake, vote,
  loader-v3 and Token-2022 crates encode. The TS readers check a shared fixture
  (`sdk/rs/tests/fixtures/account_readers.json`; `UPDATE_FIXTURES=1` rewrites it). A new CI
  workflow (`proptest.yaml`) runs them with 100k cases on pull requests and 1M cases every night,
  and uploads the regression seeds when a property fails.
- **Kani proofs** (`src/migration/proofs.rs`, Kani 0.68.0, new CI job): `map_vault`, `mirror`,
  `check_same_governance` and `v4_member_count` hold for all inputs within stated bounds; for
  example, the governance check passes if and only if the governance is equal. The proofs compile
  only under `cargo kani`; the program binary and the IDL do not change. The options are in
  `[workspace.metadata.kani]` of the root `Cargo.toml`.

### Behavior changes

- **Fewer program logs.** There is no `Instruction: <Name>` log line (Anchor `no-log-ix-name`),
  and the v4 log lines for indexing are removed: `transaction index`, `batch index`, `batch size`,
  `Creation fee`, and the `spending_limit_use` SPL line with four base58 addresses. Events replace
  them. Each instruction uses about 100 fewer compute units; the SPL path of `spending_limit_use`
  uses 61% fewer (48,846 to 19,031 CU in the local test).
- **`spending_limit_use`: SPL transfer to the vault's own token account now fails.**
  Anchor 1.x rejects duplicate mutable accounts. When `destination` is the vault and
  `vault_token_account == destination_token_account`, the instruction fails with Anchor
  error 2040 (`ConstraintDuplicateMutableAccount`). In v4 this transfer succeeded, moved
  no tokens, and reduced `remaining_amount`. The SOL path does not change: a SOL transfer
  from the vault to itself still succeeds and still reduces `remaining_amount`.
- **Account growth sets new bytes to zero.** `Multisig` and `Proposal` reallocation now
  uses `AccountInfo::resize`, which zero-fills new space. The stored account data is the
  same, because the program writes the full account after it grows. The cost is a few
  compute units per reallocation.
- **`security.txt`** names the program "Squads Multisig 4r Program" and states that the 4r
  audit is pending.

### Packages

| Package | Version | Replaces (frozen, v4) |
|---|---|---|
| `squads-multisig-4r-program` (crates.io) | 0.1.0 | `squads-multisig-program` 2.0.x |
| `squads-multisig-4r` (crates.io) | 0.1.0 | `squads-multisig` 2.1.x |
| `@sqds/multisig-4r` (npm) | 0.1.0 | `@sqds/multisig` 2.1.x |
| `squads-multisig-4r-cli` (crates.io) | 0.1.0 | `squads-multisig-cli` 0.1.x |

- Program crate features for libraries: use the core (`default-features = false`) or `cpi`.
  Do not use `no-entrypoint` together with the default features: `custom-entrypoint` then still
  adds the program entrypoint to your crate.
- `squads-multisig-4r-program` has a **core** that is always compiled and needs no Anchor:
  account types, instruction args, `TransactionMessage` types, permissions, errors, seeds, PDAs,
  discriminators, owner-checked account decoding, builders for every live instruction and the
  vault message compiler. It depends only on `borsh`, `solana-address`, `solana-instruction` and
  `thiserror`, and it builds for SBF. The Anchor program is the default `program` feature. Clients
  and other programs use `default-features = false`.
- The core has the event types and their encoder and decoder (`events`).
- The core exports `LEGACY_V4_PROGRAM_ID` (`SQDS4…`). With it as `program_id`, the core builders,
  PDA helpers and decoders work with the frozen v4 program, which has the same layout.
- `squads-multisig-4r` re-exports that core and adds async owner-checked fetches (`rpc`, feature
  `fetch`). It does not depend on Anchor.
- `@sqds/multisig-4r` is generated with Codama for `@solana/kit`. It replaces the
  web3.js v1 / Solita API of `@sqds/multisig`.
- The IDL is `idl/squads_multisig_4r_program.json` (Anchor IDL spec 0.1.0) and is published
  through Program Metadata. Programs on other Anchor versions can use `declare_program!`.
- The 0.x versions are for the audit and formal verification period; 1.0.0 follows at the
  mainnet release.

### Behavior changes in the program crate

- `TryFrom<TransactionMessage> for VaultTransactionMessage` now returns `MultisigError` (core)
  instead of an Anchor `Error`. The program still fails with `InvalidTransactionMessage` (6006);
  only the "Error thrown at" source location in the log changes.

### Toolchain

- Anchor 1.2.1 (`solana-v4` feature), Agave 4.3.2 crates, Rust 1.97.1 or later (Agave's minimum), platform-tools v1.57.
- The program is built for **SBPF v3** only. Compared with SBPF v0, the binary is 6% smaller
  and uses 0.1–0.6% fewer compute units per instruction.
- Verifiable builds: `solana-verify build --base-image solanafoundation/solana-verifiable-build:4.3.0 --arch v3`.
- **No unstable Rust features in the program binary.** The platform-tools `rustc` is a `-dev`
  build, so it accepts `#![feature]`. Before this change, `thiserror` found this and compiled with
  `error_generic_member_access`. `.cargo/config.toml` now sets `-Zallow-features=` for
  `target_os = "solana"` builds: the probe fails, and any `#![feature]` in the dependency graph
  stops the SBF build. The default build is byte-identical to the build before this change.
- The repository uses Bun 1.3 as its package manager (`bun install`, `bun run test`). Yarn and Turbo
  are removed. `sdk/multisig-4r` is a standalone npm package.

### Fixes

- `squads-multisig-4r-cli initiate-program-upgrade` now encodes the upgrade as a Squads
  `TransactionMessage`. The v4 CLI sent a Solana `v0::Message`, which the program cannot
  decode, so the command always failed.
- The custom heap allocator is now enabled only for on-chain (`target_os = "solana"`) builds.
  Host builds of the program crate without `no-entrypoint` (for example `anchor idl build`)
  crashed because the allocator wrote to the fixed SBF heap address.
