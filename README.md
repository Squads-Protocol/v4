# Squads Multisig Program V4

## Build Verification

You can use [Solana Verify CLI](https://github.com/Ellipsis-Labs/solana-verifiable-build) to verify that the program deployed at `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` matches the code in this repository. After installing the CLI, run:

```
solana-verify verify-from-repo --current-dir -um --library-name multisig --program-id SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf https://github.com/Squads-Protocol/v4
```

This may take a while as it builds the program inside Docker, then verifies that the build hash matches the deployed program hash. The verification process is much faster on a non-ARM machine.


## License

The primary license for Squads Multisig Program V4 is the Business Source License 1.1 (`BUSL-1.1`), see [LICENSE](./LICENSE). The following exceptions are not licensed under the BULS-1.1, but are licensed separately as follows:

- The file <https://github.com/Squads-Protocol/v4/blob/main/programs/multisig/src/utils/system.rs> is derived from code released under the [Apache 2.0 license](https://github.com/coral-xyz/anchor/blob/master/LICENSE) at <https://github.com/coral-xyz/anchor/blob/714d5248636493a3d1db1481f16052836ee59e94/lang/syn/src/codegen/accounts/constraints.rs#L1126-L1179>.
- The file <https://github.com/Squads-Protocol/v4/blob/main/programs/multisig/src/utils/small_vec.rs> is derived from code released under both the [Apache 2.0 license](https://github.com/near/borsh-rs/blob/master/LICENSE-APACHE) and the [MIT license](https://github.com/near/borsh-rs/blob/master/LICENSE-MIT) at <https://github.com/near/borsh-rs/blob/master/borsh/src/de/hint.rs> and <https://github.com/near/borsh-rs/blob/master/borsh/src/ser/mod.rs>.

To the extent that each such file incorporates code from another source, such code is licensed under its respective open source license as provided above, and the original open source code is copyrighted by its respective owner as provided above.