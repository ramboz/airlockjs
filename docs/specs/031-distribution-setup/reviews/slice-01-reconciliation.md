---
slice: 031-01 — the distributable build target + subtree-install proof (boots on a clean EDS checkout, CWV preserved)
pass: reconciliation
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-09-04T19:46:58Z
prompt_source: review.py reconciliation docs/specs/031-distribution-setup/spec.md 031-01
---

VERDICT: pass

## Assessment (independent reconciliation review, general-purpose reviewer)

The deviation log and reconciliation sweep match reality with unusual precision. Every code/doc claim checked is
accurate: AC1 (testbed keeps emit + parameterized `buildAirlock({outdir,workerEntries,outNameFor})`), AC2
(dist-rooted-ref publish, required-explicit-target, recorded rejected alternatives), AC3 (basename-keyed build-time
layout assertions), AC5 (rig consumes `publishDist` output, two red breaks), AC6 (opt-in `WITH_CWV=1` arm) all read
as logged. The post-review craft blocker fix (`resolveTarget` name→URL; `publishDist` pushes resolved `pushTarget`;
the regression test) and the arch nit fix (architecture.md OQ8 naming `WITH_CWV=1`) are truthfully logged and
independently confirmed (test file 14/14; lint exit 0). No silent unlogged changes, no scope creep, no leanness
violations. The ADR-trigger reasoning is grounded — ADR-0015 explicitly delegates the served-artifact layout to
"the MVP6 distribution-setup spec."

## Reconciliation notes (all addressed / accepted)
- **DoD bookkeeping lag → FIXED:** the "Reviewed by reviewer subagent" and "Reconciliation review passed" DoD
  boxes were ticked to match the recorded evidence (all four review artifacts present under `reviews/`).
- **Two runtime attestations not re-run by the reviewer** (honestly framed, not overstated): (a) the AC6 "TBT
  delta 0ms, CLS 0, within band" one-run measurement; (b) the rig's "witnessed non-vacuous" red→green. Accepted:
  the orchestrator independently ran `npm run rig:subtree` (exit 0) and observed both seeded breaks go red
  (missing-sibling → no beacon; add-from-`main` → 404 boot fail), so the core AC5 proof is independently confirmed.
- **Leanness confirmed:** `buildAirlock`'s `workerEntries`/`outNameFor` are AC3 test seams (AC3 requires the seeded
  drop/rename to fail the build); `resolveTarget` is the minimal fix making `--target origin` work — neither is
  speculative generality.
- **Sweep completeness verified:** all nine 031-01 deliverables carry credible dispositions; every `no-op` row is
  defensible; `eslint.config.js` "already ignores dist/**" is truthful (config unmodified).

Reviewer: general-purpose (independent). Pass: reconciliation.
