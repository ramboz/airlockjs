---
slice: 047-02 — OneTrust consent-change → `handle.setConsent` (accept-flow flush)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-14T05:23:04Z
prompt_source: review.py implementation (047-02)
---

VERDICT: pass
All five 047-02 ACs met with non-vacuous tests. Subscription seam injected, idempotent (per-object markers), null-safe; the change path reuses 047-01's mapOnetrustConsent (no second mapping) and drives the existing handle.setConsent; the accept-flow flush is proven against the REAL createAirlock seal (holdOnDenied + remap honored — verified airlock.js re-maps held beacons under the new vector, so the granted=1 URL assertion is non-vacuous). Revoke stops future egress but never un-sends; churn no-throw. Driver import-free + egress-free.
Non-blocking: both OnConsentChanged AND OptanonWrapper are subscribed, so a single real change calls setConsent twice — benign (setConsent no-ops the second call via its heldBeacons.length guard; same vector, buffer drained) but untested. Fold at reconciliation. arch_review: false justified; no new ADR.
