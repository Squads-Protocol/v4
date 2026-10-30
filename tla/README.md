# Squads multisig 4r TLA+ specifications

These specifications describe the multisig account, its proposals and transactions, and its vault
as one state machine, and the migration from v4 (successor creation, governance check, creation
fee, stake roles). TLC, the TLA+ model checker, checks them. They do not describe message
compilation, account metas, address lookup tables, or account sizes. The Anchor integration tests
check those parts.

| Module | Scope | Main source files (`programs/squads_multisig_program/src/`) |
| --- | --- | --- |
| `Multisig.tla` | One multisig: members, permissions, threshold, time lock, config authority, stale index; vault, config, and batch transactions; proposals and votes; execution, including inner instructions that the vault signs; rent reclaim; one spending limit | `state/{multisig,proposal,batch}.rs`, `instructions/proposal_*.rs`, `instructions/{vault,config}_transaction_*.rs`, `instructions/batch_*.rs`, `instructions/multisig_config.rs`, `instructions/transaction_accounts_close.rs`, `utils/executable_transaction_message.rs` |
| `SpendingLimit.tla` | The budget arithmetic of one spending limit over real times: lazy reset, `last_reset` alignment, one-time limits | `instructions/spending_limit_use.rs`, `state/spending_limit.rs` |
| `Migration.tla` | The move from v4 or v3: one source multisig, its 4r successor, config changes on both sides, a squatter, the creation fee and its approved cap, and the assets of one source vault (v4 vault or v3 authority) | `migration.rs`, `migration/v3.rs`, `instructions/multisig_create_from.rs`, `instructions/multisig_create_from_v3.rs`, `instructions/migrate/`, `instructions/program_config.rs` |
| `MigrationStake.tla` | One stake account and `multisig_migrate_stakes`: the staker, withdrawer and lockup custodian roles, the Stake program signer rules, lockups that start and end, and the order of the CPIs | `instructions/migrate/stakes.rs` |

## The consensus contract

The model checks the program against these rules.

Voting:

- Only a member with Vote can approve, reject, or cancel.
- A proposal becomes Approved when `threshold` keys approve it.
- A proposal becomes Rejected when `cutoff` keys reject it. `cutoff = voters - threshold + 1`
  (`Multisig::cutoff`). At that point, approval is no longer possible.
- `threshold + cutoff = voters + 1`. So when every voter has voted, the proposal is decided, and
  it cannot reach both quorums.
- A voter can change an approval to a rejection, and the reverse, while the proposal is Active.
- A proposal becomes Cancelled when `threshold` members cancel it. Only an Approved proposal can be
  cancelled.

Stale transactions (`invalidate_prior_transactions`):

- A change of members, permissions, threshold, time lock, or config authority makes all earlier
  transactions stale. A change of the rent collector or of a spending limit does not.
- A stale proposal cannot be activated, approved, or rejected.
- A stale Approved config transaction cannot execute.
- A stale Approved vault transaction or batch can still execute (Neodyme ND-SQD1-M2).
- A stale Approved proposal can be cancelled.

Execution:

- A member with Execute executes an Approved proposal when its age is at least the current time
  lock.
- A vault message runs inner instructions that the vault signs. `execute_message` rejects the
  outer proposal (and batch) as a writable account (`protected_accounts`).
- Anchor writes back the outer copy of the proposal (and batch) after the inner instructions.
- A batch executes its entries one at a time, in order. The last entry makes the proposal Executed.

Rent reclaim (anyone can send these instructions, when `rent_collector` is set):

- A transaction and its proposal close together.
- A final proposal (Rejected, Cancelled, Executed) can close.
- A Draft or Active proposal, or a transaction with no proposal, can close only when stale.
- An Approved config proposal can close when stale. An Approved vault or batch proposal cannot
  close, because it can still execute.
- Batch entries close from the last to the first. The batch closes when it has no entries.

Spending limits:

- A key in `spending_limit.members` spends from the vault with no vote. It does not need to be a
  member of the multisig.
- Each reset window moves at most `amount`.

Migration from v4 or v3 (`Migration.tla`, `MigrationStake.tla`; the safety argument is
`MIGRATION_SAFETY.md`). The model is the same for both lineages: v3 also keeps approved
transactions after a config change, and both creation instructions read the source at execution.

