---
slice: 041-02 — session-state + Consent-Mode carriage on the live path
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-10T01:54:42Z
prompt_source: review.py compliance ... 'session-state' adapters/eds/index.js test/eds-ga4-gtag.test.js
---

VERDICT: pass

## Reasoning

All three ACs are met and grounded. AC1: `writeGa4SessionState` is called before `createAirlock`, gated on
`storageGranted` (analytics_storage), and its `{sessionId, ...sessionState}` split correctly OVERRIDES the pre-write
`sid` and populates `ctx.sessionState` from the SAME transition (`adapters/eds/index.js:640-654`) — the new-session test
verifies a fresh sid pairs with the incremented `sct` (the sid/sct-consistency guard). AC2: the raw consent vector folds
verbatim into `ctx.consent`/`ctx.consentDefault` (`:666`), proven not-equal to `shapeMpConsent`. AC3: the seal params
(`egressPurposes`/`consent`) are byte-identical to 041-01 (`:673-674`), confirmed by the held-beacon test. Every DoD
coverage case has a test; the four positive new-feature tests genuinely fail on revert.

## Disclosed deviations — all compliant

1. Write gated on `opts.streamCookieName` presence — mandated by the spec (the writer needs a concrete `streamCookieName`,
   cannot scan). Executing the spec, not deviating.
2. Write gated on `!providedCtx` — faithfully mirrors 041-01's ctx-override escape hatch (which bypasses cookie sourcing;
   the write is a cookie op).
3. The two tests that pass on revert (analytics-denied, absent-streamCookieName) are honestly-labeled negative/back-compat
   guards — the DoD's "each new-feature test fails on revert" is satisfied by the four positive tests; these correctly
   assert pre-041-02 behavior is preserved (not a vacuous-test violation).

## Specific issues

- None blocking.

## Reconciliation notes

- Fill the slice's `### Deviation log` / `### Reconciliation sweep` (still `_TBD`) recording the three deviations above.
- Minor fidelity note (not a defect): the "analytics-denied" test passes `consent: {}`, which `resolveConsent` maps to
  "pending" (not explicit "denied"); both yield `storageGranted=false` so the no-write assertion is valid, but the label
  is slightly imprecise — a one-line note or a tightened label; no code change needed.
- Suite not executed here (read-only); implementer reports 95 files / 1455 tests green.
