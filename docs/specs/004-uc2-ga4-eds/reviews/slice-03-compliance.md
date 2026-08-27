---
slice: 004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability)
pass: compliance
verdict: pass
reviewer: general-purpose (independent)
reviewed_at: 2026-08-27T04:29:39Z
prompt_source: review.py implementation docs/specs/004-uc2-ga4-eds/spec.md cookie <deliverables>
---

# 004-03 compliance — VERDICT: pass

All five ACs met with non-vacuous tests: total-function parsers (GA1.1/GA1.2/bare/
short/junk; GS1/GS2/junk → null, no throw path); generate+persist unit-tested over a
capability-shaped mock jar AND proven on the real page (rig gates ga_cookie_persisted
+ identity_flowed); minimal {clientId, sessionId} asserted on the ACTUAL worker init
message; AC5 conformance drives cookie-fixture-sourced ctx through mapToMp to an
exact golden match + schema validation. Every pinned assumption honored (GA1-format
_ga write, never-overwrite, per-page session fallback declared as steady state,
max-age 63072000 / path=/ / samesite=lax). 54/54 at review (57/57 after the folded
reconciliation pins). Reconciliation notes (all addressed): deviation log written;
multi-stream first-wins + empty-_ga interpretation logged; the dangling OQ7 consent
pointer re-homed (OQ13 created); red-run evidence noted in the log.
