# Squads Multisig 4r

<img width="2500" alt="Frame 13" src="https://user-images.githubusercontent.com/81624955/182874414-98d63f58-450d-4520-a440-4bfda8f5329f.png">

Squads Multisig 4r ("version 4, revised") is a new deployment of the Squads Protocol v4 program,
built on current Solana and Anchor releases. It keeps the v4 features (time locks, spending limits,
roles, sub-accounts, multiple-party payments, address lookup tables) and the v4 wire format.

The Squads v4 program (`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`) has no upgrade authority.
It does not change, and its SDKs receive security and runtime fixes only, from the `legacy/sqds4` branch.

## Content

This repository contains:

- The Squads Multisig 4r program (`programs/squads_multisig_program`).
- The `@sqds/multisig-4r` TypeScript SDK, built on `@solana/kit` (`sdk/multisig-4r`).
- The `squads-multisig-4r` Rust client (`sdk/rs`), generated with [Codama](https://github.com/codama-idl/codama).
- The `squads-multisig-4r-cli` command line interface (`cli`).
- The frozen v4 TypeScript SDK `@sqds/multisig` (`sdk/multisig`), used here as a v4-compatibility test harness.

See [CHANGELOG.md](./CHANGELOG.md) for compatibility notes and behavior changes from v4.

## Program (Smart contract) Addresses

| Program | Address | Status |
|---|---|---|
| Squads Multisig 4r | `SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5` | Not yet deployed |
| Squads Multisig 4r (staging) | `STAG3xkFMyVK3sRtQhipsKuLpRGbgospDpVdNyJqDpS` | Staging |
| Squads v4 (Solana Mainnet-beta, Devnet) | `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` | Frozen |
| Squads v4 (Eclipse Mainnet) | `eSQDSMLf3qxwHVHeTr9amVAGmZbRLY2rFdSURandt6f` | v4 |

4r and v4 have different program IDs, so every PDA (multisig, vault, proposal, transaction) is
different. Assets in v4 vaults move only through the v4 program.

Solana deployments can be verified using the [Ellipsis Labs verifiable build](https://github.com/Ellipsis-Labs/solana-verifiable-build) tool.

## Responsibility

By interacting with this program, users acknowledge and accept full personal responsibility for any consequences, regardless of their nature. This includes both potential risks inherent to the smart contract, also referred to as program, as well as any losses resulting from user errors or misjudgment.

By using a multisig, it is important to acknowledge certain concepts. Here are some that could be misunderstood by users:

- Loss of Private Keys: If a participant loses their private key, the multisig may not be able to execute transactions if a threshold number of signatures is required.
- Single Point of Failure with Keys: If all keys are stored in the same location or device, a single breach can compromise the multisig.
- Forgetting the Threshold: Misremembering the number of signatures required can result in a deadlock, where funds cannot be accessed.
- No Succession Planning: If keyholders become unavailable (e.g., due to accident, death), without a plan for transition, funds may be locked forever.
- Transfer of funds to wrong address: Funds should always be sent to the multisig vault account, and not the multisig account address. Due to the design of the Squads Protocol program, funds deposited to the multisig account may not be recoverable.
- If the config_authority of a multisig is compromised, an attacker can change multisig settings, potentially reducing the required threshold for transaction execution or instantly being able to remove and add new members.
- If the underlying SVM compatible blockchain undergoes a fork and a user had sent funds to the orphaned chain, the state of the blockchain may not interpret the owner of funds to be original one.
- Users might inadvertently set long or permanent time-locks in their multisig, preventing access to their funds for that period of time.
- Multisig participants might not have enough of the native token of the underlying SVM blockchain to pay for transaction and state fees.

## Developers

| Package | Registry | Program |
|---|---|---|
| `@sqds/multisig-4r` | npm | 4r |
| `squads-multisig-4r` | crates.io | 4r (off-chain client, CPI builders) |
| `squads-multisig-4r-program` | crates.io | 4r (program crate with `cpi` feature, Anchor 1.x) |
| `squads-multisig-4r-cli` | crates.io | 4r |
| `@sqds/multisig` 2.1.x, `squads-multisig` 2.1.x, `squads-multisig-program` 2.0.x | npm / crates.io | v4 (frozen) |

Programs on another Anchor version can generate a CPI client from `idl/squads_multisig_4r_program.json`
with Anchor's `declare_program!`.

## Compiling and testing

Requirements:

- Rust: `rust-toolchain.toml` selects the version (1.98.1) and components automatically.
- Agave (Solana) 4.3.2: `sh -c "$(curl -sSfL https://release.anza.xyz/v4.3.2/install)"`
- Anchor CLI 1.2.1: `cargo install anchor-cli --version 1.2.1 --locked`
- Node.js 22 and Bun 1.3 (the repository package manager; the integration tests run on Node.js).

Build the program for SBPF v3 (the only supported target):

```
anchor build --arch v3
```

Run the tests:

```
cargo test --workspace                 # program, Rust client and CLI unit tests, golden wire-format tests
bun install && bun run test            # TypeScript integration tests on solana-test-validator
cd sdk/multisig-4r && npm ci && npm test  # @sqds/multisig-4r unit tests
```

`bun run test` builds with the `testing` feature (test program ID `GyhGAqjokLwF9UXdQ2dR5Zwiup242j4mX4J1tSMKyAmD`)
and starts `solana-test-validator` (`anchor test --validator legacy`).

Regenerate the IDL and the Codama clients after a program interface change:

```
anchor idl build -p squads_multisig_4r_program -o idl/squads_multisig_4r_program.json
cd sdk/multisig-4r && npm run generate
```

### Verifying the code

Build the program deterministically with [solana-verify](https://crates.io/crates/solana-verify):

```
cargo install solana-verify --version 0.5.2 --locked
solana-verify build --base-image solanafoundation/solana-verifiable-build:4.3.0 --arch v3 --library-name squads_multisig_4r_program
solana-verify get-executable-hash target/deploy/squads_multisig_4r_program.so
```

Get the hash of the deployed program and compare:

```
solana-verify get-program-hash -u <cluster url> SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5
```

If the two hashes match, the repository code matches the deployed program. Deploy only binaries
built this way.

## Usage

Instructions on how to interact with the Squads v4 program (and, with the 4r program ID, with 4r) can be found in [the Squads developer portal](https://docs.squads.so/main/v/development/development/overview).

## Security

The Squads Protocol v4 code base has undergone various independent audits by leading cybersecurity and blockchain smart contract auditing firms.

Below is a list of audit reports pertaining to the v4 program. Each entry enumerates the responsible auditor and is accompanied by a corresponding GitHub link for review:

- OtterSec: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/ottersec_squads_v4_audit.pdf)
- OtterSec 2024: [View full
  report](https://github.com/Squads-Protocol/v4/blob/main/audits/ottersec_squads_v4_audit_2024.pdf)
- Ottersec 2024 Final: [View full
  report](https://github.com/Squads-Protocol/v4/blob/main/audits/ottersec_squads_v4_audit_2024_final.pdf)
- Neodyme: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/neodyme_squads_v4_report.pdf)
- Neodyme 2024: [View full
  report](https://github.com/Squads-Protocol/v4/blob/main/audits/neodyme_squads_v4_report_2024.pdf)
- Neodyme 2024 Final: [View full
  report](https://github.com/Squads-Protocol/v4/blob/main/audits/neodyme_squads_v4_report_2024_final.pdf)
- Certora + Formal verification: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/certora_squads_v4_security_report_and_formal_verification.pdf)
- Certora Audit + Formal Verification (December 2023): [View full
  report](https://github.com/Squads-Protocol/v4/blob/main/audits/certora_squads_v4_security_report_and_formal_verification_2024.pdf)
- Certora Audit + Formal Verification 2024 Final: [View full
  report](https://github.com/Squads-Protocol/v4/blob/main/audits/certora_squads_v4_security_report_and_formal_verification_2024_final.pdf)
- Trail of Bits: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/trail_of_bits_squads_v4_security_audit.pdf)

The final and fully audited commit hash of the v4 program is `64af7330413d5c85cbbccfd8c27a05d45b6e666f`.

Squads Multisig 4r changes dependencies, toolchain and SBPF target of that code base. Its audit and formal verification are pending.

## License

The primary license for Squads Protocol v4 is the AGPL-3.0 license, see [LICENSE](./LICENSE). The following exceptions are licensed separately as follows:

- The file <https://github.com/Squads-Protocol/v4/blob/main/programs/squads_multisig_program/src/utils/system.rs> is derived from code released under the [Apache 2.0 license](https://github.com/coral-xyz/anchor/blob/master/LICENSE) at <https://github.com/coral-xyz/anchor/blob/714d5248636493a3d1db1481f16052836ee59e94/lang/syn/src/codegen/accounts/constraints.rs#L1126-L1179>.
- The file <https://github.com/Squads-Protocol/v4/blob/main/programs/squads_multisig_program/src/utils/small_vec.rs> is derived from code released under both the [Apache 2.0 license](https://github.com/near/borsh-rs/blob/master/LICENSE-APACHE) and the [MIT license](https://github.com/near/borsh-rs/blob/master/LICENSE-MIT) at <https://github.com/near/borsh-rs/blob/master/borsh/src/de/hint.rs> and <https://github.com/near/borsh-rs/blob/master/borsh/src/ser/mod.rs>.

To the extent that each such file incorporates code from another source, such code is licensed under its respective open source license as provided above, and the original open source code is copyrighted by its respective owner as provided above.
