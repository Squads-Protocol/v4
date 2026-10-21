#!/usr/bin/env bash
# Model-check the multisig TLA+ specs with TLC; see README.md for setup.
# Usage: check.sh [config-name-filter]. Exit 1 if an outcome is unexpected.
set -u

here=$(cd "$(dirname "$0")" && pwd)
jar=${TLA2TOOLS_JAR:-}
if [ -z "$jar" ] || [ ! -f "$jar" ]; then
  echo "Set TLA2TOOLS_JAR to the path of tla2tools.jar." >&2
  exit 2
fi
if ! command -v java >/dev/null 2>&1; then
  echo "java is not on PATH." >&2
  exit 2
fi

# spec | config | expected (fail = witness or finding) | optional "slow"
models=(
  "Multisig|MultisigPair|pass"
  "Multisig|Multisig|pass|slow"
  "Multisig|MultisigBatch|pass"
  "Multisig|MultisigControlled|pass"
  "Multisig|MultisigVault|pass"
  "Multisig|MultisigLive|pass"
  "Multisig|MultisigReach|fail"
  "Multisig|MultisigUnprotected|fail"
  "Multisig|MultisigStaleVault|fail"
  "Multisig|MultisigOrphan|fail"
  "Multisig|MultisigCancelVoters|fail"
  "Multisig|MultisigStall|fail"
  "Multisig|MultisigLimit|fail"
  "SpendingLimit|SpendingLimit|pass"
  "SpendingLimit|SpendingLimitOneTime|pass"
  "SpendingLimit|SpendingLimitSliding|fail"
)

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
status=0

for model in "${models[@]}"; do
  IFS='|' read -r spec config expected speed <<<"$model"
  if [ $# -gt 0 ] && [[ "$config" != *"$1"* ]]; then
    continue
  fi
  if [ "${speed:-}" = slow ] && [ "${CHECK_SLOW:-0}" != 1 ]; then
    printf 'skip  %-26s slow (minutes); set CHECK_SLOW=1 to run\n' "$config"
    continue
  fi
  log="$work/$config.log"
  started=$(date +%s)
  (cd "$here" && java -XX:+UseParallelGC -cp "$jar" tlc2.TLC \
    -workers auto -noGenerateSpecTE -metadir "$work/$config" \
    -config "$config.cfg" "$spec.tla") >"$log" 2>&1
  rm -rf "${work:?}/$config"
  seconds=$(( $(date +%s) - started ))
  if grep -q "No error has been found" "$log"; then
    actual=pass
  elif grep -qE "is violated|was violated|were violated" "$log"; then
    actual=fail
  else
    actual=error
  fi
  states=$(grep -oE "[0-9,]+ distinct states found" "$log" | tail -1)
  if [ "$actual" = "$expected" ]; then
    printf 'ok    %-26s %-5s %5ss  %s\n' "$config" "$actual" "$seconds" "$states"
  else
    printf 'FAIL  %-26s expected %s, got %s (%ss)\n' "$config" "$expected" "$actual" "$seconds"
    grep -E "Error|violated" "$log" | head -5 | sed 's/^/      /'
    status=1
  fi
done

exit $status
