---
slice: 018-01 — the active-markup sanitizer boundary
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T05:40:01Z
prompt_source: review.py compliance (richer-skill none)
---

# Compliance review — 018-01. VERDICT: pass (independent, jig:reviewer).
All six ACs met by the diff; the load-bearing security proof correctly substrate-split (pure predicates/wiring
node-tested; real parse→strip→serialize vector table in real-chromium rig) and wired as a GATING ci.yml step
(no continue-on-error). Every test non-vacuous; back-compat holds (opts.setContent override byte-identical);
the four implementer deviations logged and none violate an AC. Deviation log verified faithful (core/ genuinely
import-free; opts.sanitize absent from public contract; <template> recursion real; TT memoized).
Non-blocking nits — ALL APPLIED: (1) rig AC3 gate now asserts data-x/aria-label preservation; (2) v-vbscript-href
vector added (vbscript: on a surviving <a> stripped in real DOM); (3) TT-memoization first-write-wins-over-
sanitize recorded in the deviation log. AC5 securitypolicyviolation narrowing confirmed defensible (already
logged). Rig re-run PASS.
