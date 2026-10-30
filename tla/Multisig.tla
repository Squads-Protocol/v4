------------------------------ MODULE Multisig ------------------------------
(***************************************************************************)
(* One Squads multisig 4r account, its transactions and proposals, and     *)
(* vault 0. Members vote on each transaction. A transaction executes when  *)
(* `threshold` voters approve it. It is rejected when `cutoff` voters      *)
(* reject it, where cutoff = |voters| - threshold + 1: the point at which  *)
(* approval becomes impossible.                                            *)
(*                                                                         *)
(* Source of truth (programs/squads_multisig_program/src/):                *)
(*   state/multisig.rs        invariant, invalidate_prior_transactions,    *)
(*                            cutoff, add_member, remove_member            *)
(*   state/proposal.rs        approve, reject, cancel, ProposalStatus      *)
(*   instructions/proposal_{create,activate,vote}.rs                       *)
(*   instructions/{vault,config}_transaction_{create,execute}.rs           *)
(*   instructions/batch_{create,add_transaction,execute_transaction}.rs    *)
(*   instructions/multisig_config.rs     config authority instructions     *)
(*   instructions/multisig_{add,remove}_spending_limit.rs                  *)
(*   instructions/spending_limit_use.rs  (budget only; SpendingLimit.tla)  *)
(*   instructions/transaction_accounts_close.rs   rent reclaim             *)
(*   utils/executable_transaction_message.rs  protected_accounts           *)
(*                                                                         *)
(* One instruction is one step. A failed instruction reverts, so it is no  *)
(* step. The on-chain state is one record, `st`, so that a vault message   *)
(* can run several inner instructions (CPIs) in sequence inside one step.  *)
(* The vault signs only inside a vault or batch execution. A vault         *)
(* message is a list of inner ops: pay (move value out of the vault),      *)
(* approve a proposal, execute another vault transaction, or a config      *)
(* authority instruction. Time is the age of each Approved proposal in     *)
(* ticks, saturated at MaxLock (MAX_TIME_LOCK).                            *)
(***************************************************************************)
EXTENDS Naturals, FiniteSets, Sequences, TLC

CONSTANTS
    Keys,           \* human signer keys (model values)
    Vault,          \* the vault PDA of vault_index 0 (model value)
    Admin,          \* a config authority key that is not a member
    None,           \* Pubkey::default()
    InitMembers,    \* members at multisig_create; each has all permissions
    InitThreshold,
    InitAuthority,  \* None (autonomous), Admin, or Vault (controlled)
    MaxTx,          \* bound on transaction_index
    MaxBatch,       \* bound on batch size
    MaxLock,        \* largest time lock, in ticks (MAX_TIME_LOCK)
    Kinds,          \* transaction kinds: subset of {"vault", "config", "batch"}
    ConfigMenu,     \* action lists that config_transaction_create may store
    AuthMenu,       \* actions that the config authority may send
    VaultMenu,      \* messages that vault transactions and batch entries may store
    SLMembers,      \* keys listed in the spending limit (not tied to membership)
    SLAmount,       \* spending limit amount, in payments
    Protect         \* execute_message rejects protected accounts as writable

Actors   == Keys \cup {Vault}
Perms    == {"initiate", "vote", "execute"}
Index    == 1..MaxTx
Slots    == 1..MaxBatch
Statuses == {"none", "draft", "active", "approved", "rejected", "cancelled", "executed"}
Final    == {"rejected", "cancelled", "executed"}

ASSUME /\ InitMembers \subseteq Actors
       /\ InitAuthority \in {None, Admin, Vault}
       /\ Kinds \subseteq {"vault", "config", "batch"}
       /\ SLMembers \subseteq Keys
       /\ Protect \in BOOLEAN
       /\ MaxBatch \in Nat \ {0}

----------------------------------------------------------------------------
(* Config actions and vault ops. All have one record shape, so that TLC    *)
(* can compare any two of them.                                            *)

Act(t, k, p, n) == [t |-> t, k |-> k, p |-> p, n |-> n]
Add(k, p)       == Act("add", k, p, 0)
Remove(k)       == Act("remove", k, {}, 0)
Threshold(n)    == Act("threshold", None, {}, n)
TimeLock(n)     == Act("timelock", None, {}, n)
SetAuthority(k) == Act("authority", k, {}, 0)
SetRent(n)      == Act("rent", None, {}, n)
AddLimit        == Act("addSL", None, {}, 0)
RemoveLimit     == Act("removeSL", None, {}, 0)
NoAct           == Act("none", None, {}, 0)

