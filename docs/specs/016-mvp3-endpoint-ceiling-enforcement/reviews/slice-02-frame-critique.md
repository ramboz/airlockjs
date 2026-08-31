---
slice: 016-02 — alloy wrapped-SDK endpoint ceiling (the FLOOR archetype)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-30T23:57:39Z
prompt_source: review.py frame-critique 016-02
---

## Frame-critique — 016-02 (alloy wrapped-SDK floor) — NEEDS-CHANGES (confirmed real)

**Primary (load-bearing):** the composition frame is false. 016-02 treats config-integrity (015) as a
TENANT-only pin and the ceiling as the first/complementary HOST+PATH gate — but `core/config-integrity.js`
is ALREADY a single-host destination gate (`host !== pinnedHost → hold`). Intersecting a 2-origin ceiling
(AC3) with config-integrity's 1-host pin under "both must pass" (AC2) collapses the allowed set to ≤1
host → alloy's legitimate 2nd origin (edge.adobedc.net) is held by config-integrity even though the
ceiling declares it → AC5 honest path fails; AC2/AC3 incoherent. Also: config-integrity runs on EVERY
intercepted fetch and holds "absent configId" — but alloy fires non-interact requests without a configId,
so it's really an INTERACT-scoped control mis-applied to all egress. Fix: reconcile the axes — the
endpoint ceiling OWNS host+path (set, all egress); config-integrity is scoped to the TENANT on the
interact (its single-host check subsumed by the ceiling — safe now that the ceiling runs first and holds
non-declared hosts). Correct spec.md's false "015 is tenant-only / first destination gate" claim.

**Secondary:** 013-02's 2 origins were measured in a real-DOM main-thread run, NOT the chamber. The
chamber's stock-alloy egress at origin+pathname is unmeasured → AC3's "declared set matches measured
egress" is asserted, not grounded for the chamber. Ground it or scope the claim.

**Not a block (honestly scoped):** the FLOOR framing (server-directed sync held+surfaced) is fair.
