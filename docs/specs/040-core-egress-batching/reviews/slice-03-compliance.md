---
slice: 040-03 — GA4 multi-`en` POST coalesce adapter (revives 039-04)
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T21:00:23Z
prompt_source: review.py implementation docs/specs/040-core-egress-batching/spec.md 'GA4 multi' <deliverables> (round 2)
---

VERDICT: pass (round 2)

## Reasoning

The round-1 finding is resolved. The mixed-`gcs` test now forces `gcd` to be omitted on both requests (an all-granted
`consentDefault` makes `isDeniedAllDefault` false → `encodeGcd` returns undefined, gtag.js:191), isolating `gcs` as the
only shared-param difference (G111 vs G100, with `gcd`-absent asserted on both), and it fails on a gcs→per-event
misclassification (both shared signatures collapse → merge to ONE POST → length 1 ≠ asserted 2). All four ACs are met
and covered by non-vacuous tests: AC1/AC4 byte-for-byte against the synthesized fixture + query/body partition; AC2
across mixed-`tid`/`dl`/`gcs`; AC3 strict-equality single-event unchanged; `_et` relocation and `_ee` injection each
proven against the source GETs' absence. Code output (buildBodyLine ordering, shared-query synthesis) matches the
fixture byte-for-byte, and the new shared-consent/session-state test proves an identical-context merge lands each shared
param once on the query. No other AC is under-covered.

## Round-1 finding — resolved

Round 1 (needs-changes) held that the mixed-`gcs` test was vacuous because `gcd` co-varied with the consent vector.
Verified against source that the premise was incorrect: `resolveConsent` (core/consent.js:59-66) returns "pending" for
an absent purpose, and `encodeGcd` (gtag.js:190-196) returns undefined on any pending purpose — so with only
ad_storage/analytics_storage set, `gcd` was already omitted and `gcs` was already isolated. The test was strengthened
regardless (explicit non-denied-all `consentDefault` + `gcd`-absent assertions) so the isolation is now unmistakable and
robust via an independent mechanism.

## Specific issues

(none)

## Reconciliation notes (for the reconciliation phase)

- Fill the slice's `### Deviation log` / `### Reconciliation sweep` (still `_TBD`) and strike through the DEFERRED 039-04
  slice with a pointer to 040-03 (a DoD item).
- The two n=1 residuals (batch-marker `_ee`/`_et` semantics on a single capture; deferred live-accept DebugView
  re-validation) are properly recorded in docs/refinement-todo.md — satisfies the DoD residual-tracking item.
- Intentional divergence from the sole 2026-09-08 capture: airlock carries each event's own `_et` per body line (default
  100), whereas the capture carried `_et` on line 2 only — restate in the reconciliation deviation log.
