---
slice: 040-02 — core coalescing seam (post-verdict, per-cycle, protocol-pluggable)
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T20:20:08Z
prompt_source: review.py reconciliation docs/specs/040-core-egress-batching/spec.md 'core coalescing seam'
---

VERDICT: pass

## Reasoning

The deviation log and reconciliation sweep are honest and complete against what was built. All three logged deviations
are real and correctly characterized: (1) the AC1 output re-check runs `holdIfOffCeiling` → `checkEndpointCeiling(out.url,
endpoints)`, which enforces membership in the *declared* set (`ceiling.has(destination)` in `core/endpoint-ceiling.js`),
exactly the relaxed-but-sound invariant claimed; (2) the send/hold/drop three-test split is genuinely forced —
`egressVerdict(vector, purposes, {strict})` (`core/consent.js`) reads only cycle-level closure state, never the
per-request `r`, so the consent verdict is cycle-uniform and one `ready` array cannot carry all three dispositions;
(3) every craft/arch fold-in (the `holdIfOffCeiling` extraction, the consent-not-rechecked NOTE, the strengthened
held-input test asserting the `consent/held` diagnostic, the `undefined`/`[]` edge tests, and the cross-group
first-seen order pin) is present. No undocumented deviation exists — the one genuine behavior change (all `diagnose`
records now emit before any `fetch` due to the phase split) is honestly disclosed in the sweep. The four deferred items
have named triggers/owners, and the `core/coalescing-broker.js` non-overlap holds (core/airlock.js imports only
endpoint-ceiling/consent/payload-governance/egress; the broker appears only in a disambiguating comment, no production
wiring).

## Specific issues (both folded post-review)

- **Sweep completeness (Medium):** two changed files were unaccounted for in the reconciliation sweep —
  `docs/decisions/adr-0021-core-egress-batching.md` (the 2026-09-09 coalescing-broker non-overlap Amendment) and the
  `reviews/slice-02-*.md` artifacts. Both are referenced elsewhere, so this was a sweep-completeness gap, not
  undisclosed drift. **[FOLDED: added a "Changed-file completeness" bullet to the sweep listing both.]**
- **Frame-time claim understated test/rig refs (Low):** the Assumptions parenthetical said
  `createCoalescingBroker`/`handleInterceptedFetch` are "referenced only in `test/coalescing-broker-core.test.js`"; they
  also appear in `test/alloy-coalescing-broker.test.js` and the `rig/alloy-coalescing-*` harnesses. The load-bearing
  "no production wiring" conclusion is unaffected (both symbols exist outside the module only in tests/rig, never in
  core/connectors/eds/src). **[FOLDED: corrected the phrasing in the slice Assumptions, the ADR-0021 Amendment, and the
  frame-critique addendum to state "no production module — only tests + rig harnesses (…)".]**

## Reconciliation notes

- Leanness/over-build: none. The single optional `coalesce` param has an immediate consumer (040-03 GA4 adapter) on the
  ADR-0021-accepted path; the "credential/mode" dimension was deliberately NOT built (collapses to origin+path only);
  `holdIfOffCeiling` is a DRY extraction of duplicated logic, not speculative indirection.
- The "6 of the 13 tests fail on revert" DoD claim is an implementation-review artifact, out of scope for this pass.
