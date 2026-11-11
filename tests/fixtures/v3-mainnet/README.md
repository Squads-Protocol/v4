# Mainnet fixtures for the v3 migration tests

The v3 migration test (`sdk/multisig-4r/test/integration/v3-migration.test.ts`) runs real v3
(Squads MPL) transactions that call 4r. These programs are not in a local validator.

| File | Address | Source |
|---|---|---|
| `squads_mpl.so` | `SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu` (Squads v3) | `solana -um program dump`, last deployed in slot 178977035, **no upgrade authority** |
| `roles.so` | `SMPLvKJwsyNGD6xf7Ph6VRpDGPa3DXV4uPHcTAnXe6r` (Squads v3 roles) | `solana -um program dump`, last deployed in slot 161766470. Mainnet can upgrade it (authority `5AxjGCHBYCQU36wnFxVeS1Cf32eWfLVEzS1SrKjYwELy`); this file is a snapshot |

Both files were dumped on 2026-10-30 (mainnet slot 463351471). `SHA256SUMS` holds the hashes. CI
checks them before it starts the validator.

The 4r program never reads the roles program. The tests load it only to create v3 multisigs with
roles delegate members, which the planner must refuse (`MIGRATION_SAFETY.md`, the v3 residuals).

Both binaries are SBPF v0 (Anchor 0.26). The Agave 4.3 test validator runs them.

## Start the validator

Add these flags to the command in `tests/fixtures/v4-mainnet/README.md`:

```sh
  --bpf-program SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu tests/fixtures/v3-mainnet/squads_mpl.so \
  --bpf-program SMPLvKJwsyNGD6xf7Ph6VRpDGPa3DXV4uPHcTAnXe6r tests/fixtures/v3-mainnet/roles.so \
  --upgradeable-program 5bV6jUfhDHCQVA1WfKBUnXUsboJgoKgkzkKcxr3joew5 tests/fixtures/v4-mainnet/squads_v4.so \
    2JbpQGYRrGfgHjU8akLGq2RdK8U2hruXBVhWLLRa6exf
```

- `5bV6jUfhDHCQVA1WfKBUnXUsboJgoKgkzkKcxr3joew5` (32 bytes of `0x44`) is a test program. Its upgrade
  authority is `2JbpQGYRrGfgHjU8akLGq2RdK8U2hruXBVhWLLRa6exf`: authority 1 of the v3 multisig
  `8Rh2pVF6gomCn85QURzF7a5Wb8h2aMSt36onxG1UEJ8M`, whose create key is 32 bytes of `0x33`
  (`4Ss5JMkXAD9Z7cktFEdrqeMuT6jGMF1pVozTyPHZ6zT4`). The test moves this authority to the successor.
- The test creates that v3 multisig. Use `--reset` before each run.

## Refresh

```sh
solana -um program dump SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu squads_mpl.so
solana -um program dump SMPLvKJwsyNGD6xf7Ph6VRpDGPa3DXV4uPHcTAnXe6r roles.so
shasum -a 256 squads_mpl.so roles.so > SHA256SUMS
```

The v3 binary cannot change. Refresh the roles binary only when its mainnet version changes.
