# Mainnet fixtures for the v4 migration tests

The migration test (`sdk/multisig-4r/test/integration/v4-migration.test.ts`) runs real v4 vault
transactions that call 4r. A local validator cannot create these accounts:

- The v4 program has no upgrade authority, and its `program_config_init` accepts only a hardcoded
  mainnet initializer. Thus the test loads the mainnet ProgramConfig account.
- Agave 4.3 `solana-test-validator` does not load Token-2022.

| File | Address | Source |
|---|---|---|
| `squads_v4.so` | `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` | `solana -um program dump`, last deployed in slot 302582236, no upgrade authority |
| `program_config.json` | `BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr` (v4 ProgramConfig PDA) | `solana -um account --output json`, slot 460303404. Creation fee 0 |
| `spl_token_2022.so` | `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb` | `solana -um program dump`, slot 460306085. Mainnet can upgrade it; this file is a snapshot |

`SHA256SUMS` holds the hashes. CI checks them before it starts the validator.

## Start the validator

Run from the repository root, after you build the 4r testing binary
(`ANCHOR_BUILD_SBF_ARCH=v3 anchor build --no-idl -p squads_multisig_4r_program -- --features=testing`):

```sh
solana-test-validator --reset --quiet --ledger /tmp/sdk-ledger --rpc-port 18899 --faucet-port 19900 \
  --bpf-program GyhGAqjokLwF9UXdQ2dR5Zwiup242j4mX4J1tSMKyAmD target/deploy/squads_multisig_4r_program.so \
  --bpf-program SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf tests/fixtures/v4-mainnet/squads_v4.so \
  --bpf-program TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb tests/fixtures/v4-mainnet/spl_token_2022.so \
  --account BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr tests/fixtures/v4-mainnet/program_config.json \
  --upgradeable-program 5Yk7if5XWfc34w2n8Zr2h6giukrKUFMBy98ACXvJZBL1 tests/fixtures/v4-mainnet/squads_v4.so \
    4GXYAfWWYJKtYwNtzdNMEMVYsqJBzZ363RZXT7Wjec9Q
```

Then run `RPC_URL=http://127.0.0.1:18899 RPC_WS_URL=ws://127.0.0.1:18900 npm run test:integration`
in `sdk/multisig-4r`.

- `5Yk7if5XWfc34w2n8Zr2h6giukrKUFMBy98ACXvJZBL1` is a test program. Its upgrade authority is
  `4GXYAfWWYJKtYwNtzdNMEMVYsqJBzZ363RZXT7Wjec9Q`: vault 0 of the v4 multisig whose `create_key` is
  `sdk/multisig-4r/test/integration/fixtures/migration-create-key.json`. The test moves this
  authority to the 4r successor.
- The test creates that v4 multisig. Use `--reset` before each run.

## Refresh

```sh
solana -um program dump SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf squads_v4.so
solana -um program dump TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb spl_token_2022.so
solana -um account BSTq9w3kZwNwpBXJEvTZz2G9ZTNyKBvoSeXMvwb4cNZr --output json -o program_config.json
shasum -a 256 squads_v4.so spl_token_2022.so program_config.json > SHA256SUMS
```

The v4 binary cannot change. Refresh Token-2022 only when you want to test a newer release.
