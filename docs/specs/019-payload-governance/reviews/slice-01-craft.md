---
slice: 019-01 — input-side payload denylist governance (all crossings, GA4 E2E)
pass: craft
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-08-31T12:59:24Z
prompt_source: review.py craft (richer-skill none)
substrate: non-interactive
---

# Craft — 019-01. VERDICT: pass (independent jig:reviewer; needs-changes → fixed → verified).
Original verdict: **needs-changes** on a real SECURITY BLOCKER — `findKeyCaseInsensitive` returned only the
FIRST case-insensitive match, so `params` carrying both `password` AND `Password` (plausibly from merged/
autofilled form sources) leaked the second's value; the docstring promised to strip both. The two-phase
resolve-then-copy-on-write in stripDottedPath was verified correct (off-path siblings ===, multi-path-same-
ancestor operates on the prior clone). **BLOCKER FIXED:** `matchingKeysCaseInsensitive` deletes EVERY
case-variant at the matched level (top-level + nested leaf); new tests cover both and would fail the old
first-match code. Nits also addressed: the dead `.not.toThrow` assertion FIXED; fail-open now emits an
error-level diagnostic (was silent). __proto__ diligence: top-level delete safe; the theoretical
`node[key]={...}` spot needs a host-configured `__proto__.x` path + own `__proto__` key (pathological,
host-trusted, out of threat model) — noted, not guarded. Strengths logged (COW, back-compat short-circuit,
pure/impure split). 266 tests green.
