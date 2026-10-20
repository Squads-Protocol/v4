# Golden wire-format fixtures

These fixtures pin the Squads v4 wire format that Squads Multisig 4r keeps unchanged.
Four test suites read them:

| Suite | Checks |
|---|---|
| `programs/squads_multisig_program/tests/golden_wire_format.rs` | The program's Anchor types decode every fixture and encode the same bytes; account sizes match the program's `size()` helpers; every account type and live instruction has a fixture. |
| `programs/squads_multisig_program/tests/core.rs` | The core types (no Anchor) decode and encode the same bytes; every core instruction builder rebuilds the mainnet instruction data. |
| `programs/squads_multisig_program/tests/core_matches_anchor.rs` | Every core builder produces the same account metas and data as Anchor (the instruction data comes from these fixtures). |
| `sdk/multisig-4r/test/unit/golden.test.ts` | The Codama TypeScript client decodes and encodes the same bytes, including embedded `TransactionMessage` bytes. |

## Format

One fixture per line: `<type|instruction> <address|signature|case> <hex bytes>`. Lines that
start with `#` are comments.

## Sources

- `accounts.txt`: 61 accounts owned by the frozen v4 program
  `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` on mainnet-beta, collected on 2026-10-19.
  All 9 account types; up to 8 per type, chosen to cover different variants (proposal
  status, config actions, SOL/SPL spending limits, lookup tables, ephemeral signers, …).
- `instructions.txt`, first section: instruction data of successful mainnet-beta
  transactions to the v4 program (22 instructions, up to 3 samples each).
- `instructions.txt`, `beet:` section: 13 instructions that mainnet sampling did not reach
  (program config, controlled-multisig config, `proposal_cancel_v2`, buffer/batch close).
  The frozen v4 TypeScript SDK (`@sqds/multisig` 2.1.x, Solita/Beet) encoded them, so they
  are an independent v4 encoding, not output of this repository's code.

## Exceptions

- `log_event` has no fixture. It is new in 4r, so there is no v4 encoding. `tests/core.rs`,
  `tests/core_matches_anchor.rs` and `tests/events.rs` check it against the IDL and Anchor.
- `multisig_create` (v1) has no data fixture. The program deprecated it before the freeze:
  it takes no arguments and always fails. Mainnet samples from before the deprecation carry
  arguments that neither v4 nor 4r accepts. The discriminator checks still cover it.
- Bytes after an account's encoded value (realloc headroom, or stale bytes after a shrink)
  are not compared; they are not part of the format.

## Regenerate

The tools are in `tools/`. They need network access to a mainnet-beta RPC.

```sh
python3 -I tools/collect.py                                   # writes raw_accounts.json, raw_ix.json in tools/
python3 -I tools/select.py .                                  # rewrites accounts.txt, instructions.txt
NODE_PATH=../../../../../node_modules node tools/beet_fallback.cjs >> instructions.txt
```

Add the `# Not seen in mainnet sampling …` comment line before the appended `beet:` lines.
Do not commit `raw_*.json`.
