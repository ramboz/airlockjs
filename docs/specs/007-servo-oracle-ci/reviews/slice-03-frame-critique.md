---
slice: 007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing)
pass: frame-critique
verdict: needs-changes
reviewer: jig:reviewer
reviewed_at: 2026-08-27T19:52:29Z
prompt_source: review.py frame-critique
---

Frame-critique attacked A4/AC1 threshold pinning. FINDING (needs-changes): AC1 pins an ABSOLUTE INP p75 <= 50ms budget from single-run dev-machine spike numbers, but spec 003 (003/spec.md:56-57, R-005) explicitly declares absolute INP machine-dependent and only the DELTA between two runtimes on the same page load-bearing. The one genuinely run-to-run-variant metric is budgeted the exact way the source spike warns against, then checked on GitHub Actions shared runners (07-05) — pinning-surface != checking-surface. A4's "re-run to confirm before pinning" re-confirms on the DEV machine, not the runner. Downstream: first slow-runner CI run goes red for "environment" not "regression"; even as advisory it degrades to ignored noise, and the DoD "flip red on seeded over-budget" becomes indistinguishable from flipping red on hardware. Fix: budget INP as a DELTA vs a same-run control (rig/measure.mjs already runs baseline+worker on the same page), per the spike's own methodology; or explicitly justify absolute budgets under CI variance (runner-class pin, wide tolerance). VALIDATED (credit): keeping cwv_budget out of COMPONENTS does keep it off the gating composite (only named consumer is /servo:edd-suitability) — routing claim AC2 holds; and the delivery >=99% budget scoped to the DRAIN stage (not end-to-end) deliberately avoids the open OQ10 teardown loss — reconciliation must not "fix" it into an end-to-end budget.
