---
slice: 004-02 — bundle + lazy-phase boot + `push()` contract
pass: arch
verdict: pass
reviewer: general-purpose + arch-review skill (independent, round 2)
reviewed_at: 2026-08-27T02:12:15Z
prompt_source: review.py arch-review docs/specs/004-uc2-ga4-eds/spec.md bundle <final deliverables> --richer-skill arch-review
substrate: non-interactive
---

# 004-02 arch — VERDICT: pass (round 2, final tree)

Round 1 was needs-changes with one [blocker]: getState("a.b") pinned ✅ in push-api.md but
silently returning the whole projection. Round 2 verified the fix at unit, contract-doc,
and real-page levels — the path-read row is now genuinely satisfied.

Judgments: (1) push/pushCritical reconciliation is a sound alignment, not a
reinterpretation — normalization at a single seam, schema-mirrored guard, zero stragglers
on the old shape; O(1) claim holds (rest-spread cost inherent to the pinned shape;
ADR-0002's O(1) = append+fold, no mapping). (2) Bundle boundary sound: adapter → core
dependency direction only; the emitted artifact realizes the documented module boundary;
the 004-01 CSP verdict is a fail-closed build invariant. (3) Deferrals architecturally
acceptable WITH a stated deadline: pushCritical's caller shape + the push-XOR-pushCritical
rule must be pinned in push-api.md no later than 004-04 (when real callers are wired);
double-boot leak is a recorded accepted risk with an OQ8 trigger.

[nit]s → deviation log/refinement-todo: pushCritical unpinned (deadline 004-04);
worker-specifier assert checks first match only; getState() returns the live projection
by reference (contract-consistent per the 🟡 row, but undocumented write-through hazard).
Open questions recorded: pushCritical bypasses log/projection (couples to ADR-0004's
parked idempotency guard); core hardwires the GA4 connector (pre-existing, MVP2 registry);
build outdir single-target until OQ8. Leanness check: nothing over-built; prune the
spike's workFactor knob when 004-03 lands real mapping.
