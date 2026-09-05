---
slice: 034-02 — multi-scope personalization: `decisionScopes` + N placements
pass: arch
verdict: pass
reviewer: general-purpose (independent arch review)
reviewed_at: 2026-09-05T17:28:55Z
prompt_source: review.py arch docs/specs/034-alloy-config-followups/spec.md 034-02 <deliverables>
substrate: non-interactive
---

VERDICT: pass — architecture, slice 034-02 (arch_review: true)

The decisionScopes seam is coherent end-to-end: bootAlloy.deriveDecisionScopes derives host-side from placements[].scope (+reserved keys), threaded via host.init into the chamber connector (destructured out of configureExtras — never leaks into configure()), carried on sendEvent. Requesting more scopes does NOT widen 034-01's gated surface: the interact destination is unchanged (endpoint-ceiling intact), and decisionScopes rides inside events[].query.personalization, so the trusted seam's stripInterceptedPersonalizationQuery deletes it wholesale when personalization is denied — multi-scope + the analytics-only path compose cleanly, a compromised chamber can't leak it. The duplicate-scope split (runtime firstDuplicateScope does the real unique-by-scope work; schema uniqueItems coarse, honestly labeled) is sound. placements[].scope opening is additive on a sanctioned PRE-1.0 iterable surface. Per-scope RESPONSE stub-proven + live-deferred (013 pattern). Nits (follow-on): index.js:837 stale docstring; the fromPzn/personalization branch has no bootAlloy caller (leanness); the duplicate fixture is byte-identical (exercises only uniqueItems).