Op(t, j, a)  == [t |-> t, j |-> j, a |-> a]
Pay          == Op("pay", 0, NoAct)
VApprove(j)  == Op("approve", j, NoAct)
VExecute(j)  == Op("exec", j, NoAct)
VAuthority(a) == Op("auth", 0, a)

\* Menus that the configs select with `ConfigMenu <- ...`.
Singles(S)       == {<<a>> : a \in S}
NonVoter         == {"initiate", "execute"}
ConsensusActions == {Remove(k) : k \in Keys} \cup {Add(k, Perms) : k \in Keys}
                    \cup {Threshold(n) : n \in 1..Cardinality(Keys)}
                    \cup {TimeLock(n) : n \in 0..MaxLock}
\* Remove a key and add it back without Vote: a permission change.
DemoteMenu       == {<<Remove(k), Add(k, NonVoter)>> : k \in Keys}
ConsensusMenu    == Singles(ConsensusActions)
\* Changes that can succeed when every key is a member.
ChangeMenu       == Singles({Remove(k) : k \in Keys} \cup {Threshold(n) : n \in 1..Cardinality(Keys)}
                            \cup {TimeLock(MaxLock)})
LimitMenu        == Singles({AddLimit, RemoveLimit})
PayMenu          == {<<Pay>>}
\* A message that pays and then re-enters execution of transaction j.
ReentryMenu      == {<<Pay, VExecute(j)>> : j \in Index}
VoteMenu         == {<<VApprove(j)>> : j \in Index}
\* The vault as config authority: a time lock change, then an execution.
VaultAuthMenu    == {<<VAuthority(TimeLock(0)), VExecute(j)>> : j \in Index}
                    \cup Singles({VAuthority(a) : a \in ConsensusActions \cup {SetAuthority(None)}})

\* Every inner op that a vault member and config authority can send.
VaultActorMenu   == PayMenu \cup ReentryMenu \cup VoteMenu \cup VaultAuthMenu
\* Every instruction of a config authority.
AdminMenu        == ConsensusActions \cup {SetAuthority(None), SetRent(0), SetRent(1)}
\* Changes that execute in every state of MultisigLive.cfg.
SafeChangeMenu   == Singles({Threshold(1), TimeLock(MaxLock)})
\* Spending-limit changes and the removal of a member.
LimitChangeMenu  == LimitMenu \cup Singles({Remove(k) : k \in Keys})

\* Keys are interchangeable when the menus treat them alike (safety only).
Symmetry == Permutations(Keys)

----------------------------------------------------------------------------
(* Account records                                                         *)

\* Proposal. `age` counts ticks since approval (the Approved timestamp).
NoProp == [status |-> "none", ap |-> {}, rj |-> {}, cn |-> {}, age |-> 0]
\* Transaction (VaultTransaction, ConfigTransaction, or Batch). `live` is
\* FALSE after rent reclaim closes it. `params` is history: the consensus
\* parameters when it was created. For a batch, `msg` is the list of entry
\* messages, `size` = batch.size and `exec` = executed_transaction_index.
NoTx   == [kind |-> "none", live |-> FALSE, msg |-> <<>>, size |-> 0, exec |-> 0,
           creator |-> None, params |-> <<>>]

VARIABLE st

Params(s)    == <<s.mem, s.perm, s.threshold, s.lock, s.authority>>
Voters(s)    == {k \in s.mem : "vote" \in s.perm[k]}
Has(s, k, p) == k \in s.mem /\ p \in s.perm[k]
Cutoff(s)    == Cardinality(Voters(s)) - s.threshold + 1
Stale(s, i)  == i <= s.stale

\* Multisig::invariant (unique keys and mask < 8 hold by construction).
Valid(s) ==
    /\ \E k \in s.mem : "initiate" \in s.perm[k]
    /\ \E k \in s.mem : "execute" \in s.perm[k]
    /\ Voters(s) # {}
    /\ s.threshold \in 1..Cardinality(Voters(s))
    /\ s.stale <= s.txi
    /\ s.lock <= MaxLock

