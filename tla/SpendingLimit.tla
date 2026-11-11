---------------------------- MODULE SpendingLimit ----------------------------
(***************************************************************************)
(* The budget arithmetic of one SpendingLimit account over time.           *)
(* Multisig.tla abstracts a period to one reset step; this module checks  *)
(* the reset rule of the code with real integer times.                    *)
(*                                                                         *)
(* Source of truth (programs/squads_multisig_program/src/):                *)
(*   instructions/spending_limit_use.rs  reset, then checked_sub           *)
(*   state/spending_limit.rs             invariant, Period::to_seconds     *)
(*   instructions/config_transaction_execute.rs  AddSpendingLimit:         *)
(*                                       remaining = amount, last_reset = now *)
(*                                                                         *)
(* The limit is created at time 0. Each use can happen at any time and     *)
(* moves any amount. The reset is lazy: it happens inside a use, when more *)
(* than one period has passed since last_reset.                            *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS
    Amount,   \* spending_limit.amount (> 0)
    Period,   \* Period::to_seconds, in ticks
    OneTime,  \* Period::OneTime: never resets
    MaxNow    \* clock bound for model checking

ASSUME Amount \in Nat \ {0} /\ Period \in Nat \ {0} /\ OneTime \in BOOLEAN /\ MaxNow \in Nat

Times == 0..MaxNow

VARIABLES
    now,      \* Clock::unix_timestamp
    last,     \* last_reset
    rem,      \* remaining_amount
    spentAt,  \* history: the amount moved at each time
    spentIn   \* history: the amount moved in each reset window

\* Reset window m starts at last_reset = m * Period. Its uses happen at times
\* in [m * Period, (m + 1) * Period]: a use at exactly last_reset + Period
\* still belongs to the old window (passed > Period), and a use after a gap
\* of two or more periods can open a window at its own start time.
Windows == 0..(MaxNow \div Period)

vars == <<now, last, rem, spentAt, spentIn>>

Init ==
    /\ now = 0
    /\ last = 0
    /\ rem = Amount
    /\ spentAt = [t \in Times |-> 0]
    /\ spentIn = [m \in Windows |-> 0]

\* spending_limit_use: reset when passed > period, then subtract.
Use(x) ==
    LET passed == now - last
        reset  == ~OneTime /\ passed > Period
        avail  == IF reset THEN Amount ELSE rem
        anchor == IF reset THEN last + (passed \div Period) * Period ELSE last
    IN  /\ x <= avail
        /\ rem' = avail - x
        /\ last' = anchor
        /\ spentAt' = [spentAt EXCEPT ![now] = @ + x]
        /\ spentIn' = [spentIn EXCEPT ![anchor \div Period] = @ + x]
        /\ UNCHANGED now

Tick == now < MaxNow /\ now' = now + 1 /\ UNCHANGED <<last, rem, spentAt, spentIn>>

Next == Tick \/ \E x \in 1..Amount : Use(x)

----------------------------------------------------------------------------

RECURSIVE SumOver(_)
SumOver(S) == IF S = {} THEN 0
              ELSE LET t == CHOOSE u \in S : TRUE IN spentAt[t] + SumOver(S \ {t})

TypeOK ==
    /\ now \in Times /\ last \in Times
    /\ rem \in 0..Amount
    /\ spentAt \in [Times -> 0..(Amount * (MaxNow + 1))]
    /\ spentIn \in [Windows -> 0..(Amount * (MaxNow + 1))]

\* last_reset stays at creation time plus whole periods, and not in the future.
ResetAligned == last <= now /\ last % Period = 0

\* remaining_amount = amount minus what the window of last_reset used.
Accounting == ~OneTime => rem + spentIn[last \div Period] = Amount

\* No reset window moves more than `amount`.
WindowBudget == \A m \in Windows : spentIn[m] <= Amount

\* In each closed span [mP, (m + 1)P], uses move at most 2 * amount: the
\* span can hold the end of one window and all of the next.
SpanBudget ==
    \A m \in Windows :
        SumOver({t \in Times : m * Period <= t /\ t <= (m + 1) * Period}) <= 2 * Amount

\* A one-time limit moves at most `amount` in total.
OneTimeBudget == OneTime => SumOver(Times) <= Amount

\* Witness (expected violation): the windows are fixed, not sliding. Uses at
\* the end of one window and the start of the next move 2 * amount in less
\* than one period.
SlidingBudget ==
    \A t \in Times : SumOver({u \in Times : t <= u /\ u < t + Period}) <= Amount

=============================================================================
