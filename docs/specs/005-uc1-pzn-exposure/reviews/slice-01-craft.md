---
slice: 005-01 — exposure capture → GA4 + no-flicker invariant
pass: craft
verdict: pass
reviewer: general-purpose (independent)
reviewed_at: 2026-08-27T16:07:31Z
prompt_source: review.py craft docs/specs/005-uc1-pzn-exposure/spec.md exposure <deliverables>
substrate: non-interactive
---

# 005-01 craft — VERDICT: pass

All ACs met / boundary sound / craft clean (per pass). 96/96 tests; rig:uc1 PASS both
arms (structural invariant exp-applied<body:appear load-bearing, paint corroborating-
only; conformant experiment_impression; AC5 laziness now HARD-GATED after review fold);
clean challenger screenshot (OQ6 perceptual pass). The airlock REPORTS exposure, never
re-implements decisioning (Clarification Q4); core/ + map.js untouched; the golden is
registered in both the vitest oracle and validate.mjs mustPass.
Nits folded at reconciliation: wireExposure gained the __airlockExposureWired
double-wire guard its sibling wireInteractions has (all 3 reviewers — on the
measurement-critical count; red-first test added); rig AC5-laziness folded into armPass;
the fast-bounce note now names the DIFFERENTIAL bias (worse variant bounces faster →
biases lift, not just volume). Deferred (deviation log): the colon-delimited dedup-key
edge (matches scripts.js's own convention) and a minor golden/name-pin test overlap.