InitState ==
    [mem |-> InitMembers,
     perm |-> [k \in Actors |-> IF k \in InitMembers THEN Perms ELSE {}],
     threshold |-> InitThreshold, lock |-> 0, authority |-> InitAuthority,
     rent |-> TRUE, txi |-> 0, stale |-> 0,
     tx |-> [i \in Index |-> NoTx], prop |-> [i \in Index |-> NoProp],
     sl |-> [on |-> FALSE, rem |-> 0],
     \* History: a key that is not a member spent from the spending limit.
     slOutsider |-> FALSE,
     \* History: payments out of the vault by executed messages.
     paid |-> 0,
     \* History: executions of each transaction (batch entry n uses slot n).
     runs |-> [i \in Index |-> [n \in Slots |-> 0]],
     \* History: the first final status of each transaction index.
     decided |-> [i \in Index |-> "none"]]

ASSUME Valid(InitState)

----------------------------------------------------------------------------
(* Pure state functions. A result is [ok, s]; ok = FALSE means a revert.   *)

R(ok, s) == [ok |-> ok, s |-> s]

SetStatus(s, i, x) ==
    [s EXCEPT !.prop[i].status = x,
              !.decided[i] = IF x \in Final /\ @ = "none" THEN x ELSE @]

Invalidate(s) == [s EXCEPT !.stale = s.txi]

\* Proposal::approve. It removes an earlier rejection by the same key.
CanApprove(s, k, i) ==
    /\ Has(s, k, "vote")
    /\ s.prop[i].status = "active"
    /\ ~Stale(s, i)
    /\ k \notin s.prop[i].ap
DoApprove(s, k, i) ==
    LET ap == s.prop[i].ap \cup {k}
        t  == [s EXCEPT !.prop[i].ap = ap, !.prop[i].rj = @ \ {k}]
    IN  IF Cardinality(ap) >= s.threshold THEN SetStatus(t, i, "approved") ELSE t

\* Proposal::reject, with Multisig::cutoff.
CanReject(s, k, i) ==
    /\ Has(s, k, "vote")
    /\ s.prop[i].status = "active"
    /\ ~Stale(s, i)
    /\ k \notin s.prop[i].rj
DoReject(s, k, i) ==
    LET rj == s.prop[i].rj \cup {k}
        t  == [s EXCEPT !.prop[i].rj = rj, !.prop[i].ap = @ \ {k}]
    IN  IF Cardinality(rj) >= Cutoff(s) THEN SetStatus(t, i, "rejected") ELSE t

\* proposal_cancel: `cancelled.retain(is_member)`, then Proposal::cancel.
\* A stale Approved proposal can be cancelled.
CanCancel(s, k, i) ==
    /\ Has(s, k, "vote")
    /\ s.prop[i].status = "approved"
    /\ k \notin (s.prop[i].cn \cap s.mem)
DoCancel(s, k, i) ==
    LET cn == (s.prop[i].cn \cap s.mem) \cup {k}
        t  == [s EXCEPT !.prop[i].cn = cn]
    IN  IF Cardinality(cn) >= s.threshold THEN SetStatus(t, i, "cancelled") ELSE t

\* One ConfigAction (config_transaction_execute loop body). Adding a key
\* that is already a member makes a duplicate, which the final invariant
\* rejects; the model reverts at once (see README, abstractions).
ApplyAction(s, a) ==
    CASE a.t = "add" ->
           IF a.k \in s.mem THEN R(FALSE, s)
           ELSE R(TRUE, Invalidate([s EXCEPT !.mem = @ \cup {a.k}, !.perm[a.k] = a.p]))
      [] a.t = "remove" ->
           IF a.k \notin s.mem THEN R(FALSE, s)
           ELSE R(TRUE, Invalidate([s EXCEPT !.mem = @ \ {a.k}, !.perm[a.k] = {}]))
      [] a.t = "threshold" -> R(TRUE, Invalidate([s EXCEPT !.threshold = a.n]))
      [] a.t = "timelock"  -> R(TRUE, Invalidate([s EXCEPT !.lock = a.n]))
      [] a.t = "authority" -> R(TRUE, Invalidate([s EXCEPT !.authority = a.k]))
      [] a.t = "rent"      -> R(TRUE, [s EXCEPT !.rent = (a.n = 1)])
      [] a.t = "addSL" ->
           IF s.sl.on THEN R(FALSE, s)
           ELSE R(TRUE, [s EXCEPT !.sl = [on |-> TRUE, rem |-> SLAmount]])
      [] a.t = "removeSL" ->
           IF s.sl.on THEN R(TRUE, [s EXCEPT !.sl.on = FALSE]) ELSE R(FALSE, s)

