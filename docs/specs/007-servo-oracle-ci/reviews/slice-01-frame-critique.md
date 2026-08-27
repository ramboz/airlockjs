---
slice: 007-01 — `ga4_mp_conformance` oracle component (hermetic + live complement)
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-27T20:09:57Z
prompt_source: review.py frame-critique (re-review)
---

Re-review of revised slice (AND-gate at THRESHOLD=1.0). VERDICT PASS. Reviewer verified oracle.sh arithmetic across all three attack vectors: (a) a missing tool (rc=2) is routed to missing[] and exits 2 as env-error (oracle.sh:62-63,71-74) — no silent drop-and-pass false-pass path; (b) the all-pass composite is bit-exact — when every score is 1.0, weighted_sum accumulates 1.0*w=w by the identical operation that builds total_weight, so s/t is exactly 1.0, prints "1.0000", and the gate uses explicit numeric coercion c+0 >= t+0 -> 1>=1 true (oracle.sh:81-86), no 0.9999 boundary miss; (c) composite==1.0 iff every binary score is 1.0 for any positive weights, so the AND holds as future binary components are appended. NON-BLOCKING notes folded into the slice: (1) the binary invariant is a convention, not enforced by oracle.sh — a future fractional score would make THRESHOLD=1.0 a near-impossible bar; documented at the COMPONENTS array. (2) validate.mjs exits 1/0 and never echoes a score / never exits 2, so score_ga4_mp_conformance MUST wrap it (if node validate.mjs; then echo 1.0; else echo 0.0; fi) or a real rc=1 conformance failure would be misclassified as env-error exit 2 — added as an implementation note. (3) AC2's "vitest still scores 1.0" illustration is a demonstration nuance (if vitest also validates the seeded golden both go 0.0; gate verdict unchanged) — not load-bearing.
