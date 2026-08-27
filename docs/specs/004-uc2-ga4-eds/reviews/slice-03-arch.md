---
slice: 004-03 — GA4 ctx from `_ga` cookies (mediated cookie capability)
pass: arch
verdict: pass
reviewer: general-purpose + arch-review skill (independent)
reviewed_at: 2026-08-27T04:29:40Z
prompt_source: review.py arch-review docs/specs/004-uc2-ga4-eds/spec.md cookie <deliverables> --richer-skill arch-review
substrate: non-interactive
---

# 004-03 arch — VERDICT: pass

First-round pass. The identity boundary is clean and TRIPLE-verified (exact-keys at
the sourcing function, exact-keys on the actual init message crossing the airlock,
cookie→ctx→beacon continuity on the real page) — ADR-0003 minimization enforced as a
regression tripwire, not a comment. The accessor is a faithful rendering of the
pinned GrantedCapabilities.cookies shape (all five CookieOptions honored); leaving
the connector grant flow unexercised is the lean, contract-grounded call. Module
placement sound: vendor grammar pure in connectors/ga4/, DOM access in the adapter,
core/ and contracts/ untouched. Pinned-frame fidelity exact — in one place sharper
than the frame (the never-overwrite rationale).

Two [nit]s, both addressed at reconciliation: (1) the slice's deferred decisions had
no register home (dangling OQ7 pointer) → OQ13 created (consent-gating the identity
write; session persistence; multi-stream policy/list(); name-scoped grant wrapper +
accessor's eventual core/ home; duplication trigger), slice pointer fixed; (2)
grant-readiness caveat added to createCookieCapability's JSDoc. Open questions
recorded in OQ13/OQ9 scope: grant-wrapper home, capability list(), whether the
init-time ctx folds into the ADR-0003 declaration mechanism, session-persistence
trigger.