RECURSIVE RunActions(_, _)
RunActions(s, as) ==
    IF as = <<>> THEN R(TRUE, s)
    ELSE LET r == ApplyAction(s, Head(as))
         IN  IF r.ok THEN RunActions(r.s, Tail(as)) ELSE r

\* multisig_config.rs and multisig_{add,remove}_spending_limit.rs: one
\* action, then invariant(). remove_member needs more than one member.
AuthApply(s, a) ==
    LET r == ApplyAction(s, a)
    IN  IF /\ r.ok /\ Valid(r.s)
           /\ (a.t = "remove" => Cardinality(s.mem) > 1)
        THEN r ELSE R(FALSE, s)

CanExecute(s, k, i, kind) ==
    /\ Has(s, k, "execute")
    /\ s.tx[i].kind = kind
    /\ s.tx[i].live
    /\ s.prop[i].status = "approved"
    /\ s.prop[i].age >= s.lock

Run(s, i, n) == [s EXCEPT !.runs[i][n] = @ + 1]
Pays(m)      == Cardinality({n \in 1..Len(m) : m[n].t = "pay"})

\* protected_accounts: an inner instruction cannot take the outer proposal
\* (or batch) as writable. Every modeled inner op on index j writes
\* proposal j.
Writable(i, j) == ~Protect \/ i # j

\* An inner vault_transaction_execute of j. The program that the message
\* calls re-enters at most once: the nested run makes the payments of j.
Nested(s, j) ==
    Run(SetStatus([s EXCEPT !.paid = @ + Pays(s.tx[j].msg)], j, "executed"), j, 1)

\* One inner op of the message of transaction i, signed by the vault.
Inner(s, i, o) ==
    CASE o.t = "pay" -> R(TRUE, [s EXCEPT !.paid = @ + 1])
      [] o.t = "approve" ->
           IF Writable(i, o.j) /\ CanApprove(s, Vault, o.j)
           THEN R(TRUE, DoApprove(s, Vault, o.j)) ELSE R(FALSE, s)
      [] o.t = "exec" ->
           IF Writable(i, o.j) /\ CanExecute(s, Vault, o.j, "vault")
           THEN R(TRUE, Nested(s, o.j)) ELSE R(FALSE, s)
      [] o.t = "auth" ->
           IF s.authority = Vault THEN AuthApply(s, o.a) ELSE R(FALSE, s)

RECURSIVE RunOps(_, _, _)
RunOps(s, i, ops) ==
    IF ops = <<>> THEN R(TRUE, s)
    ELSE LET r == Inner(s, i, Head(ops))
         IN  IF r.ok THEN RunOps(r.s, i, Tail(ops)) ELSE r

\* vault_transaction_execute. Anchor writes back the outer copy of the
\* proposal (the only mutable account) after execute_message.
ExecVault(s, i) ==
    LET r    == RunOps(s, i, s.tx[i].msg)
        back == [r.s EXCEPT !.prop[i] = s.prop[i]]
    IN  IF r.ok THEN R(TRUE, Run(SetStatus(back, i, "executed"), i, 1)) ELSE r

\* batch_execute_transaction runs entry exec + 1. The outer copies of the
\* proposal and the batch are written back.
ExecBatch(s, i) ==
    LET b    == s.tx[i]
        n    == b.exec + 1
        r    == RunOps(s, i, b.msg[n])
        back == [r.s EXCEPT !.prop[i] = s.prop[i], !.tx[i] = [b EXCEPT !.exec = n]]
        done == IF n = b.size THEN SetStatus(back, i, "executed") ELSE back
    IN  IF r.ok THEN R(TRUE, Run(done, i, n)) ELSE r

\* config_transaction_execute: all actions, then one invariant() check.
ExecConfig(s, i) ==
    LET r == RunActions(s, s.tx[i].msg)
    IN  IF r.ok /\ Valid(r.s)
        THEN R(TRUE, Run(SetStatus(r.s, i, "executed"), i, 1))
        ELSE R(FALSE, s)

\* transaction_accounts_close.rs: the status table of all four close
\* instructions. A stale Approved proposal blocks the close of a vault
\* transaction or batch, because it can still execute.
CloseOk(s, i) ==
    LET p == s.prop[i].status IN
    CASE p \in {"none", "draft", "active"} -> Stale(s, i)
      [] p = "approved" -> Stale(s, i) /\ s.tx[i].kind = "config"
      [] p \in Final    -> TRUE

