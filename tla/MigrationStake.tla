------------------------- MODULE MigrationStake -------------------------
(***************************************************************************)
(* One stake account and multisig_migrate_stakes. The stake has three      *)
(* roles: staker, withdrawer and lockup custodian. Each role is held by    *)
(* the v4 vault, the successor vault, or another party. The Stake program  *)
(* decides which signatures each change needs, and the successor vault     *)
(* cannot sign while v4 executes the migration. So the order of the CPIs   *)
(* matters: a CPI that lacks a signature fails the whole instruction, and  *)
(* a failed batch entry blocks the entries after it.                       *)
(*                                                                         *)
(* Source of truth:                                                        *)
(*   programs/squads_multisig_program/src/instructions/migrate/stakes.rs   *)
(*     migrate_stake: staker, then the custodian first when no lockup is   *)
(*     in force and the vault is also the withdrawer, then the withdrawer, *)
(*     then the custodian when a lockup is in force                        *)
(*   Stake program (solana-stake-program) signer rules:                    *)
(*     Authorize staker: the staker or the withdrawer signs                *)
(*     Authorize withdrawer: the withdrawer signs, and the custodian too   *)
(*       while a lockup is in force                                        *)
(*     SetLockup: the custodian signs while a lockup is in force, else the *)
(*       withdrawer                                                        *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS
    MoveCustodian,   \* the program moves the lockup custodian (since 2026-10-23)
    CustodianFirst   \* without a lockup in force, the custodian moves before the withdrawer

ASSUME MoveCustodian \in BOOLEAN /\ CustodianFirst \in BOOLEAN

Roles   == {"staker", "withdrawer", "custodian"}
Holders == {"v4", "succ", "other"}

VARIABLES
    role,         \* the holder of each role
    inForce,      \* a lockup is in force (lockup time or epoch in the future)
    reverted,     \* history: a migrate CPI lacked a signature, so the instruction failed
    leftBehind,   \* history: a migrate left a role with the v4 vault that it should move
    misdirected   \* history: a migrate gave a role to a holder other than the successor

vars == <<role, inForce, reverted, leftBehind, misdirected>>

TypeOK ==
    /\ role \in [Roles -> Holders]
    /\ inForce \in BOOLEAN
    /\ reverted \in BOOLEAN /\ leftBehind \in BOOLEAN /\ misdirected \in BOOLEAN

\* Stake program signer rules. `signers` holds the holders that sign.
CanAuthStaker(r, signers)           == r.staker \in signers \/ r.withdrawer \in signers
CanAuthWithdrawer(r, lock, signers) == r.withdrawer \in signers /\ (lock => r.custodian \in signers)
CanSetLockup(r, lock, signers)      == IF lock THEN r.custodian \in signers ELSE r.withdrawer \in signers

Init ==
    /\ role \in [Roles -> {"v4", "other"}]
    /\ inForce \in BOOLEAN
    /\ reverted = FALSE /\ leftBehind = FALSE /\ misdirected = FALSE

\* The lockup ends (time or epoch passes).
Expire ==
    /\ inForce
    /\ inForce' = FALSE
    /\ UNCHANGED <<role, reverted, leftBehind, misdirected>>

\* Any holder changes a role outside the migration, as the Stake program allows:
\* the other party, an approved v4 vault transaction, or a 4r vault transaction.
\* SetLockup can also start a new lockup.
Act(p) ==
    /\ \E h \in Holders :
         \/ /\ CanAuthStaker(role, {p})
            /\ role' = [role EXCEPT !.staker = h] /\ UNCHANGED inForce
         \/ /\ CanAuthWithdrawer(role, inForce, {p})
            /\ role' = [role EXCEPT !.withdrawer = h] /\ UNCHANGED inForce
         \/ /\ CanSetLockup(role, inForce, {p})
            /\ role' = [role EXCEPT !.custodian = h] /\ inForce' \in BOOLEAN
    /\ UNCHANGED <<reverted, leftBehind, misdirected>>

\* multisig_migrate_stakes for this stake, signed by the v4 vault only. Each
\* CPI checks the signer rules against the roles after the earlier CPIs.
Migrate ==
    LET v      == {"v4"}
        isS    == role.staker = "v4"
        isW    == role.withdrawer = "v4"
        isC    == role.custodian = "v4"
        first  == MoveCustodian /\ CustodianFirst /\ ~inForce /\ isC /\ isW
        \* 1. Authorize staker.
        ok1    == ~isS \/ CanAuthStaker(role, v)
        r1     == IF isS THEN [role EXCEPT !.staker = "succ"] ELSE role
        \* 2. SetLockup before the withdrawer (no lockup in force).
        ok2    == ~first \/ CanSetLockup(r1, inForce, v)
        r2     == IF first THEN [r1 EXCEPT !.custodian = "succ"] ELSE r1
        \* 3. Authorize withdrawer; skipped (Locked) under a lockup that another custodian holds.
        doW    == isW /\ ~(inForce /\ ~isC)
        ok3    == ~doW \/ CanAuthWithdrawer(r2, inForce, v)
        r3     == IF doW THEN [r2 EXCEPT !.withdrawer = "succ"] ELSE r2
        \* 4. SetLockup after the withdrawer: under a lockup in force (or always, in the old order).
        doC    == MoveCustodian /\ isC /\ ~first /\ (inForce \/ ~CustodianFirst)
        ok4    == ~doC \/ CanSetLockup(r3, inForce, v)
        r4     == IF doC THEN [r3 EXCEPT !.custodian = "succ"] ELSE r3
        \* The documented skips: Locked, and a custodian without power (no lockup, other withdrawer).
        missed == \/ r4.staker = "v4"
                  \/ r4.withdrawer = "v4" /\ ~(inForce /\ ~isC)
                  \/ r4.custodian = "v4" /\ ~(~inForce /\ ~isW)
    IN  /\ isS \/ isW \/ isC
        /\ IF ok1 /\ ok2 /\ ok3 /\ ok4
           THEN /\ role' = r4
                /\ leftBehind' = (leftBehind \/ missed)
                /\ misdirected' = (misdirected \/ \E x \in Roles : r4[x] # role[x] /\ r4[x] # "succ")
                /\ UNCHANGED <<inForce, reverted>>
           ELSE /\ reverted' = TRUE
                /\ UNCHANGED <<role, inForce, leftBehind, misdirected>>

Next ==
    \/ Expire
    \/ \E p \in Holders : Act(p)
    \/ Migrate

Spec == Init /\ [][Next]_vars

(***************************************************************************)
(* Properties                                                              *)
(***************************************************************************)

\* The order of the CPIs always has the signatures that the Stake program needs.
MigrateNeverReverts == ~reverted

\* After a migrate, the v4 vault holds no role that the program should move.
NoRoleLeftBehind == ~leftBehind

\* A migrate gives a role only to the successor vault.
OnlyToSuccessor == ~misdirected

\* Witness (must be violated): every role can reach the successor.
NotAllMoved == \E x \in Roles : role[x] # "succ"
=============================================================================
