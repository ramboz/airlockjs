---
slice: 004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability)
pass: craft
verdict: pass
reviewer: general-purpose + pr-review skill (independent)
reviewed_at: 2026-08-27T04:29:40Z
prompt_source: review.py pr-review docs/specs/004-uc2-ga4-eds/spec.md cookie <deliverables> --richer-skill pr-review
substrate: non-interactive
---

# 004-03 craft — VERDICT: pass

First-round pass. Disciplined implementation: pure DI'd parsers degrading to null on
every malformed shape; accessor matches the pinned contract exactly; async boot stays
inside the catch-but-visible failure envelope. 34 new tests assert concrete values,
several engineered to be incapable of passing vacuously (returning-visitor fixture ≠
old STATIC_CTX; override test omits the document stub so any cookie touch throws;
AC5 injects a throwing random to prove the generate path never ran).

Four [nit]s, disposition: (1) untested decode-fallback branch in both cookie modules
→ FOLDED (tests added both suites, mutation-verified 2-red); (2) set() unguarded doc
deref asymmetric with get() → FOLDED (no-op guard, genuinely-red test); SecurityError
hard-degrade on cookie-blocked contexts → accepted, OQ13; (3) cookie-name validation
needed when the grant flow lands → OQ13 item 4 + JSDoc caveat; (4) pair-scan loop
duplication → rule-of-three trigger in OQ13. [strength]s: deterministic generate path
(injectable now/random, exact persisted-value asserts); never-overwrite guard with
articulated rationale; attribute-smuggling encode test; real-page identity loop
closure wired into the rig verdict.