----------------------------------------------------------------------------
(* Instructions                                                            *)

Do(r) == r.ok /\ st' = r.s

NewTx(kind, m, k) ==
    LET i == st.txi + 1 IN
    /\ kind \in Kinds
    /\ Has(st, k, "initiate")
    /\ st.txi < MaxTx
    /\ st' = [st EXCEPT !.txi = i,
                        !.tx[i] = [kind |-> kind, live |-> TRUE, msg |-> m, size |-> 0,
                                   exec |-> 0, creator |-> k, params |-> Params(st)]]

CreateVault(k, m)  == NewTx("vault", m, k)
\* config_transaction_create: autonomous multisigs only.
CreateConfig(k, m) == st.authority = None /\ NewTx("config", m, k)
CreateBatch(k)     == NewTx("batch", <<>>, k)

\* proposal_create does not check that the transaction account still exists.
Propose(k, i, draft) ==
    /\ i <= st.txi
    /\ ~Stale(st, i)
    /\ st.prop[i].status = "none"
    /\ Has(st, k, "initiate") \/ Has(st, k, "vote")
    /\ st' = [st EXCEPT !.prop[i] = [NoProp EXCEPT !.status = IF draft THEN "draft" ELSE "active"]]

Activate(k, i) ==
    /\ Has(st, k, "initiate")
    /\ st.prop[i].status = "draft"
    /\ ~Stale(st, i)
    /\ st' = [st EXCEPT !.prop[i].status = "active"]

Approve(k, i) == CanApprove(st, k, i) /\ st' = DoApprove(st, k, i)
Reject(k, i)  == CanReject(st, k, i) /\ st' = DoReject(st, k, i)
Cancel(k, i)  == CanCancel(st, k, i) /\ st' = DoCancel(st, k, i)

\* Only the batch creator adds entries, and only while the proposal is Draft.
BatchAdd(k, i, m) ==
    /\ st.tx[i].kind = "batch"
    /\ st.tx[i].live
    /\ k = st.tx[i].creator
    /\ Has(st, k, "initiate")
    /\ st.prop[i].status = "draft"
    /\ st.tx[i].size < MaxBatch
    /\ st' = [st EXCEPT !.tx[i].msg = Append(@, m), !.tx[i].size = @ + 1]

\* A stale Approved vault transaction or batch can execute; a stale config
\* transaction cannot.
Execute(k, i) ==
    \/ CanExecute(st, k, i, "vault") /\ Do(ExecVault(st, i))
    \/ CanExecute(st, k, i, "config") /\ ~Stale(st, i) /\ Do(ExecConfig(st, i))
    \/ CanExecute(st, k, i, "batch") /\ st.tx[i].exec < st.tx[i].size /\ Do(ExecBatch(st, i))

\* The config authority instructions of a controlled multisig.
Authority(a) == st.authority = Admin /\ Do(AuthApply(st, a))

\* Rent reclaim. Anyone can send these instructions.
CloseTx(i) ==
    /\ st.rent
    /\ st.tx[i].live
    /\ st.tx[i].kind \in {"vault", "config"}
    /\ CloseOk(st, i)
    /\ st' = [st EXCEPT !.tx[i].live = FALSE, !.prop[i] = NoProp]

\* vault_batch_transaction_account_close: the last entry; needs a proposal.
CloseBatchEntry(i) ==
    /\ st.rent
    /\ st.tx[i].kind = "batch"
    /\ st.tx[i].live
    /\ st.prop[i].status # "none"
    /\ st.tx[i].size > 0
    /\ CloseOk(st, i)
    /\ st' = [st EXCEPT !.tx[i].size = @ - 1, !.tx[i].msg = SubSeq(@, 1, Len(@) - 1)]

\* batch_accounts_close: all entries closed first.
CloseBatch(i) ==
    /\ st.rent
    /\ st.tx[i].kind = "batch"
    /\ st.tx[i].live
    /\ st.tx[i].size = 0
    /\ CloseOk(st, i)
    /\ st' = [st EXCEPT !.tx[i].live = FALSE, !.prop[i] = NoProp]

