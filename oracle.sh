#!/usr/bin/env bash
# oracle.sh — weighted composite quality score (servo Tier-0 template)
#
# Exit codes (servo contract — do not change):
#   0  composite >= THRESHOLD
#   1  composite <  THRESHOLD
#   2  environment error (missing tool, no components, bad component rc)
#
# Each component contributes a score in [0.0, 1.0] via a `score_<name>` shell
# function, with a weight registered in the COMPONENTS array as "<name>:<weight>".
# The final composite is a weighted average: sum(weight * score) / sum(weight).
#
# Components live inside `# SEED:start <name>` / `# SEED:end <name>` blocks so
# servo can find, replace, or splice them on re-scaffold.  See README.md
# (section "Adding a component") for the full convention.
#
# Override at runtime:
#   THRESHOLD=0.8 ./oracle.sh   # raise the gate
#   THRESHOLD=0   ./oracle.sh   # accept any score (smoke test)

set -euo pipefail

# Default 1.0 (not the servo-template 0.5): the AND-gate below (see the
# COMPONENTS comment) depends on THRESHOLD=1.0. This line sits OUTSIDE any
# `# SEED:start/end` block, so a future `/servo:scaffold-init --force`
# re-emit could silently reset it back to the template default — if this
# value ever isn't 1.0, that's why; a human should notice and re-apply 1.0.
THRESHOLD="${THRESHOLD:-1.0}"

# Registered components — one "<name>:<weight>" entry per scoring function.
# THRESHOLD=1.0 turns the weighted average into an AND-gate (spec 007
# Overview / A1): composite == 1.0 iff every component scores 1.0, so a
# single 0.0 fails the gate. That property only holds if every gating
# component below returns exactly 1.0 or 0.0 (BINARY) — a fractional score
# would make THRESHOLD=1.0 a near-impossible bar instead of an AND. This is
# a convention `oracle.sh` does NOT enforce; keep every score_* here binary.
COMPONENTS=(
  "vitest:1.0"
  "ga4_mp_conformance:1.0"
)

# SEED:start vitest
score_vitest() {
  if command -v vitest >/dev/null 2>&1; then
    runner=("vitest" "run")
  elif command -v npx >/dev/null 2>&1; then
    runner=("npx" "--no-install" "vitest" "run")
  else
    echo "missing: vitest (install vitest or npx)" >&2
    return 2
  fi
  if "${runner[@]}" >/dev/null 2>&1; then
    echo "1.0"
  else
    echo "0.0"
  fi
}
# SEED:end vitest

# SEED:start ga4_mp_conformance
score_ga4_mp_conformance() {
  if ! command -v node >/dev/null 2>&1; then
    echo "missing: node (required by contracts/validate.mjs)" >&2
    return 2
  fi
  # contracts/validate.mjs exits 1/0 and never echoes a score itself — wrap it
  # (mirroring score_vitest) so a genuine conformance failure (rc=1) becomes a
  # 0.0 gate-fail, not a raw non-zero exit misclassified as an env-error (rc=2).
  if (cd contracts && node validate.mjs) >/dev/null 2>&1; then
    echo "1.0"
  else
    echo "0.0"
  fi
}
# SEED:end ga4_mp_conformance

weighted_sum="0"
total_weight="0"
missing=()

for entry in "${COMPONENTS[@]:+${COMPONENTS[@]}}"; do
  name="${entry%%:*}"
  weight="${entry##*:}"
  if score="$("score_${name}")"; then
    weighted_sum="$(awk -v s="$weighted_sum" -v c="$score" -v w="$weight" \
      'BEGIN { printf "%.6f", s + c*w }')"
    total_weight="$(awk -v t="$total_weight" -v w="$weight" \
      'BEGIN { printf "%.6f", t + w }')"
  else
    rc=$?
    if [ "$rc" -eq 2 ]; then
      missing+=("$name")
    else
      echo "oracle: score_${name} returned rc=${rc}" >&2
      exit 2
    fi
  fi
done

if [ "${#missing[@]}" -gt 0 ]; then
  echo "oracle: missing components: ${missing[*]}" >&2
  exit 2
fi

if awk -v t="$total_weight" 'BEGIN { exit !(t+0 == 0) }'; then
  echo "oracle: no components registered" >&2
  exit 2
fi

composite="$(awk -v s="$weighted_sum" -v t="$total_weight" \
  'BEGIN { printf "%.4f", s/t }')"

printf 'oracle: composite=%s threshold=%s\n' "$composite" "$THRESHOLD"

awk -v c="$composite" -v t="$THRESHOLD" 'BEGIN { exit !(c+0 >= t+0) }'
