---
slice: 007-03 — `cwv_budget` oracle component + resolve OQ6 (flicker routing)
pass: craft
verdict: pass
reviewer: pr-review
reviewed_at: 2026-08-27T22:22:52Z
prompt_source: review.py pr-review --richer-skill pr-review
substrate: non-interactive
---

Craft — PASS (no blockers). STRENGTHS: fail-closed by construction — execFileSync (stdio pipe, no shell) throws on any child non-zero exit, JSON.parse/extractTrailingJSON throw on malformed output, missing metric fields resolve NaN comparisons to FAIL; so a crashed/garbled child aborts before a PASS can print (no false PASS, no garbage median). median() correct for even/odd N, same estimator both INP sides. ADR unusually honest about the proxy gap (band ~4x signal, crude pct p75). NITS (deferred polish / addressed): (1)[nit] extractTrailingJSON start<0 guard dead code -> FIXED. (2)[nit] no execFileSync timeout — a chromium/npm-build hang would stall the advisory step -> FIXED (per-child timeout added). (3)[nit] exit-code conflation: child crash exits 1 = over-budget FAIL — advisory CI can't distinguish infra failure -> logged/partially addressed via child-error message. (4)[nit][spec] Math.abs(inpDelta)<=band is symmetric — fails a worker >30ms FASTER than control; ADR resolves toward symmetric (large negative = measurement anomaly) — wording-alignment, logged. (5)[nit] duplicated TBT/CLS constants also in lh-eds acceptance.within_band — drift risk, logged. (6)[nit] hardcoded td.results[1]/[2] brittle to teardown scenario reordering -> FIXED (lookup by scenario label).