\* spending_limit_use: any listed key, no vote, no membership check.
SpendLimit(k) ==
    /\ k \in SLMembers
    /\ st.sl.on
    /\ st.sl.rem > 0
    /\ st' = [st EXCEPT !.sl.rem = @ - 1, !.slOutsider = @ \/ k \notin st.mem]

\* A period passes (SpendingLimit.tla checks the reset arithmetic).
ResetLimit == st.sl.on /\ st.sl.rem < SLAmount /\ st' = [st EXCEPT !.sl.rem = SLAmount]

\* Time passes for every Approved proposal.
Tick ==
    /\ \E i \in Index : st.prop[i].status = "approved" /\ st.prop[i].age < MaxLock
    /\ st' = [st EXCEPT !.prop = [i \in Index |->
                 IF @[i].status = "approved" /\ @[i].age < MaxLock
                 THEN [@[i] EXCEPT !.age = @ + 1] ELSE @[i]]]

Init == st = InitState

Next ==
    \/ \E k \in Keys :
         \/ \E m \in VaultMenu : CreateVault(k, m)
         \/ \E m \in ConfigMenu : CreateConfig(k, m)
         \/ CreateBatch(k)
         \/ SpendLimit(k)
         \/ \E i \in Index :
              \/ \E d \in BOOLEAN : Propose(k, i, d)
              \/ Activate(k, i) \/ Approve(k, i) \/ Reject(k, i) \/ Cancel(k, i)
              \/ Execute(k, i)
              \/ \E m \in VaultMenu : BatchAdd(k, i, m)
    \/ \E a \in AuthMenu : Authority(a)
    \/ \E i \in Index : CloseTx(i) \/ CloseBatchEntry(i) \/ CloseBatch(i)
    \/ Tick
    \/ ResetLimit

\* Voters eventually vote, executors eventually execute, and time passes.
\* A voter can change its vote, so a vote step is always enabled for it.
\* Proposal creation, cancellation, and config changes are not fair.
Fairness ==
    /\ WF_st(Tick)
    /\ \A k \in Keys, i \in Index :
         WF_st(Approve(k, i) \/ Reject(k, i)) /\ WF_st(Execute(k, i))

Spec == Init /\ [][Next]_st /\ Fairness

----------------------------------------------------------------------------
(* Safety: the multisig account                                            *)

TypeOK ==
    /\ st.mem \subseteq Actors
    /\ st.perm \in [Actors -> SUBSET Perms]
    /\ st.authority \in {None, Admin, Vault}
    /\ st.txi \in 0..MaxTx /\ st.stale \in 0..MaxTx
    /\ st.lock \in 0..MaxLock
    /\ \A i \in Index :
         /\ st.prop[i].status \in Statuses
         /\ {st.prop[i].ap, st.prop[i].rj, st.prop[i].cn} \subseteq SUBSET Actors
         /\ st.prop[i].age \in 0..MaxLock
         /\ st.tx[i].kind \in {"none", "vault", "config", "batch"}
         /\ st.tx[i].size \in 0..MaxBatch /\ st.tx[i].exec \in 0..MaxBatch
         /\ \A n \in Slots : st.runs[i][n] \in 0..2
         /\ st.decided[i] \in {"none"} \cup Final

\* Multisig::invariant holds in every reachable state (Certora P-02).
MultisigValid == Valid(st)

