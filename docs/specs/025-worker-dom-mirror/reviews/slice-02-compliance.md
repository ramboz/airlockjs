---
slice: 025-02 — the mirror core: synthetic tag off-thread through airlock's own mirror, INP-safe
pass: compliance
verdict: pass
reviewer: jig:reviewer (independent)
reviewed_at: 2026-09-03T00:32:23Z
prompt_source: review.py implementation
---

Compliance (025-02) — NEEDS-CHANGES → PASS after remediation. All 8 ACs met with non-vacuous tests: AC5a's rig
hard-asserts workCompleted == clicksFired*ELEMENTS and exits non-zero on mismatch (a stall can't pass as flat-INP
green); AC5b is genuinely falsifiable (a broken/unbudgeted apply drives yieldToMain to 0 or a 2000ms first batch,
tripping the assertion), with a real naive contrast; the safety policy is a true tag/attr-name allowlist + a
style-value guard, fully gating every real-DOM write through evaluateOp; the AC8 boundary regex distinguishes
import from comment. Orchestrator independently re-ran the AC5a rig: p75=8ms band [8,8], workCompleted=6000/6000/6000.
NEEDS-CHANGES was: (1) a robustness/security bug — dom-apply.js applied classList/appendChild/setAttribute ops that
throw on malformed-but-allowlisted input (InvalidCharacterError/HierarchyRequestError), uncaught, rejecting the
whole batch — contradicting the module's "never crashes the batch" contract + AC6's threat model. FIXED: try/catch
at the apply boundary (throw → diagnose kind:dom-apply-threw + refuse, batch continues) + policy token-validation
(isValidNameToken, an explicit /[^A-Za-z0-9_-]/ allowlist) wired into isAllowedAttributeName + the class-op case
(clean pre-apply refusal) + a coverage test with a throwing fake. (2) not-DONE-ready (close-out docs) — the
deviation log + reconciliation sweep are now written + DoD boxes ticked. The 4 deviations are disclosed + acceptable.
