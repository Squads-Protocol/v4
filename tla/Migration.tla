---------------------------- MODULE Migration ----------------------------
(***************************************************************************)
(* The v4 -> 4r migration: one v4 multisig, its 4r successor, and the     *)
(* assets of one v4 vault. A governance value stands for the members,     *)
(* permissions, threshold, time lock and config authority; whoever rules  *)
(* that governance acts for the multisig.                                 *)
(*                                                                         *)
(* Source of truth (programs/squads_multisig_program/src/):                *)
(*   migration.rs                     successor PDA, mirror, governance check *)
(*   instructions/multisig_create_from.rs  init at the successor PDA, fee  *)
(*   instructions/migrate/            governance check, then move (each    *)
(*                                    multisig_migrate_* instruction)      *)
(*   instructions/program_config.rs   the creation fee can change any time *)
(*                                                                         *)
(* All instructions run inside v4 vault transactions, so each step is a    *)
(* v4 consensus action. They read the state when they execute: an approved *)
(* v4 vault transaction can execute after the v4 config changes (stale     *)
(* vault transactions still execute), so approval time does not matter,    *)
(* except for the creation fee: the members approve max_creation_fee, and  *)
(* the fee is read at execution. Config changes on either side are any     *)
(* value: members can rotate keys, also to a key that Eve holds.           *)
(* One Migrate step stands for one item of any asset class; the six        *)
(* instructions share the successor and governance checks                 *)
(* (MigrationAccounts::begin). MigrationStake.tla models the stake roles.  *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS
    Assets,           \* assets of the v4 vault (token balances, authorities)
    Govs,             \* governance values
    EveGovs,          \* the governance values that Eve rules
    CheckGovernance,  \* multisig_migrate_* runs check_same_governance
    SquatPossible,    \* someone can sign as the successor create_key
    Fees,             \* creation fees that the program config authority can set
    FeeCap            \* multisig_create_from fails when the fee is above max_creation_fee

ASSUME /\ EveGovs \subseteq Govs /\ CheckGovernance \in BOOLEAN /\ SquatPossible \in BOOLEAN
       /\ Fees \subseteq Nat /\ Fees # {} /\ FeeCap \in BOOLEAN

None == "none"

VARIABLES
    v4Gov,      \* governance of the v4 multisig
    succGov,    \* governance of the successor, or None before it exists
    creator,    \* "none", "lineage" (multisig_create_from) or "squatter" (multisig_create_v2)
    loc,        \* where each asset is: "v4" (v4 vault) or "succ" (successor vault)
    fee,        \* program_config.multisig_creation_fee
    approved,   \* the members approved a multisig_create_from
    cap,        \* its max_creation_fee
    drifted,    \* history: a migrate moved an asset while the two governances differed
    theft,      \* history: a migrate moved an asset to Eve while Eve did not rule v4
    overpaid    \* history: the v4 vault paid a fee above the approved max_creation_fee

vars == <<v4Gov, succGov, creator, loc, fee, approved, cap, drifted, theft, overpaid>>

TypeOK ==
    /\ v4Gov \in Govs
    /\ succGov \in Govs \cup {None}
    /\ creator \in {"none", "lineage", "squatter"}
    /\ loc \in [Assets -> {"v4", "succ"}]
    /\ fee \in Fees
    /\ approved \in BOOLEAN
    /\ cap \in Fees
    /\ drifted \in BOOLEAN
    /\ theft \in BOOLEAN
    /\ overpaid \in BOOLEAN

Init ==
    /\ v4Gov \in Govs \ EveGovs
    /\ succGov = None
    /\ creator = "none"
    /\ loc = [a \in Assets |-> "v4"]
    /\ fee \in Fees
    /\ approved = FALSE
    /\ cap = fee
    /\ drifted = FALSE
    /\ theft = FALSE
    /\ overpaid = FALSE

\* v4 config transaction (or config authority): any new governance.
V4Config(g) ==
    /\ v4Gov' = g
    /\ UNCHANGED <<succGov, creator, loc, fee, approved, cap, drifted, theft, overpaid>>

\* Successor config change by its own governance: any new governance.
SuccConfig(g) ==
    /\ succGov # None
    /\ succGov' = g
    /\ UNCHANGED <<v4Gov, creator, loc, fee, approved, cap, drifted, theft, overpaid>>

\* program_config_set_multisig_creation_fee: any time, any value.
SetFee(f) ==
    /\ fee' = f
    /\ UNCHANGED <<v4Gov, succGov, creator, loc, approved, cap, drifted, theft, overpaid>>

\* The v4 members approve multisig_create_from with max_creation_fee = the
\* fee that the planner reads. A later proposal can replace a failed one.
ApproveCreate ==
    /\ succGov = None
    /\ approved' = TRUE
    /\ cap' = fee
    /\ UNCHANGED <<v4Gov, succGov, creator, loc, fee, drifted, theft, overpaid>>

\* multisig_create_from: init fails if the account exists; mirror reads v4 at
\* execution; the fee is read at execution and checked against the cap.
CreateFrom ==
    /\ succGov = None
    /\ approved
    /\ FeeCap => fee <= cap
    /\ succGov' = v4Gov
    /\ creator' = "lineage"
    /\ overpaid' = (overpaid \/ fee > cap)
    /\ UNCHANGED <<v4Gov, loc, fee, approved, cap, drifted, theft>>

\* multisig_create_v2 at the successor address: possible only if someone can sign
\* as its create_key. With create_key = the v4 multisig PDA, nobody can.
Squat(g) ==
    /\ SquatPossible
    /\ succGov = None
    /\ g \in EveGovs
    /\ succGov' = g
    /\ creator' = "squatter"
    /\ UNCHANGED <<v4Gov, loc, fee, approved, cap, drifted, theft, overpaid>>

\* multisig_migrate_* (any class): the successor must exist; the governance check; the move.
Migrate(a) ==
    /\ loc[a] = "v4"
    /\ succGov # None
    /\ CheckGovernance => succGov = v4Gov
    /\ loc' = [loc EXCEPT ![a] = "succ"]
    /\ drifted' = (drifted \/ succGov # v4Gov)
    /\ theft' = (theft \/ (succGov \in EveGovs /\ v4Gov \notin EveGovs))
    /\ UNCHANGED <<v4Gov, succGov, creator, fee, approved, cap, overpaid>>

Next ==
    \/ \E g \in Govs : V4Config(g) \/ SuccConfig(g) \/ Squat(g)
    \/ \E f \in Fees : SetFee(f)
    \/ ApproveCreate
    \/ CreateFrom
    \/ \E a \in Assets : Migrate(a)

Spec == Init /\ [][Next]_vars

(***************************************************************************)
(* Properties                                                              *)
(***************************************************************************)

\* Only multisig_create_from creates the successor.
SuccessorFromLineage == creator # "squatter"

\* Every migrate moved an asset while both multisigs had the same governance.
SameGovernanceOnMigrate == ~drifted

\* A migrate gives Eve an asset only when Eve already ruled the v4 multisig.
NoTheftByMigration == ~theft

\* The v4 vault never pays a creation fee above the one that the members approved.
NoFeeAboveApproval == ~overpaid

\* Witness (must be violated): every asset can reach the successor.
NotAllMigrated == \E a \in Assets : loc[a] = "v4"
=============================================================================