\* Indexes 1..transaction_index each hold one transaction; no index is reused.
UniqueIndex ==
    \A i \in Index :
        /\ (st.tx[i].kind # "none") = (i <= st.txi)
        /\ st.prop[i].status # "none" => i <= st.txi

\* Stale tracking is complete: a transaction that is not stale was created
\* under the current members, permissions, threshold, time lock, and
\* config authority (Certora P-03, P-12).
FreshMeansUnchanged ==
    \A i \in Index : (i <= st.txi /\ ~Stale(st, i)) => st.tx[i].params = Params(st)

\* A config transaction exists only in an autonomous multisig.
ConfigOnlyAutonomous ==
    \A i \in Index : st.tx[i].kind = "config" => st.authority = None

----------------------------------------------------------------------------
(* Safety: proposals and votes                                             *)

VoteSetsDisjoint == \A i \in Index : st.prop[i].ap \cap st.prop[i].rj = {}

\* Draft has no votes; Draft and Active have no cancellations (Certora P-07).
NoEarlyVotes ==
    \A i \in Index :
        /\ st.prop[i].status = "draft" => st.prop[i].ap \cup st.prop[i].rj = {}
        /\ st.prop[i].status \in {"draft", "active"} => st.prop[i].cn = {}

\* The votes of a proposal that is not stale come from current voters.
VotesFromVoters ==
    \A i \in Index :
        (st.prop[i].status \in {"active", "approved", "rejected"} /\ ~Stale(st, i))
            => st.prop[i].ap \cup st.prop[i].rj \subseteq Voters(st)

\* An Active proposal has neither quorum (Certora rule 14).
ActiveUndecided ==
    \A i \in Index :
        (st.prop[i].status = "active" /\ ~Stale(st, i))
            => Cardinality(st.prop[i].ap) < st.threshold
               /\ Cardinality(st.prop[i].rj) < Cutoff(st)

\* Full participation decides: when every voter has voted, the proposal is
\* no longer Active. threshold + cutoff = |voters| + 1.
FullVoteDecides ==
    \A i \in Index :
        (st.prop[i].status = "active" /\ ~Stale(st, i))
            => ~(Voters(st) \subseteq st.prop[i].ap \cup st.prop[i].rj)

\* Decisions keep their quorum while the proposal is not stale.
DecisionsHaveQuorum ==
    \A i \in Index :
        /\ (st.prop[i].status = "approved" /\ ~Stale(st, i))
             => Cardinality(st.prop[i].ap) >= st.threshold
        /\ (st.prop[i].status = "rejected" /\ ~Stale(st, i))
             => Cardinality(st.prop[i].rj) >= Cutoff(st)

\* A final decision does not change while its transaction account exists.
DecisionDurable ==
    \A i \in Index :
        (st.tx[i].live /\ st.decided[i] # "none") => st.prop[i].status = st.decided[i]

\* The 4r program never writes the deprecated Executing status.
Edges ==
    {<<"none", "draft">>, <<"none", "active">>, <<"draft", "active">>,
     <<"active", "approved">>, <<"active", "rejected">>,
     <<"approved", "cancelled">>, <<"approved", "executed">>}
    \cup {<<x, "none">> : x \in Statuses \ {"none"}}

\* The proposal automaton (Certora 2023 p.23, 2024 p.18).
TransitionsLegal ==
    [][\A i \in Index :
         st'.prop[i].status = st.prop[i].status
         \/ <<st.prop[i].status, st'.prop[i].status>> \in Edges]_st

\* Votes decide only a proposal that is not stale, at its quorum (rule 11).
VoteGate ==
    [][\A i \in Index :
         /\ (st.prop[i].status = "active" /\ st'.prop[i].status = "approved")
              => ~Stale(st, i) /\ Cardinality(st'.prop[i].ap) >= st.threshold
         /\ (st.prop[i].status = "active" /\ st'.prop[i].status = "rejected")
              => ~Stale(st, i) /\ Cardinality(st'.prop[i].rj) >= Cutoff(st)]_st

\* Cancellation needs `threshold` cancellations by current members (rule 15).
CancelGate ==
    [][\A i \in Index :
         (st.prop[i].status = "approved" /\ st'.prop[i].status = "cancelled")
            => Cardinality(st'.prop[i].cn \cap st.mem) >= st.threshold]_st

\* Rent reclaim closes only what can never execute (Certora P-11).
CloseGate ==
    [][\A i \in Index :
         /\ (st.tx[i].live /\ ~st'.tx[i].live)
              => st.rent /\ CloseOk(st, i) /\ st'.prop[i].status = "none"
         /\ (st.prop[i].status # "none" /\ st'.prop[i].status = "none")
              => st.tx[i].live /\ ~st'.tx[i].live]_st

----------------------------------------------------------------------------
(* Safety: execution and the vault                                         *)

\* Execution needs Approved, the time lock, a live account, and for a
\* config transaction, a proposal that is not stale (rules 15, 22, 28).
\* An inner config authority op can lower the time lock first.
ExecuteGate ==
    [][\A i \in Index :
         (st.prop[i].status = "approved" /\ st'.prop[i].status = "executed")
            => /\ st.tx[i].live
               /\ st.prop[i].age >= st.lock \/ st.prop[i].age >= st'.lock
               /\ st.tx[i].kind = "config" => ~Stale(st, i)
               /\ st.tx[i].kind = "batch" => st'.tx[i].exec = st'.tx[i].size]_st

\* Each transaction, and each batch entry, executes at most once.
ExecuteAtMostOnce == \A i \in Index, n \in Slots : st.runs[i][n] <= 1

\* Batch entries execute in order: entry n ran iff n <= executed index.
BatchOrder ==
    \A i \in Index :
        st.tx[i].kind = "batch" => \A n \in Slots : (st.runs[i][n] > 0) = (n <= st.tx[i].exec)

\* An Approved batch has an executable entry, or it is empty and stuck.
BatchApproved ==
    \A i \in Index :
        (st.tx[i].kind = "batch" /\ st.prop[i].status = "approved")
            => st.tx[i].exec < st.tx[i].size \/ st.tx[i].size = 0

\* Content cannot change after creation; a batch is frozen after Draft.
ContentFrozen ==
    [][\A i \in Index :
         st.tx[i].kind # "none" =>
            /\ st'.tx[i].kind = st.tx[i].kind
            /\ st'.tx[i].params = st.tx[i].params
            /\ st'.tx[i].creator = st.tx[i].creator
            /\ ~st.tx[i].live => st'.tx[i] = st.tx[i]
            /\ st.tx[i].kind # "batch" => st'.tx[i].msg = st.tx[i].msg
            /\ st.prop[i].status \in {"active", "approved"} /\ st'.tx[i].live
                 => st'.tx[i].msg = st.tx[i].msg \/ Stale(st, i)]_st

\* Value leaves the vault by consensus only in a step that runs an
\* Approved transaction (spending limits are counted apart: sl.rem).
PaymentsAuthorized ==
    [][st'.paid > st.paid =>
         \E i \in Index : st.prop[i].status = "approved" /\ st'.runs[i] # st.runs[i]]_st

\* An autonomous multisig stays autonomous.
AutonomousPermanent == [][st.authority = None => st'.authority = None]_st

----------------------------------------------------------------------------
(* Liveness (MultisigLive.cfg)                                             *)

\* With every voter voting, an Active proposal is decided or becomes stale.
ActiveDecides ==
    \A i \in Index :
        (st.prop[i].status = "active" /\ ~Stale(st, i))
            ~> (st.prop[i].status # "active" \/ Stale(st, i))

\* An Approved proposal is executed or cancelled; a config transaction can
\* instead become stale. Two cases are excluded: an empty Approved batch
\* (finding F3) and a proposal with no transaction account (finding F1).
ApprovedSettles ==
    \A i \in Index :
        (/\ st.prop[i].status = "approved"
         /\ st.tx[i].live
         /\ ~(st.tx[i].kind = "batch" /\ st.tx[i].size = 0))
            ~> (st.prop[i].status \in {"executed", "cancelled"}
                \/ (st.tx[i].kind = "config" /\ Stale(st, i)))

\* The same property without the batch exclusion. MultisigStall.cfg
\* violates it.
ApprovedSettlesStrict ==
    \A i \in Index :
        (st.prop[i].status = "approved" /\ st.tx[i].live)
            ~> (st.prop[i].status \in {"executed", "cancelled"}
                \/ (st.tx[i].kind = "config" /\ Stale(st, i)))

----------------------------------------------------------------------------
(* Witnesses and findings. Each config that checks one of these expects a  *)
(* violation; see README.md.                                               *)

\* Reachability: execution, rejection, and cancellation all occur.
NotAllOutcomes ==
    ~({"executed", "rejected", "cancelled"} \subseteq {st.decided[i] : i \in Index})

\* Design (Neodyme ND-SQD1-M2): a stale Approved vault transaction executes.
NoStaleVaultExecution ==
    [][\A i \in Index :
         (st.prop[i].status = "approved" /\ st'.prop[i].status = "executed")
            => ~Stale(st, i)]_st

\* Finding F1: after rent reclaim, a proposal can be created again for the
\* closed index, with no transaction account behind it.
NoOrphanProposal ==
    \A i \in Index : st.prop[i].status # "none" => st.tx[i].live

\* Finding F2: cancellation counts members that no longer hold Vote.
CancelQuorumOfVoters ==
    [][\A i \in Index :
         (st.prop[i].status = "approved" /\ st'.prop[i].status = "cancelled")
            => Cardinality(st'.prop[i].cn \cap Voters(st)) >= st.threshold]_st

\* Design (Neodyme ND-SQD2-I1): spending-limit keys need no membership.
LimitOnlyForMembers == ~st.slOutsider

=============================================================================
