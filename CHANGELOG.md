# Changelog

## Squads Multisig 4r 0.1.0 — Unreleased

Squads Multisig 4r ("version 4, revised") is a **new program** at
`SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5`. The Squads v4 program
`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` has no upgrade authority and does not change.

### Compatibility

- **Account and instruction wire format: unchanged.** Account layouts, instruction
  arguments and Anchor discriminators are byte-for-byte identical to Squads v4.
  `programs/squads_multisig_program/tests/golden_wire_format.rs` checks this against
  real mainnet data. A v4 decoder reads 4r data when it filters on the 4r program ID.
- **All PDAs are different.** Every PDA (multisig, vault, proposal, transaction,
  spending limit, program config) uses the program ID as a derivation input. A v4
  multisig and its vaults do not exist on 4r. Assets in v4 vaults move only through
  the v4 program.
- **Do not mix SDKs.** Use the 4r packages for 4r and the v4 packages for v4.

### Behavior changes

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

- `squads-multisig-4r` is generated with Codama and no longer depends on the program crate or
  on Anchor. Account fetch helpers in `rpc` check the owner and the discriminator.
- `@sqds/multisig-4r` is generated with Codama for `@solana/kit`. It replaces the
  web3.js v1 / Solita API of `@sqds/multisig`.
- The IDL is `idl/squads_multisig_4r_program.json` (Anchor IDL spec 0.1.0) and is published
  through Program Metadata. Programs on other Anchor versions can use `declare_program!`.
- The 0.x versions are for the audit and formal verification period; 1.0.0 follows at the
  mainnet release.

### Toolchain

- Anchor 1.2.1 (`solana-v4` feature), Agave 4.3.2 crates, Rust 1.97.1 or later (Agave's minimum), platform-tools v1.57.
- The program is built for **SBPF v3** only. Compared with SBPF v0, the binary is 6% smaller
  and uses 0.1–0.6% fewer compute units per instruction.
- Verifiable builds: `solana-verify build --base-image solanafoundation/solana-verifiable-build:4.3.0 --arch v3`.

### Fixes

- `squads-multisig-4r-cli initiate-program-upgrade` now encodes the upgrade as a Squads
  `TransactionMessage`. The v4 CLI sent a Solana `v0::Message`, which the program cannot
  decode, so the command always failed.
- The custom heap allocator is now enabled only for on-chain (`target_os = "solana"`) builds.
  Host builds of the program crate without `no-entrypoint` (for example `anchor idl build`)
  crashed because the allocator wrote to the fixed SBF heap address.
