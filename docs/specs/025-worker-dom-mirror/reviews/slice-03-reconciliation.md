---
slice: 025-03 — a real tag (Prism) through the mirror: `innerHTML` + a sanitized apply, INP-measured
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-03T04:45:41Z
prompt_source: review.py reconciliation docs/specs/025-worker-dom-mirror/spec.md 'real tag'
---

**Verdict: PASS.**

Reconciliation pass — confirms the slice's Deviation log + Reconciliation sweep faithfully capture what shipped,
that the load-bearing question is answered (adversely) and surfaced, and that no downstream thread dangles.

- **Question answered, outcome recorded honestly.** The de-risk the maintainer green-lit — *does the governed
  off-thread mirror contain INP for a real `innerHTML`-heavy tag?* — is answered **NO** (net regression, ~2×).
  The adverse result is promoted to `refinement-todo` as a first-class finding, not buried. This is the
  ADR-0014 honest-coverage-bound discipline working as designed: the ADR warned Tier 0 covers a MINORITY; the
  measurement confirms `innerHTML`-heavy tags are outside that minority.
- **Deviation log is complete.** All nine deviations are captured: className/classList backing, worker-on-handle
  for `connector:"dom"`, the `Element` glue-prefix stub, `getElementsByTagName` inert, the AC6 production-path
  branch, the canary removal, and the two disclosed rig residuals. Each is axis-classified (grounded need vs
  lib-completeness) — no silent scope drift.
- **Canary reconciliation is correct.** 025-03's legitimate `core/` change broke 026-02/03's green-by-construction
  `git diff -- core/` canaries — the exact fragility both those slices' own reviews flagged. Removing them (and
  keeping the durable content-inspecting no-vendor grep) loses no real coverage; the inbox already tracks this as
  an anticipated cross-slice event. Full suite 1045 pass confirms nothing else regressed.
- **AC7 grounded-deferral is legitimate, not an escape hatch.** Neither 025-01 backpressure thread reproduces
  under airlock's own mirror *structurally* (Prism emits one unchunkable `setInnerHTML`, not a 20k-op storm;
  airlock's per-cycle drain isn't @ampproject's throughput channel), and this is verified by running, not
  asserted. Recorded as "not a threat under this mirror," which is the honest disposition.
- **No orphans.** `build.mjs` dom-chamber entry un-defers 026-05's grounded exclusion; ambient globals + Lever-3
  + Tier-1 are explicitly named for 025-04+; the strategic implication (mirror value is narrow) is routed to the
  maintainer for the thread's direction. Every deferred item has a named owner.

Ready for RECONCILED → DONE.
