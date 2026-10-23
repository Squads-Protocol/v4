# Safety Argument: the v4 to 4r Successor Migration

Status: **draft for review**. Scope: `multisig_create_from` and the six `multisig_migrate_*`
instructions of Squads Multisig 4r (`programs/squads_multisig_program`), and the way they use the
frozen Squads v4 program and the Solana runtime. The user guide is section 11 of
`V4.5_REVISED.md`.

## Contents

1. [What this document proves](#1-what-this-document-proves)
2. [System model](#2-system-model)
3. [Runtime axioms](#3-runtime-axioms)
4. [Trust assumptions](#4-trust-assumptions)
5. [Threat model](#5-threat-model)
6. [Safety properties and proofs](#6-safety-properties-and-proofs)
7. [Code obligations and evidence](#7-code-obligations-and-evidence)
8. [Liveness: what can block, and why a block loses nothing](#8-liveness-what-can-block-and-why-a-block-loses-nothing)
9. [Residual powers, findings and limits](#9-residual-powers-findings-and-limits)
10. [Mechanized evidence and open work](#10-mechanized-evidence-and-open-work)

---

## 1. What this document proves

The main result is **control preservation**:

> When a migrate instruction moves an asset from a v4 vault to its 4r successor vault, the
> governance that can spend the asset after the move is equal to the governance that could spend
> it before the move. No party gets a power over the asset that it did not have before.

Five properties support this result: lineage (S1), authorization (S2), destination integrity
(S3), governance equality at execution (S4) and class isolation (S6). Section 6 gives each
property with its proof.

**What "proof" means here.** Each proof is a deduction from three inputs:

1. **Runtime axioms** (section 3): rules that the Solana runtime enforces for every program.
2. **Trust assumptions** (section 4): facts that we cannot prove from the code, for example that
   the v4 program cannot change.
3. **Code obligations** (section 7): local facts about our code, for example "this account has
   these seeds". Each obligation names the code location and the test that checks it.

The deduction from the axioms and obligations to the properties is complete. The obligations are
checked by code review, unit tests, integration tests on a local validator with the mainnet v4
binary, and a TLA+ model of the design. Kani proves the governance functions of
`src/migration.rs` for all inputs within stated bounds (section 10.2). The rest of the Rust code
has no machine proof. Section 10 lists what is checked by machine and what is open.

## 2. System model

### 2.1 Programs

| Symbol | Program | Address |
|---|---|---|
| `V` | Squads v4 (frozen) | `SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` |
| `R` | Squads 4r | `SMS4Rd3C3P1V2PdGRSdZCVQ5fPJk7NsV7vAVoUgSvT5` |
| `E` | External programs that the migrate instructions call | System, Token, Token-2022, Associated Token (ATA), Stake, Vote, BPF Loader Upgradeable |

### 2.2 Addresses

`PDA_P(s)` is the program derived address of seeds `s` under program `P`. The seed prefix of both
programs is `"multisig"`.

| Symbol | Definition | Meaning |
|---|---|---|
| `M` | `PDA_V("multisig", "multisig", create_key, bump)` | A v4 multisig |
| `vault_i(M)` | `PDA_V("multisig", M, "vault", i, bump)` | v4 vault `i` of `M` |
| `S(M)` | `PDA_R("multisig", "multisig", M, bump)` | The successor: the 4r multisig with `create_key = M` |
| `W_i` | `PDA_R("multisig", S(M), "vault", i, bump)` | Successor vault `i` |

### 2.3 Governance

The governance of a multisig `X` is the tuple:

```
Gov(X) = (members with permissions, threshold, time_lock, config_authority)
```

For the comparison, the config authority of `M` is **mapped**: if it is `vault_j(M)` and the
caller gives the hint `j`, it becomes `W_j`. Otherwise it stays as it is (`migration::map_vault`).
The rent collector is not part of `Gov` (section 9.6).

### 2.4 Control

An authorization path for an asset `x` is a way to debit `x` or to change its authority. For a
v4 vault asset, the paths are:

- a v4 vault transaction or batch that `Gov(M)` approved (threshold, then time lock);
- a v4 spending limit of `M` (bounded by its amount and destinations);
- powers of third parties that exist on `x` itself: a token delegate, a close authority, a mint
  freeze authority, a Token-2022 permanent delegate, a stake lockup custodian.

`Ctrl_t(x)` is the set of these paths at time `t`.

## 3. Runtime axioms

These rules hold for every program on Solana. The proofs use only these rules for the runtime.

| ID | Axiom |
|---|---|
| **R1** | **PDA signature.** In a CPI, the callee sees an account as a signer only if (a) it was a signer of the calling instruction, or (b) the caller gives seeds `s` and `PDA_caller(s)` is the account. Thus only program `P` can make `PDA_P(s)` a signer, and only in a CPI that `P` itself makes. |
| **R2** | **No key for a PDA.** A PDA is not on the ed25519 curve. No private key exists, so a PDA never signs a transaction at the top level. |
| **R3** | **Ownership.** Only the owner program can change the data of an account or debit its lamports. A System-owned account is debited only by the System program, with the signature of that account. `Allocate` and `Assign` also need that signature. |
| **R4** | **Atomic transactions.** A transaction succeeds completely or has no effect. A failed CPI fails the whole transaction. |
| **R5** | **No reentrancy.** A program can call itself directly. It cannot be entered again through another program (`A -> B -> A` fails). |
| **R6** | **Privilege does not grow.** A callee gets at most the signer and writable flags of its caller, plus the PDA signers of R1(b). |
| **R7** | **Immutable programs.** A loader-v3 program without an upgrade authority cannot change its code. |
| **R8** | **Limits.** CPI depth, a 64-instruction trace, account locks and compute units are limited. If a limit is exceeded, the transaction fails (R4). |
| **R9** | **Hash.** PDAs use SHA-256 of `seeds ‖ program_id ‖ "ProgramDerivedAddress"`. Two different seed byte strings under the same program give two different addresses, unless SHA-256 has a collision. We assume it has none. |

## 4. Trust assumptions

| ID | Assumption | How to check it |
|---|---|---|
| **A1** | The runtime enforces R1 to R8. | Solana runtime specification; both validator clients. |
| **A2** | The code at `V` is the v4 source at the `main` branch, and `V` has no upgrade authority. With R7, the behavior of `V` is fixed. | `solana program show SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf` shows no authority. `tests/fixtures/v4-mainnet/SHA256SUMS` pins the mainnet binary that the tests run. |
| **A3** | The code at `R` is this source (verifiable build, `V4.5_REVISED.md` section 5.6). The holder of the `R` upgrade authority does not replace it with harmful code. | Out of scope. It is the same trust as for every upgradeable program. Section 9.8. |
| **A4** | The programs in `E` behave as their specifications say. Their addresses are constants in our code. | `core_matches_anchor.rs` checks the constants against the official crates. |
| **A5** | The adversary does not control a threshold of `Gov(M)`. If it did, it would already control the v4 vault assets, and the migration would give it nothing new. | — |

## 5. Threat model

The adversary can:

- send any transaction with any keypair that it holds, to any program, at any time;
- send lamports or tokens to any address, including `S(M)`, `W_i`, and the ATAs of `W_i`, before
  or after they exist;
- be a v4 member below the threshold. It can propose any v4 vault transaction or batch, with any
  instruction arguments, including wrong vault hints, wrong items and wrong accounts;
- change the config of a multisig when it holds the authority for that change (a config
  authority, or a threshold of members);
- see pending proposals and act between approval and execution.

The adversary wins if one of these occurs:

- **G1.** It creates `S(M)` with a governance that is not `Gov(M)` (squatting).
- **G2.** It causes a migrate instruction to execute without approval by `Gov(M)`.
- **G3.** It causes an asset of `vault_i(M)` to go to an address other than `W_i` or an ATA of
  `W_i`, or an authority to go to a holder other than `W_i`.
- **G4.** It causes an asset to move while `Gov(S(M)) ≠ Gov(M)`.
- **G5.** A migrate instruction for one asset class changes an asset of another class.

## 6. Safety properties and proofs

### S1. Lineage: only the v4 multisig can create its successor

> The account `S(M)` exists only if `multisig_create_from` executed with a signature of
> `vault_i(M)` for some `i`. At creation, `Gov(S(M)) = Gov(M)` (with the hints mapped), and
> `S(M)` has no transactions.

**Proof.**

1. `S(M)` is owned by `R` after creation. By R3, only `R` can write a `Multisig` there. `R`
   initializes a multisig PDA in two places only (O1): `multisig_create_v2` and
   `multisig_create_from`. Both use Anchor `init`, so the second call on the same address fails.
2. **Case `multisig_create_v2`.** Its seeds are `("multisig", "multisig", create_key)`, and
   `create_key` must sign. To get `S(M)`, `create_key` must be `M`. So `M` must sign an
   instruction to `R`.
   - By R2, `M` cannot sign at the top level, because `M` is a PDA of `V`.
   - By R1, only `V` can make `M` a signer, in a CPI that `V` makes. `V` makes PDA signatures in
     three places only (O7):
     - **L1:** account creation (Anchor `init`, `utils/system.rs`). The callee is the System
       program, which makes no CPI. The signer privilege of `M` stops there.
     - **L2:** `execute_message` (vault transactions and batch entries). It signs as
       `vault_i(M')` and as ephemeral signers of the transaction.
     - **L3:** `spending_limit_use`. It signs as `vault_i(M')`. The callee is the System program
       or Token/Token-2022 (`Interface<TokenInterface>`).
   - The seed bytes of `M` are 49 bytes long: 8 + 8 + 32 + 1 (bump). A vault PDA has 47 bytes
     (8 + 32 + 5 + 1 + 1), and an ephemeral signer has 58 bytes (8 + 32 + 16 + 1 + 1). Different
     lengths give different preimages. By R9, `M` is not a vault or an ephemeral signer of any
     v4 multisig. Thus L2 and L3 never sign as `M`.
   - Thus `M` never signs an instruction to `R`, and `multisig_create_v2` cannot create `S(M)`.
3. **Case `multisig_create_from`.** It requires (O2):
   - `source_multisig` is owned by `V` and decodes as a v4 `Multisig` (owner and discriminator);
   - `source_vault` is `vault_i(source_multisig)` under `V` (seeds with `seeds::program = V`),
     and it signs;
   - the new account is `PDA_R("multisig", "multisig", source_multisig)`.

   So `S(M)` comes from `multisig_create_from` only with `source_multisig = M`, signed by
   `vault_i(M)`. By S2, `Gov(M)` approved it.
4. **The config.** `migration::mirror` reads `M` when the instruction executes. It copies the
   members, permissions, threshold, time lock, config authority and rent collector. It maps a
   hinted vault field only if the hint names the real value, else `MigrationInvalidVaultHint`.
   `transaction_index = 0` and `stale_transaction_index = 0`, so `S(M)` has no proposals.
5. **Pre-funding does not block creation.** Anybody can send lamports to `S(M)`. Anchor `init`
   then uses transfer, `Allocate` and `Assign`, which `R` signs as `S(M)` (R1). Nobody else can
   allocate or assign `S(M)` (R3: that needs the signature of `S(M)`). ∎

**Defeats G1.** The integration test "lets nobody create the successor with multisig_create_v2
(safety property S1)" tries step 2 on the validator with the mainnet v4 binary, before the
successor exists:

| Attempt | Result |
|---|---|
| Call `multisig_create_v2` directly, `create_key = M` without a signature | 4r: `AccountNotSigner` (3010) on `create_key` |
| A v4 vault transaction whose message marks `M` as a signer | v4: `InvalidAccount` (6014) at `utils/executable_transaction_message.rs:91`, the check that a message signer other than a vault or an ephemeral signer signs the transaction |
| A v4 vault transaction that passes `M` without a signature | 4r: `AccountNotSigner` (3010) on `create_key` |

After the three attempts, `S(M)` does not exist, and the next test creates it with
`multisig_create_from`. The TLA+ model shows that the property is necessary: with
`SquatPossible = TRUE`, `MigrationSquat` finds a squatter.

### S2. Authorization: every step is a v4 consensus action

> Each execution of `multisig_create_from` or of a migrate instruction for `M` is part of a v4
> vault transaction or batch of `M` that `Gov(M)` approved, after the time lock.

**Proof.**

1. Every such instruction requires `source_vault = vault_i(M)` under `V`, as a signer (O2: the
   shared `MigrationAccounts`, and the accounts of `multisig_create_from`).
2. By R2, `vault_i(M)` cannot sign at the top level. By R1, only `V` can make it a signer, at L2
   or L3 (O7).
3. **L3** (`spending_limit_use`) calls only the System program or Token/Token-2022, with a fixed
   list of accounts. The list does not contain `R`. The System program and Token make no CPI.
   Token-2022 calls a transfer hook only if the hook program is in the accounts, and it is not.
   Thus L3 cannot reach `R`.
4. **L2** executes only in `vault_transaction_execute` and `batch_execute_transaction` of `V`.
   These require the proposal status `Approved` (the threshold of `Gov(M)` voted), the time lock
   after approval, and a member with the `Execute` permission.
5. A v4 batch can get new entries only while its proposal is a draft. The members vote after
   `proposal_activate`, so they approve the final list of entries.
6. **Note.** An approved message can give the vault signer to another program `X`, and `X` can
   call `R`. Then `Gov(M)` approved a transaction that gives `X` full control of the vault. `X`
   could move the assets directly, so the path through `R` adds no power. ∎

**Defeats G2.** The integration test "refuses a call that v4 did not sign" signs as `sourceVault`
with a normal keypair: the seeds check fails (Anchor error 2006).

### S3. Destination integrity: assets go only to the successor vault

> Every lamport, token and authority that a migrate instruction moves goes to `W_i` or to the
> ATA of `W_i`, where `i` is the index of the signing v4 vault. The move cannot debit `W_i`.

**Proof.**

1. No migrate instruction has a destination argument (O3).
2. `vault_index` is an argument, but the seeds of `source_vault` include it (O2). A signature of
   `vault_i(M)` with `vault_index = j ≠ i` fails the seeds check. Thus the index of the
   destination equals the index of the signer. (Test: "refuses a vault index that is not the
   signing vault", error 2006.)
3. `multisig` must be `PDA_R("multisig", "multisig", source_multisig)`, owned by `R`, with
   `create_key = source_multisig`. `vault` must be `PDA_R("multisig", multisig, "vault", i)`.
   Thus `multisig = S(M)` and `vault = W_i` (O2).
4. Each CPI uses `W_i` as the receiver (O3):

   | Instruction | CPI | Receiver |
   |---|---|---|
   | `multisig_migrate_sol` | System `Transfer` | `to = W_i` |
   | `multisig_migrate_tokens` | ATA `CreateIdempotent`, `transfer_checked`, `CloseAccount` | the program checks `destination = ATA(W_i, mint, token_program)`; the ATA owner is `W_i`; close sends lamports to `W_i` |
   | `multisig_migrate_token_authorities` | Token `SetAuthority`; metadata `UpdateAuthority` | new authority `= W_i` |
   | `multisig_migrate_stakes` | Stake `Authorize` (staker, withdrawer); Stake `SetLockup` (custodian) | new authority or custodian `= W_i` |
   | `multisig_migrate_vote_accounts` | Vote `Authorize` (withdrawer) | new authority `= W_i` |
   | `multisig_migrate_programs` | Loader-v3 `SetAuthority` | new authority `= W_i` |

5. The new authority does not sign, so the instructions use the unchecked forms. This is safe
   because the program calculates the new authority (step 4), not the caller.
6. **`W_i` is not debited.** The migrate instructions never sign as `W_i` (O4). `W_i` is a
   System-owned PDA. By R1 and R3, no lamports leave it, and no token or authority that it
   holds changes. The ATA payer is `vault_i(M)`. ∎

**Defeats G3.**

### S4. Governance equality at execution

> Each migrate instruction moves an asset only when `Gov(S(M)) = Gov(M)` at that time.

**Proof.**

1. Before any CPI, `MigrationAccounts::begin` decodes `M` (owner `V`, discriminator) and calls
   `migration::check_same_governance` (O5). It compares the members (keys and permissions), the
   threshold, the time lock, and the mapped config authority. Both programs keep `members`
   sorted by key, so the vectors compare directly. A difference fails with
   `MigrationGovernanceMismatch` (6046).
2. The check and the moves are in one instruction. The accounts `M` and `S(M)` are read-only in
   the instruction, and no CPI receives them as writable. By R3 and R5, nothing changes them
   between the check and the moves.
3. By R4, a failed check undoes the whole transaction. ∎

**Defeats G4.** Why the check is necessary: after creation, either governance can change on its
own (a config authority, a config transaction, or a key rotation). An approved v4 batch can
execute much later. Without the check, `MigrationDrift` (TLA+) finds this attack: create the
successor, change the successor to the adversary, then execute the approved batch. The
integration test "stops every class when the successor governance drifts from v4" checks that
four classes fail with 6046 after such a change.

**The vault hint.** The hint `config_authority_vault_index` is an argument, but it cannot weaken
the check. `map_vault` accepts a hint only if `vault_j(M)` is the real v4 config authority. With
the hint, the successor must have `W_j`. Without it, the successor must have `vault_j(M)`. At
time `t`, `Gov(M)` controls both, and the check compares the full tuple.

### S5. Control preservation (main result)

> For an asset `x` that a migrate instruction moves at time `t`:
> `Ctrl_{t+}(x)` gives no power to a party that did not have it in `Ctrl_t(x)`.

**Proof.** We compare each path of section 2.4 before and after the move.

| Path | Before the move | After the move | Reason |
|---|---|---|---|
| Multisig approval | `Gov(M)` approves a v4 vault transaction | `Gov(S(M))` approves a 4r vault transaction | S3: `x` is at `W_i`. S4: `Gov(S(M)) = Gov(M)` at `t`. S1: `S(M)` came only from `M`. |
| Spending limits | Spending limits of `M` | Spending limits of `S(M)` | `multisig_create_from` copies none. A spending limit on `S(M)` exists only if `Gov(S(M))` approved it on 4r. |
| Config authority | `config_authority(M)` | `config_authority(S(M))` | Part of `Gov`. Equal at `t` (S4). |
| Third-party powers on `x` | delegate, close authority, freeze authority, permanent delegate, lockup custodian | the same, or less | Tokens move to the ATA of `W_i`. It has none of the delegate or close powers of the source; if it existed before, it has only the powers that `W_i` gave. `SetAuthority(AccountOwner)` clears the delegate. It keeps the close authority (except on native accounts), so the planner adds a `CloseAccount` item when `vault_i(M)` holds it (section 9.4). Mint-level powers (freeze, permanent delegate) existed before. A lockup custodian that `vault_i(M)` held moves to `W_i` (section 9.2). |

Each row keeps a power or removes it. No row adds a power for a new party. After `t`, the two
governances can change on their own: `x` then follows `Gov(S(M))`, which the members of `M` at
time `t` controlled. ∎

**Defeats G1 to G4 together.** The TLA+ invariant `NoTheftByMigration` states this result for the
abstract model: a migrate gives the adversary an asset only if the adversary already ruled `M`.

### S6. Class isolation and least privilege

> A migrate instruction calls only the programs of its class, gives the signer of `vault_i(M)`
> only to those programs, and changes only the items in its accounts.

**Proof.**

1. Each instruction fixes the address of every program that it calls (O6):

   | Instruction | Programs it can call |
   |---|---|
   | `multisig_migrate_sol` | System (`Program<System>`) |
   | `multisig_migrate_tokens` | One token program (`Interface<TokenInterface>`: Token or Token-2022), ATA (`address =`), System |
   | `multisig_migrate_token_authorities` | One token program (`Interface<TokenInterface>`) |
   | `multisig_migrate_stakes` | Stake (`address =`) |
   | `multisig_migrate_vote_accounts` | Vote (`address =`) |
   | `multisig_migrate_programs` | BPF Loader Upgradeable (`address =`) |

   All six can also call `R` itself for the event (`log_event`). `R` answers `log_event` in its
   entrypoint, before Anchor, and it signs only as `S(M)`, never as `vault_i(M)` or `W_i`.
2. The program checks each item before it acts: the owner program, the layout, and that
   `vault_i(M)` holds the authority now. An item that does not pass is skipped (section 8.2). A
   wrong account count fails with `MigrationInvalidAssetAccounts` (6048). A program that is not
   Token or Token-2022 in the token slot fails with Anchor error 3008. More than 64 items fail
   with 6040.
3. Thus an item of one class cannot reach a program of another class. A wrong or harmful item in
   a proposal can only be skipped or fail the entry. ∎

**Defeats G5.**

### S7. Conservation

> A migrate instruction changes no balance other than these: `vault_i(M)` decreases;
> `W_i` and the ATAs of `W_i` increase by the same value; `vault_i(M)` pays the rent of new ATAs.
> `multisig_create_from` also pays the 4r creation fee to the 4r treasury, at most the
> `max_creation_fee` that the members approved.

**Proof.**

- SOL: one System transfer of `balance − keep` from `vault_i(M)` to `W_i`. `keep` must be 0 or
  at least the rent minimum (6049).
- Tokens: the amount is the balance that the program reads at execution. `transfer_checked` uses
  the decimals of the mint. A Token-2022 transfer fee stays withheld in the destination ATA,
  where the withdraw-withheld authority of the mint can collect it. That power existed before
  the move (it applies to every transfer of that mint).
- Close: only if `close_source` is set, the balance is 0 after the transfer, no fees are
  withheld, and `vault_i(M)` can close the account. The rent goes to `W_i`.
- By R4, a failure in any CPI undoes all the moves of the entry. ∎

**The creation fee.** It is the only value that leaves to a third party. The members approve its
cap, and a larger fee fails before any transfer (section 9.1).

## 7. Code obligations and evidence

Paths are relative to `programs/squads_multisig_program/`.

| ID | Obligation | Code | Evidence |
|---|---|---|---|
| **O1** | `R` initializes a multisig PDA only in `multisig_create_v2` (`create_key: Signer`) and `multisig_create_from`. | `src/instructions/multisig_create.rs`, `src/instructions/multisig_create_from.rs` (`init`, seeds) | Review: the only `init` with `SEED_MULTISIG` seeds. Test: "creates the successor once" (account in use). |
| **O2** | Every migration instruction requires: `source_multisig` owned by `V`; `source_vault` = v4 vault PDA (`seeds::program = V`) and a signer; `multisig` = the successor PDA, owned by `R`, `create_key = source_multisig`; `vault` = the successor vault with the same index. | `src/instructions/migrate/common.rs` (`MigrationAccounts`), `multisig_create_from.rs` | Tests: "refuses a call that v4 did not sign" (2006), "refuses a vault index that is not the signing vault" (2006), "refuses to migrate before the successor exists" (3012). `core_matches_anchor.rs`: builders match the Anchor account lists. |
| **O3** | No migrate instruction has a destination argument. Every receiver or new authority is `W_i` or `ATA(W_i)`, and the program checks the ATA address. | `src/instructions/migrate/{sol,tokens,token_authorities,stakes,vote_accounts,programs}.rs` | Integration tests read the chain state after each class: balances at `ATA(W_i)`, authorities equal to `W_i`. |
| **O4** | The migrate instructions never sign as `W_i`. | Same files: `invoke` and `CpiContext::new`, no seeds of `W_i` | Review: no `invoke_signed` or `new_with_signer` in `src/instructions/migrate/`. |
| **O5** | `check_same_governance` runs before any CPI, on `M` decoded with the owner and discriminator checks. | `common.rs` (`begin`), `src/migration.rs` | `tests/migration.rs` (unit tests of `mirror`, `map_vault`, `check_same_governance`); Kani proofs of these functions (section 10.2); integration test "stops every class when the successor governance drifts" (6046). |
| **O6** | Each instruction fixes its program addresses. | `#[account(address = ...)]`, `Program<System>`, `Interface<TokenInterface>` in each module | Integration test: a foreign token program fails (3008). `core_matches_anchor.rs` checks the program ID constants. |
| **O7** | `V` signs as a PDA only at L1 (account creation, System callee), L2 (`execute_message`: vault and ephemeral signers) and L3 (`spending_limit_use`: vault; System or Token callee; fixed accounts). | v4 source on `main`: `utils/system.rs`, `utils/executable_transaction_message.rs`, `instructions/spending_limit_use.rs`, Anchor `init` | Review of the v4 source (all `invoke_signed` and `new_with_signer` sites). A2 links the source to the deployed binary. The S1 integration test shows that L2 refuses to sign as `M`. |
| **O8** | v4 executes a vault message only for an `Approved` proposal after the time lock, by a member with `Execute`. | v4 `vault_transaction_execute.rs`, `batch_execute_transaction.rs` | v4 audits (`audits/`); the mainnet binary in the integration tests. |
| **O9** | Items are read before each change: owner program, layout, current holder. | `token_state.rs`, `token_authorities.rs` (`current`), `stakes.rs` (`stake_meta`), `vote_accounts.rs` (`vote_withdrawer`), `programs.rs` (`program_data_authority`) | Integration tests for each skip reason; Token-2022 extension and metadata authorities; a vote account on Agave 4.3.2 (withdrawer at bytes 36..68). |

## 8. Liveness: what can block, and why a block loses nothing

Safety says that nothing bad occurs. Liveness says that the move can finish. The design gives up
liveness in some cases, never safety.

### 8.1 Causes of a failed batch entry

| Cause | Effect | Recovery |
|---|---|---|
| The governances differ (S4) | Every migrate entry fails with 6046 | Make the two equal; execute again |
| Too many CPIs (64-instruction trace) | The entry fails | The planners count the worst case (9 for each token). Re-propose with smaller entries. |
| Not enough SOL for new ATAs | The entry fails | Fund `vault_i(M)`; execute again |
| Compute limit, account locks | The entry fails | Smaller entries |

By R4, a failed entry changes nothing. A v4 batch executes its entries in order, so a failed
entry blocks the entries after it. The members cancel the proposal and propose the remaining
assets again. Assets that moved stay at `W_i`.

### 8.2 Skips

An item with nothing to move is skipped, and the entry continues: `Empty`, `Missing`,
`NotAuthority`, `Frozen`, `Locked`, `Unsupported`. Thus the adversary cannot block a batch with
one item. For example, it cannot block a batch by closing an empty token account that it
controls, or by moving an authority first. The `Migration` event records each skip.

### 8.3 Griefing that the adversary can do

| Action | Result |
|---|---|
| Send lamports to `S(M)` before creation | No effect (S1 step 5) |
| Send lamports to `ATA(W_i)` before the move | The ATA program uses 3 CPIs instead of 1. The planner counts this worst case, so the entry stays under the trace limit. |
| Send tokens or dust to `vault_i(M)` | New assets for a later proposal. They do not affect approved entries. |
| Freeze a token account (the mint freeze authority) | The item is skipped (`Frozen`). That power existed before (S5). |

## 9. Residual powers, findings and limits

### 9.1 Resolved: the creation fee is read at execution

`multisig_create_from` reads `program_config.multisig_creation_fee` when it executes, and the
holder of the 4r program config authority can change the fee to any `u64`. Without a limit, the
fee could rise between approval and execution and take the SOL of `vault_i(M)`.

**Fix.** `MultisigCreateFromArgs` has `max_creation_fee`. The members approve it with the
instruction. A larger fee at execution fails with `MigrationCreationFeeTooHigh` (6050), before
any transfer. The planners set the cap to the fee that they read, and the CLI prints it. Test:
"refuses a creation fee above max_creation_fee".

**Note on `multisig_create_v2`.** The v4-compatible `multisig_create_v2` has the same fee and no
cap. We do not change it, because a new argument breaks the v4 wire format. Usually the creator
signs and sends it at once, so the fee cannot change in between. But if a v4 or 4r vault
transaction calls `multisig_create_v2` with the vault as the payer, the same delay exists. Keep
such a vault nearly empty, or check the fee just before execution.

### 9.2 Resolved: the stake lockup custodian

`multisig_migrate_stakes` moves the staker, the withdrawer, and the lockup custodian (Stake
`SetLockup`, custodian `= W_i`). The Stake program needs the custodian to sign while a lockup is
in force, and the withdrawer at other times. `W_i` cannot sign, so the order of the CPIs follows
the lockup:

| `vault_i(M)` is the custodian, and the lockup is… | Order | `SetLockup` signer |
|---|---|---|
| in force | withdrawer (the vault also signs as custodian), then custodian | `vault_i(M)` as custodian |
| not in force, and `vault_i(M)` is the withdrawer | custodian, then withdrawer | `vault_i(M)` as withdrawer |
| not in force, and another party is the withdrawer | custodian skipped (`NotAuthority`) | — |

In the third case, the custodian has no power: only the withdrawer can start a new lockup, and
that party had this power before the move. Tests: the first two cases, with the custodian, the
withdrawer and the staker read from the stake account after the move.

### 9.3 Authorized voter of a vote account (kept by decision)

Here "authorized voter" is the role of the Vote program that signs validator votes. It is not a
multisig member with the `Vote` permission. Only the withdrawer of the vote account moves. If
`vault_i(M)` is the authorized voter, it stays the authorized voter until `W_i` (as the
withdrawer) assigns a new one. The authorized voter can only sign validator votes. It cannot
withdraw, and it cannot change the commission or the validator identity (the withdrawer does
that). Decision (2026-10-23): the program does not move it, because changes of the authorized
voter have per-epoch rules that could block a batch. Step 6 of the guide tells the members to
assign a new authorized voter from the successor.

### 9.4 Token roles and mints in the planner

The planner scans for token accounts where `vault_i(M)` is the close authority (`COption` at
byte 129) or the delegate (`COption` at byte 72). The owner can be anyone.

- **Close authority:** the planner adds a `CloseAccount` item for an account of another owner. It
  also adds one for an account of `vault_i(M)` that moves by owner change, because
  `SetAuthority(AccountOwner)` keeps the close authority. The token step closes or keeps the
  other accounts of `vault_i(M)`. A frozen account rejects `SetAuthority`, so the planner leaves it
  out with a note.
- **Delegate:** no instruction can move this role (section 9.9). The planner gives a note, so the
  members know that `vault_i(M)` can still spend these tokens.

The planner does not find mints where `vault_i(M)` holds only Token-2022 extension or metadata
authorities. Their offsets depend on the extension order of each mint, so a `getProgramAccounts`
filter cannot match them. The caller gives them with `extraMints`.

These are completeness limits. They are not a safety problem: what does not move stays under
`Gov(M)`, as before.

### 9.5 v4 spending limits stay active

A migration does not remove the spending limits of `M`. They apply only to `vault_i(M)`, not to
the moved assets (S3). Step 7 of the guide removes them.

### 9.6 Rent collector

`check_same_governance` does not compare the rent collector. The rent collector receives only the
rent of closed 4r transaction accounts, which the proposers paid. It has no power over vault
assets.

### 9.7 Approved transactions on the successor

The governance check compares the configuration only. It does not look at 4r vault transactions
that `Gov(S(M))` approved earlier. These were approved by the same members, so S5 holds. v4 and
4r both execute approved vault transactions after a config change (stale transactions).

### 9.8 Upgrade authorities

`V` cannot change (A2). `R` can change while it has an upgrade authority (A3). A harmful upgrade
of `R` can take every asset in every 4r vault, including the successor vaults. No design of the
migrate instructions can prevent that. Recommended: put the `R` upgrade authority behind a
multisig with a time lock, and publish the verifiable build hash.

### 9.9 Unsupported assets

Loader-v4 programs (their `TransferAuthority` needs the new authority to sign), durable nonce
accounts, tokens with a transfer hook, non-transferable tokens, paused mints, frozen accounts, the
delegate role on token accounts of other owners (only the owner can change a delegate), and the
update authority of a Token-2022 token group do not move. They stay under `Gov(M)`.

## 10. Mechanized evidence and open work

### 10.1 What is checked by machine

| Evidence | What it checks | Command |
|---|---|---|
| `tla/Migration.tla`, `Migration.cfg` | Invariants `SuccessorFromLineage`, `SameGovernanceOnMigrate`, `NoTheftByMigration` over all orders of create, config changes on both sides, and migrate | `bash tla/check.sh Migration` |
| `MigrationSquat`, `MigrationDrift` (expected to fail) | Each guard is necessary: a signable `create_key` allows squatting (S1); no governance check allows theft (S4) | same |
| `MigrationSquatContained` (pass) | Defense in depth: the governance check alone stops theft even if squatting were possible | same |
| `Migration.cfg` invariant `NoFeeAboveApproval`; `MigrationFee` (expected to fail) | The v4 vault never pays a creation fee above the approved `max_creation_fee`; without the check, a fee change after approval makes it pay more (section 9.1) | same |
| `tla/MigrationStake.tla`: `MigrationStake` (pass); `MigrationStakeOrder`, `MigrationStakeCustodian` (expected to fail) | The order of the stake CPIs always has the signatures that the Stake program needs; no movable role stays with the v4 vault; roles go only to the successor. The regression models show the wrong order (the batch entry fails) and the program without the custodian move (section 9.2) | `bash tla/check.sh MigrationStake` |
| `tests/migration.rs`, `tests/core_matches_anchor.rs`, `tests/compatibility.rs` | `mirror`, `map_vault`, `check_same_governance`; builders match Anchor; the v4 instruction set does not change | `cargo test -p squads-multisig-4r-program` |
| `sdk/multisig-4r/test/integration/v4-migration.test.ts` | Each class, each guard (2006, 3012, 3008, 6046, 6048, 6049, 6050), the S1 attempts (3010, v4 6014), skips, Token-2022 authorities, the close authority and delegate scans, on a validator with the mainnet v4 binary | the SDK integration command in CI |
| `src/instructions/migrate/proptests.rs`, `sdk/rs/tests/account_readers.rs`, `sdk/multisig-4r/test/unit/accountReaders.test.ts` | The account readers (`stake_meta`, `vote_withdrawer`, `program_data_authority`, `mint_authority`, and the planner readers) never panic, and they read what the official crates encode: stake, vote, loader-v3, and Token-2022 mints with random extensions in random order. The TS readers read a shared fixture from the Rust generators (section 10.3) | `cargo test -p squads-multisig-4r-program proptests`, `cargo test -p squads-multisig-4r --test account_readers`, the SDK unit tests |
| `src/migration/proofs.rs` (Kani 0.68.0) | Seven properties (11 harnesses) on the real Rust code, for all inputs within the bounds below (section 10.2) | `cargo kani -p squads-multisig-4r-program --no-default-features` (from the repository root) |

The TLA+ models are at design level. `Migration.tla` models governance as one value and assets as
places; the Kani proof `the_check_passes_exactly_for_equal_governance` shows that the code compares
exactly that value. `MigrationStake.tla` models the stake roles and the Stake program signer rules,
not account layouts. The models do not model the runtime. The proofs in section 6 connect the model to
the code through the obligations in section 7.

### 10.2 Kani proofs of the governance rules

The proofs check `map_vault`, `mirror`, `check_same_governance` and `v4_member_count` in
`src/migration.rs`, the code that obligation O5 and step 4 of S1 use.

| Proof | Property |
|---|---|
| `map_vault_without_a_hint_keeps_the_value` | No hint: the value does not change |
| `map_vault_maps_only_the_named_v4_vault` | A hint is accepted only if it names the v4 vault; then the result is the successor vault with the same index; else 6047 |
| `mirror_copies_the_governance` | `mirror` copies the members, permissions, threshold and time lock, maps the config authority, and refuses a rent collector hint without a v4 rent collector |
| `a_mirrored_successor_passes_the_governance_check` | A successor that `multisig_create_from` writes passes `check_same_governance` (S1 and S4 agree) |
| `the_check_passes_exactly_for_equal_governance` | For any two multisigs, the check passes if and only if the members, threshold, time lock and mapped config authority are equal; else 6046, or 6047 for a bad hint. Thus every change of any of these fields fails the check (S4) |
| `the_rent_collector_does_not_affect_the_check` | The rent collector does not change the result (section 9.6) |
| `v4_member_count_reads_only_the_layout` | For all byte strings up to 134 bytes: no panic, and a count comes only from the v4 layout, at the offset that the rent collector sets |

Each proof also has `kani::cover!` checks for its important cases (for example a hinted config
authority that passes). All are satisfied, so no proof passes because its cases are unreachable.

**Bounds and models.** A proof holds within these limits:

- **Members:** up to 2 for each multisig (3 after a change). The comparisons are the same for
  longer lists, element by element. `mirror` clones the members, and a clone of a symbolic length
  needs more than 30 GB of memory in CBMC. Thus `mirror_copies_the_governance` and
  `a_mirrored_successor_passes_the_governance_check` run once for each count (`no_members`,
  `one_member`, `two_members`), each with a constant length. Together they cover the same counts.
- **Addresses:** two symbolic bytes, other bytes zero. The code only compares addresses, and the
  PDA stub reads only bytes 0 and 1. Thus two bytes give every equality pattern that the code can
  see.
- **PDA derivation:** a stub replaces `get_vault_pda`, because SHA-256 is out of reach of the
  solver. The stub is deterministic and gives a different address for each index. The proofs
  therefore assume R9 (different seeds give different addresses), as section 6 does.
- **Loops:** each loop has a fixed bound, and Kani checks that the bound is large enough
  (unwinding assertions). The 32-byte `memcmp` has its own bound of 33.

**No effect on the program.** The proofs compile only under `cargo kani` (`cfg(kani)`). The
module declaration is the last item of `migration.rs`, so it does not move line numbers that
Anchor stores in error locations. Check: the SBF binaries (default and `testing` builds) and the
IDL are byte-identical to the builds before the change.

### 10.3 Property tests of the account readers

The readers decode accounts of other programs at fixed offsets. A wrong read can only cause a skip
or a failed CPI, because the other program checks the authority again. The tests show that the
reads are correct:

- **Any bytes:** no reader panics (`proptest`, 256 cases for each property; the TS test uses 500
  seeded random buffers).
- **Official encoders:** `solana-stake-interface`, `solana-vote-interface` (all state versions),
  `solana-loader-v3-interface` and `spl-token-2022-interface` encode random accounts. Each reader
  must return the encoded values. The mints have random Token-2022 extensions in a random order,
  with each authority held by the vault, another key or nobody.
- **One fixture for TS and Rust:** the Rust test writes deterministic cases to
  `sdk/rs/tests/fixtures/account_readers.json` (`UPDATE_FIXTURES=1`), and the TS readers must give
  the same values.
- **The tests find errors:** a change of one offset in a reader (stake custodian, vote state
  version, Token-2022 extension field, delegated amount) fails them.

The generators are in `programs/squads_multisig_program/tests/support/accounts.rs`. They are test
code only: the SBF binaries and the IDL do not change.

### 10.4 Open work

1. **External audit** of `src/instructions/migrate/`, `multisig_create_from.rs` and
   `src/migration.rs`, with this document as the specification.