- Only `multisig_create_from` (signed by a v4 vault) or `multisig_create_from_v3` (signed by a v3
  authority) creates the successor. Nobody can sign as its `create_key` (the source multisig PDA).
- Each `multisig_migrate_*` instruction moves an item only while the successor has the same
  governance as the source multisig (`check_same_governance`, `check_same_governance_v3`).
- The v4 vault pays a creation fee only up to the `max_creation_fee` that the members approved,
  although the program config authority can change the fee at any time.
- A stake migration never fails for a missing signature, gives roles only to the successor vault,
  and leaves a role with the v4 vault only in two cases: a withdrawer under a lockup that another
  party holds as custodian (`Locked`), and a custodian without a lockup in force and with another
  withdrawer (it has no power then).

## Run the checks

You need Java 11 or later and `tla2tools.jar` from the
[TLA+ releases](https://github.com/tlaplus/tlaplus/releases). The script uses the
`-noGenerateSpecTE` option. The nightly build (TLC 2026.10.20) has it; the 2024 release build
(TLC 2.19) does not. The repository does not add a dependency.

```sh
export TLA2TOOLS_JAR=/path/to/tla2tools.jar
bash tla/check.sh               # all models except the slow one
bash tla/check.sh Batch         # models whose name contains "Batch"
CHECK_SLOW=1 bash tla/check.sh  # also Multisig.cfg (about 2.5 minutes)
```

The script runs each model in a temporary directory, so the repository stays clean.
Each model has an expected result. `pass` means that TLC finds no error.
`fail` means that TLC must find a violation: a reachability witness, a design behavior, or a finding.
The script exits with code 1 when a result is different from its expected result.

To run one model directly:

```sh
cd tla
java -XX:+UseParallelGC -cp "$TLA2TOOLS_JAR" tlc2.TLC -workers auto \
  -config MultisigCancelVoters.cfg Multisig.tla
```

TLC writes a counterexample trace to standard output. Without `-noGenerateSpecTE`, it also writes trace
files next to the spec; do not commit these files.

| Config | Expected | Checks |
| --- | --- | --- |
| `Multisig.cfg` (slow) | pass | Safety, autonomous 2-of-3, vault and config transactions, every config change that can succeed, two transactions that interact through staleness |
| `MultisigPair.cfg` | pass | The same safety checks for a 2-of-2 multisig (cutoff 1) |
| `MultisigBatch.cfg` | pass | Safety with batches of two entries next to config transactions: Draft adds, ordered execution, stale execution, entry close |
| `MultisigControlled.cfg` | pass | Safety, controlled multisig: the config authority adds, removes, and changes members, threshold, time lock, and rent collection while votes are pending, and can make the multisig autonomous |
| `MultisigVault.cfg` | pass | Safety when the vault is a member and the config authority: vault messages approve, execute other transactions, and change the config inside one execution |
| `MultisigLive.cfg` | pass | Liveness: an Active proposal is decided or becomes stale; an Approved proposal is executed or cancelled (a config transaction can become stale) |
| `MultisigReach.cfg` | fail | Witness: execution, rejection, and cancellation are all reachable |
| `MultisigUnprotected.cfg` | fail | Regression model: without `protected_accounts`, a message re-enters its own execution and executes twice |
| `MultisigStaleVault.cfg` | fail | Design D1: a stale Approved vault transaction executes |
| `MultisigOrphan.cfg` | fail | Finding F1: a new proposal for a closed transaction index |
| `MultisigCancelVoters.cfg` | fail | Finding F2: a cancellation by a member without Vote counts |
| `MultisigStall.cfg` | fail | Finding F3: an Approved batch with no entries stays Approved |
| `MultisigLimit.cfg` | fail | Design D2: a removed member spends from a spending limit |
| `SpendingLimit.cfg` | pass | Reset alignment, remaining = amount - window use, window budget, 2 * amount per closed span |
| `SpendingLimitOneTime.cfg` | pass | A one-time limit moves at most `amount` in total |
| `SpendingLimitSliding.cfg` | fail | Design D3: 2 * amount can move in less than one period, across a window edge |
| `Migration.cfg` | pass | Only `multisig_create_from` creates the successor; every migrate runs with equal governance; a migrate gives Eve an asset only when Eve already rules v4; the v4 vault never pays a creation fee above the approved cap |
| `MigrationSquatContained.cfg` | pass | Defense in depth: if someone could squat the successor, the governance check still stops theft |
| `MigrationReach.cfg` | fail | Witness: every asset can reach the successor |
| `MigrationSquat.cfg` | fail | Regression model: with a create key that someone can sign (for example the v4 `create_key`), a squatter creates the successor |
| `MigrationDrift.cfg` | fail | Regression model: without `check_same_governance`, the successor drifts to Eve, and a v4 migrate moves assets to her |
| `MigrationFee.cfg` | fail | Regression model: without the `max_creation_fee` check, the fee rises after the approval, and `multisig_create_from` pays more than the members approved |
| `MigrationStake.cfg` | pass | Any roles and lockups, and changes by every holder between calls: a stake migration never fails for a missing signature, leaves no movable role behind, and gives roles only to the successor |
| `MigrationStakeReach.cfg` | fail | Witness: every stake role can reach the successor |
| `MigrationStakeOrder.cfg` | fail | Regression model: if the custodian always moved after the withdrawer, a stake without a lockup in force makes the instruction fail (`SetLockup` needs the withdrawer, which is already the successor) |
| `MigrationStakeCustodian.cfg` | fail | Regression model: the program before 2026-10-23 did not move the custodian, so the v4 vault kept it |

## Verification status

Results of TLC 2026.10.20 (nightly) on Java 21, on a 16-core laptop, 2026-10-21. All configurations gave
the expected result.

| Config | Result | Distinct states | Time |
| --- | --- | --- | --- |
| `Multisig.cfg` | pass | 14,663,787 | 2 min 23 s |
| `MultisigPair.cfg` | pass | 265,455 | 2 s |
| `MultisigBatch.cfg` | pass | 183,659 | 2 s |
| `MultisigControlled.cfg` | pass | 2,409,516 | 14 s |
| `MultisigVault.cfg` | pass | 2,123,450 | 17 s |
| `MultisigLive.cfg` | pass | 352,117 | 24 s |
| `MultisigReach.cfg` | fail (expected: `NotAllOutcomes`) | 38,877 | 1 s |
| `MultisigUnprotected.cfg` | fail (expected: `ExecuteAtMostOnce`) | 33 | less than 1 s |
| `MultisigStaleVault.cfg` | fail (expected: `NoStaleVaultExecution`, D1) | 15,610 | 1 s |
| `MultisigOrphan.cfg` | fail (expected: `NoOrphanProposal`, F1) | 30 | 1 s |
| `MultisigCancelVoters.cfg` | fail (expected: `CancelQuorumOfVoters`, F2) | 75,417 | 1 s |
| `MultisigStall.cfg` | fail (expected: `ApprovedSettlesStrict`, F3) | 193 | less than 1 s |
| `MultisigLimit.cfg` | fail (expected: `LimitOnlyForMembers`, D2) | 23,580 | 1 s |
| `SpendingLimit.cfg` | pass | 205,024 | 1 s |
| `SpendingLimitOneTime.cfg` | pass | 285 | less than 1 s |
| `SpendingLimitSliding.cfg` | fail (expected: `SlidingBudget`, D3) | 200 | 1 s |

Results of TLC 2026.10.23 (nightly) on Java 21, 2026-10-23. A full run of `check.sh` (with
`CHECK_SLOW=1`) gave the expected result for all 26 configurations. The `Multisig*` and
`SpendingLimit*` configs gave the same distinct-state counts as above for the `pass` rows
(`Multisig.cfg`: 2 min 12 s). The migration configs:

| Config | Result | Distinct states | Time |
| --- | --- | --- | --- |
| `Migration.cfg` | pass | 378 | less than 1 s |
| `MigrationSquatContained.cfg` | pass | 1,026 | less than 1 s |
| `MigrationReach.cfg` | fail (expected: `NotAllMigrated`) | 277 | 1 s |
| `MigrationSquat.cfg` | fail (expected: `SuccessorFromLineage`) | 18 | less than 1 s |
| `MigrationDrift.cfg` | fail (expected: `NoTheftByMigration`) | 374 | less than 1 s |
| `MigrationFee.cfg` | fail (expected: `NoFeeAboveApproval`) | 114 | 1 s |
| `MigrationStake.cfg` | pass | 54 | less than 1 s |
| `MigrationStakeReach.cfg` | fail (expected: `NotAllMoved`) | 54 | less than 1 s |
| `MigrationStakeOrder.cfg` | fail (expected: `MigrateNeverReverts`) | 63 | 1 s |
| `MigrationStakeCustodian.cfg` | fail (expected: `NoRoleLeftBehind`) | 60 | less than 1 s |

TLC stops at the first violation, so the distinct-state counts of the `fail` rows are partial.

## Audit inputs

The formal verification reports in `audits/` give most of the properties. The Certora rules are
Solana Prover rules on single instructions. The TLA+ properties check the same claims over
sequences of instructions, and add consensus properties that no report states.

Note: `certora_..._verification.pdf` and `certora_..._2024.pdf` contain the same October 2023 report
(the second adds a December 2023 appendix). `certora_..._2024_final.pdf` is the November 2024 report.

| TLA+ property | Audit source |
| --- | --- |
| `MultisigValid` | Certora rules 1–2, P-02; OtterSec multisig invariant; ToB time-lock bound |
| `FreshMeansUnchanged` | Certora rules 3–4, P-03, P-12; TOB-SQUADS-4. The TLA+ property is stronger: a transaction that is not stale was created under the current consensus parameters |
| `TransitionsLegal` | Certora automaton (2023 p.23, 2024 p.18); rules 10, 11, 15, 19–22, 28; P-07 |
| `VoteGate` | Certora rule 11 (quorum, cutoff, not stale) |
| `CancelGate` | Certora rule 15 (`cancelled` reaches threshold) |
| `ExecuteGate` | Certora rules 15, 22, 28 (time lock; config not stale); Neodyme ND-SQD1-M2 |
| `CloseGate` | Certora P-11 and the December 2023 appendix, items 5–8 |
| `NoEarlyVotes` | Certora P-07 (`cancelled` is empty while Active) |
| `BatchOrder`, `BatchApproved` | Certora rules 22, 26; OtterSec batch invariant |
| `ExecuteAtMostOnce`, `MultisigUnprotected.cfg` | Neodyme ND-SQD1-I2; OtterSec OS-SQD-SUG-02 (protected accounts, PR #24) |
| `ConfigOnlyAutonomous`, `AutonomousPermanent` | Certora P-04, P-05; OtterSec ConfigTransactionCreate |
| `PaymentsAuthorized` | ToB project goals; OtterSec signature uniqueness |
| `MultisigReach.cfg` | Certora reachability rules 12–18, 23–25, 29–36 |
| `ActiveDecides`, `ApprovedSettles` | Stronger than the Certora reachability rules: the outcome occurs under fairness, not only "can occur" |
| `FullVoteDecides`, `ActiveUndecided`, `DecisionsHaveQuorum`, `VotesFromVoters`, `DecisionDurable` | New consensus properties; no report states them |
| `SpendingLimit.tla` | ToB appendix C (reset rule); OtterSec spending-limit invariant |
| `MultisigLimit.cfg` | Neodyme ND-SQD2-I1; Certora final p.4 (non-members can use a spending limit) |

The 4r program does not write the `Executing` status (`state/proposal.rs`, deprecated). The Neodyme
fix used it to stop re-entry. Protected accounts replace it. The model has no `Executing` status, and
`MultisigUnprotected.cfg` shows that the protected-account check is necessary.

## Map from model to code

| Model action | Code |
| --- | --- |
| `CreateVault`, `CreateConfig`, `CreateBatch` | `vault_transaction_create`, `config_transaction_create` (autonomous only), `batch_create` |
| `Propose` | `proposal_create`: index ≤ `transaction_index`, not stale, Initiate or Vote; Draft or Active |
| `Activate` | `proposal_activate` |
| `Approve`, `Reject`, `Cancel` | `proposal_approve`, `proposal_reject`, `proposal_cancel` / `proposal_cancel_v2` (`retain(is_member)`) |
| `BatchAdd` | `batch_add_transaction`: creator only, Draft only |
| `Execute` | `vault_transaction_execute`, `config_transaction_execute`, `batch_execute_transaction` |
| `Inner`, `Nested` | `execute_message` and the inner instructions that the vault signs |
| `Authority` | `multisig_add_member`, `multisig_remove_member`, `multisig_change_threshold`, `multisig_set_time_lock`, `multisig_set_config_authority`, `multisig_set_rent_collector` |
| `ApplyAction` | the `ConfigAction` loop of `config_transaction_execute`, and the matching authority instructions |
| `CloseTx`, `CloseBatchEntry`, `CloseBatch` | `{config,vault}_transaction_accounts_close`, `vault_batch_transaction_account_close`, `batch_accounts_close` |
| `SpendLimit`, `ResetLimit` | `spending_limit_use`; `AddSpendingLimit` / `RemoveSpendingLimit` and `multisig_{add,remove}_spending_limit` |
| `Tick` | `Clock::unix_timestamp` minus the Approved timestamp |
| `Valid` | `Multisig::invariant` |
| `ApproveCreate` | The v4 members approve `multisig_create_from` with `max_creation_fee` (the planners use the fee at planning time) |
| `CreateFrom` | `multisig_create_from` (`multisig_create_from_v3`): Anchor `init` at the successor PDA; `migration::mirror` (`mirror_v3`) reads the source at execution; the fee is read at execution and must not exceed `max_creation_fee` (`MigrationCreationFeeTooHigh`) |
| `SetFee` | `program_config_set_multisig_creation_fee` |
| `Squat` | `multisig_create_v2` at the successor address; disabled because v4 never signs as a multisig PDA, and v3 signs as one only in CPIs to itself |
| `Migrate` | any `multisig_migrate_*` or `multisig_migrate_v3_*` instruction: successor must exist, the governance check (`MigrationAccounts::begin` or `MigrationAccountsV3::begin`), then the move |
| `V4Config`, `SuccConfig` | any config change of either multisig (config transaction or config authority) |
| `MigrationStake!Migrate` | `MultisigMigrateStakes::migrate_stake`: staker, then the custodian first (no lockup in force, vault also withdrawer), then the withdrawer (skip `Locked`), then the custodian (lockup in force) |
| `MigrationStake!Act`, `Expire` | Stake `Authorize` and `SetLockup` by any holder outside the migration; the end of a lockup |
| `CanAuthStaker`, `CanAuthWithdrawer`, `CanSetLockup` | The signer rules of the Stake program |

## Scope

The models leave out these code paths. The checks do not verify them.

| Code path | Reason |
| --- | --- |
| Transaction buffers (`transaction_buffer_*`, `vault_transaction_create_from_buffer`) | They make a vault transaction with the same rules. Certora H-01, L-01, L-02 and Neodyme ND-SQD3-LO-01 cover their addressing. |
| Message validation and account metas (`new_validated`, signer and writable flags, lookup tables) | Byte-level checks. OtterSec Kani proofs, OS-SQD-ADV-00, and Certora SQ-001 / SQ-004 cover them. |
| Ephemeral signers (TOB-SQUADS-8) | An entry that fails blocks the later entries; the model shows a blocked entry as a step that cannot occur. |
| Account sizes and `realloc_if_needed` (Certora P-06, OS-SQD-ADV-01, SQ-006) | The model has no sizes or lamport amounts. |
| Program config | It does not change consensus. `Migration.tla` models only its creation fee, which `multisig_create_from` pays from a v4 vault. |
| Events (`log_event`) | They do not change state. |
| More than one vault index, more than one multisig | The vault seeds hold the multisig key (OtterSec signature uniqueness). |
| Inner instructions to other programs | `pay` stands for any value that leaves the vault. |
| Migration asset details (amounts, skips, token programs, vault hints, PDA derivation, the six asset classes) | `Migration.tla` checks the design: lineage, mirror, governance and the fee cap. `MigrationStake.tla` checks the stake roles. The Kani proofs (`src/migration/proofs.rs`) check `map_vault`, `mirror` and `check_same_governance`. `tests/migration.rs` and `sdk/multisig-4r/test/integration/v4-migration.test.ts` (with the mainnet v4 program) check the rest. |

## Abstractions and limits

- The configs use two or three keys, at most three transaction indexes, and batches of at most two
  entries. Each config bounds `transaction_index` with `MaxTx`.
- Time is the age of each Approved proposal, saturated at `MaxLock` (`MAX_TIME_LOCK`). The time lock
  is 0 or `MaxLock`.
- A vault message is a list of ops: `pay`, `approve` of another proposal, `exec` of another vault
  transaction, and one config authority instruction. A nested `exec` makes only the payments of the
  other message: the program that the vault calls re-enters once and does not re-enter again.
- `config_transaction_execute` with an `AddMember` of a key that is already a member pushes a
  duplicate, which the final `invariant()` rejects. A later `RemoveMember` of the same key in the same
  transaction can remove one copy, so the transaction can succeed. The model reverts at once on a
  duplicate add. No menu has that action pair.
- Config menus contain the changes that each config needs. `Multisig.cfg` has every remove, every
  threshold, and the time-lock change. `MultisigControlled.cfg` also adds a key with all
  permissions. `MultisigCancelVoters.cfg` removes a key and adds it back without Vote.
- `MultisigControlled.cfg` has one transaction index, because the authority can change the config
  without bound. One pending transaction is enough to check that each authority change makes it stale.
- `MultisigLive.cfg` uses only changes that always execute, and vault messages that only pay. A
  message that always fails keeps its proposal Approved; the model does not count this as a defect.
- The rent collector is on or off; lamport amounts are not modeled.
- `Multisig.tla` has one spending limit with unit payments. A reset is one step. `SpendingLimit.tla`
  checks the real reset arithmetic for one limit created at time 0.
- Symmetry over the keys reduces the safety configs. The liveness configs do not use symmetry.
- `Migration.tla` replaces members, permissions, threshold, time lock and config authority with one
  governance value, and an asset with its location. It does not model pending successor
  transactions that members approved under an earlier governance (V4.5_REVISED.md 11.3, "Limit").
  The Kani proof `the_check_passes_exactly_for_equal_governance` connects this abstraction to the
  code: `check_same_governance` passes exactly when the field tuples are equal, so "same
  governance value" in the model is the same condition as in the program.
- One `Migrate` step stands for one item of any of the six asset classes. The classes use the same
  successor and governance checks (`MigrationAccounts::begin`), so they do not change these
  properties.
- The creation fee takes the values 0, 1 and 2. The members approve the fee that they see; then the
  fee can change before the execution.
- `MigrationStake.tla` has one stake and three holders: the v4 vault, the successor vault, and one
  other party. Lockup times and epochs are one flag, "in force", which a `SetLockup` can set and
  which ends with `Expire`.

## Findings

Each finding has a config that reproduces it. Integration tests confirm F1 and F2 against the
program (`tests/suites/instructions/proposalCreateAfterClose.ts`, `proposalCancelVotePermission.ts`).
They record the current behavior; change them when a finding is fixed.

### F1: a proposal can be created again for a closed transaction index (informational)

`MultisigOrphan.cfg` violates `NoOrphanProposal` in five steps:

1. A member creates vault transaction 1 and its proposal.
2. A member rejects it (2-of-2, so cutoff is 1). The proposal is Rejected.
3. Anyone closes the transaction and the proposal (`vault_transaction_accounts_close`).
4. A member sends `proposal_create` for index 1 again. It succeeds.

`proposal_create` checks only `transaction_index <= multisig.transaction_index` and
`transaction_index > stale_transaction_index`. It does not check that the transaction account exists.
The close instruction removed the proposal account, so `init` makes a new Active proposal.

Effects:

- The new proposal cannot execute: each execute instruction loads the closed transaction account.
- The new proposal cannot close: each close instruction loads the transaction account. Its rent
  stays locked. `MultisigLive.cfg` found this as a liveness violation: an orphan proposal can become
  Approved and stay Approved forever. `ApprovedSettles` excludes it.
- An indexer that reads the proposal PDA sees Active or Approved for an index whose decision was
  Rejected, Cancelled, or Executed. The program emits a proposal Create event for that index.
- `DecisionDurable` holds: a decision does not change while the transaction account exists.

The test `proposalCreateAfterClose.ts` confirms each step and both failures (`AccountNotInitialized`).

Only a member with Initiate or Vote can do this, and it pays the rent. A fix can make
`proposal_create` take the transaction account and require that it is a live account of this multisig.

### F2: a cancellation counts members that no longer hold Vote (low)

`MultisigCancelVoters.cfg` violates `CancelQuorumOfVoters` in 11 steps (2-of-3, keys a, b, c):

1. Vault transaction 1 is Approved by a and b. Member a cancels it.
2. Config transaction 2 removes a and adds a back without Vote. It executes, so transaction 1 is
   stale but stays Approved (it can still execute).
3. Member b cancels transaction 1. `cancelled.retain(is_member)` keeps a, because a is still a member.
   `cancelled` = {a, b}, which reaches threshold 2. The status becomes Cancelled.

Only one current voter (b) cancelled. The current voters are b and c. `proposal_cancel` checks Vote
for the key that sends the instruction, but `retain` keeps the earlier votes of every member. A member
that is removed and added back keeps its earlier cancellation too.

Cancellation stops an execution, so this error makes the protective action easier, not harder. It
also makes the minority cancel griefing of Neodyme ND-SQD1-I1 a little easier.
The test `proposalCancelVotePermission.ts` confirms this trace: a can no longer cancel
(`Unauthorized`), but its earlier cancellation still counts.
`tests/suites/instructions/cancelRealloc.ts` tests a removed member only. A fix can retain the keys
for which `member_has_permission(key, Permission::Vote)` is true.

### F3: an Approved batch with no entries stays Approved (informational)

`MultisigStall.cfg` violates `ApprovedSettlesStrict`:

1. A member creates a batch.
2. A member creates its proposal as Active, not Draft. `batch_add_transaction` requires Draft, so the
   batch can never get an entry.
3. The voters approve it.

`batch_execute_transaction` loads entry 1, which does not exist, so the batch cannot execute.
`batch_accounts_close` and `vault_batch_transaction_account_close` never close an Approved batch,
also when it is stale. Only a cancellation by `threshold` members ends it. Any member with Initiate or
Vote can create the proposal of another member's batch as Active (OtterSec OS-SQD-ADV-02 limited
this to members). Before approval, the batch is only unusable: its creator makes a new batch.

## Design behaviors

These are documented behaviors. Each one has a witness config, so a change in the code shows up.

- **D1: a stale Approved vault transaction executes** (`MultisigStaleVault.cfg`). This is the Neodyme
  ND-SQD1-M2 policy. After a member removal, members must cancel the earlier Approved vault
  transactions and batches that they no longer want.
- **D2: spending-limit keys need no membership** (`MultisigLimit.cfg`). A member that the multisig
  removes can still spend, until a config change removes the spending limit (Neodyme ND-SQD2-I1).
- **D3: spending-limit windows are fixed** (`SpendingLimitSliding.cfg`). Uses at the end of one window
  and at the start of the next move 2 * amount in less than one period. `SpanBudget` proves the bound
  of 2 * amount for each closed span [mP, (m + 1)P].
- **R1: protected accounts are necessary** (`MultisigUnprotected.cfg`). Without them, a message calls a
  program that re-enters `vault_transaction_execute` for the same transaction, and the transaction
  executes twice. The code has the check; the config is a regression model.

## Change the specifications

Update `Multisig.tla` when you change one of these behaviors:

- Vote rules, quorum, cutoff, or cancellation: `CanApprove`, `DoApprove`, `CanReject`, `DoReject`,
  `CanCancel`, `DoCancel`.
- Stale rules or config actions: `Invalidate`, `ApplyAction`, `AuthApply`, `Valid`.
- Execution, protected accounts, or batches: `CanExecute`, `ExecVault`, `ExecBatch`, `ExecConfig`, `Inner`.
- Rent reclaim: `CloseOk` and the close actions.

Update `SpendingLimit.tla` when you change the reset rule of `spending_limit_use`.

Update `Migration.tla` when you change the successor creation, the governance check, or the fee
check of `multisig_create_from`. Update `MigrationStake.tla` when you change the order of the CPIs in
`instructions/migrate/stakes.rs`, or when the Stake program changes its signer rules.

Then run `check.sh`. When a finding is fixed, change its expected result to `pass` in `check.sh`.
