# Squads Protocol v4

<img width="2500" alt="Frame 13" src="https://user-images.githubusercontent.com/81624955/182874414-98d63f58-450d-4520-a440-4bfda8f5329f.png">

The v4 program is the latest upgrade to Squads Protocol. It expands the capabilities of multisig with several new features, including time locks, spending limits, roles, sub-accounts, multiple-party payments and support for address lookup tables. This program was designed to make it easier for developers to leverage multisig consensus and account abstraction on Solana, facilitating the creation of fintech-like applications and enhancing the secure management of on-chain assets.

## Content

This repository contains:

 - The Squads Protocol v4 program.
 - The `@sqds/multisig` Typescript SDK to interact with the v4 program.
 - The `squads-multisig` crate to interact with the v4 program in Solana programs as well as Rust client applications.

## Program (Smart contract) Addresses

The Squads Protocol v4 program is deployed to:

 - Solana Mainnet-beta: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`
 - Solana Devnet: `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`

Both deployments can be verified using the [Ellipsis Labs verifiable build](https://github.com/Ellipsis-Labs/solana-verifiable-build) tool.

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

You can interact with the Squads program via our SDKs. 

List of SDKs:
- Rust crate: [squads-multisig-program](https://crates.io/crates/squads-multisig-program)
- Typescript SDK: [@sqds/multisig](https://www.npmjs.com/package/@sqds/multisig)

Documentation:
- You can find the SDK documentation including instructions and helper functions here: https://docs.squads.so/main/v/development/development/overview.

## Compiling and testing

You can compile the code with Anchor.
```
anchor build
```
If you do not have the Solana Anchor framework CLI installed, you can do so by following [this guide](https://www.anchor-lang.com/docs/installation).

To deploy the program on a local validator instance for testing or development purposes, you can create a local instance by running this command from the [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools).
```
solana-test-validator
```
To run the tests, first install the node modules for the repository.
```
yarn
```
or 
```
npm install
```
And run these tests with this command:
```
yarn test
```

### Verifying the code
First, compile the programs code from the `Squads-Protocol/v4` Github repository to get its bytecode.
```
git clone https://github.com/Squads-Protocol/v4.git
```

```
anchor build
```
Now, install the [Ellipsis Labs verifiable build](https://crates.io/crates/solana-verify) crate.
```
cargo install solana-verify
```
Get the executable hash of the bytecode from the  Squads program that was compiled.
```
solana-verify get-executable-hash target/deploy/multisig.so
```
Get the hash from the bytecode of the on-chain Squads program you want to verify.
```
solana-verify get-program-hash -u <cluster url> SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf
```
If the hash outputs of those two commands match, the code in the repository matches the on-chain programs code.


## Usage
Instructions on how to interact with the Squads V4 program can be found in [the Squads developer portal](https://docs.squads.so/main/v/development/development/overview).

## Security
Squads Protocol v4 has undergone various independent audits by leading cybersecurity and blockchain smart contract auditing firms.

Below is a list of audit reports pertaining to the v4 program. Each entry enumerates the responsible auditor and is accompanied by a corresponding GitHub link for review:

 - OtterSec: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/ottersec_squads_v4_audit.pdf)
 - OtterSec 2024: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/ottersec_squads_v4_audit_2024.pdf)
 - Neodyme: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/neodyme_squads_v4_report.pdf)
 - Neodyme 2024: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/neodyme_squads_v4_report_2024.pdf)
 - Certora + Formal verification: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/certora_squads_v4_security_report_and_formal_verification.pdf)
 - Certora Audit + Formal Verification (December 2023): [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/certora_squads_v4_security_report_and_formal_verification_2024.pdf)
 - Trail of Bits: [View full report](https://github.com/Squads-Protocol/v4/blob/main/audits/trail_of_bits_squads_v4_security_audit.pdf)


## License

The primary license for Squads Protocol v4 is the Business Source License 1.1 (`BUSL-1.1`), see [LICENSE](./LICENSE). The following exceptions are not licensed under the BULS-1.1, but are licensed separately as follows:

- The file <https://github.com/Squads-Protocol/v4/blob/main/programs/squads_multisig_program/src/utils/system.rs> is derived from code released under the [Apache 2.0 license](https://github.com/coral-xyz/anchor/blob/master/LICENSE) at <https://github.com/coral-xyz/anchor/blob/714d5248636493a3d1db1481f16052836ee59e94/lang/syn/src/codegen/accounts/constraints.rs#L1126-L1179>.
- The file <https://github.com/Squads-Protocol/v4/blob/main/programs/squads_multisig_program/src/utils/small_vec.rs> is derived from code released under both the [Apache 2.0 license](https://github.com/near/borsh-rs/blob/master/LICENSE-APACHE) and the [MIT license](https://github.com/near/borsh-rs/blob/master/LICENSE-MIT) at <https://github.com/near/borsh-rs/blob/master/borsh/src/de/hint.rs> and <https://github.com/near/borsh-rs/blob/master/borsh/src/ser/mod.rs>.

To the extent that each such file incorporates code from another source, such code is licensed under its respective open source license as provided above, and the original open source code is copyrighted by its respective owner as provided above.
