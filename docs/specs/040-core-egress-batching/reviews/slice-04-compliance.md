---
slice: 040-04 — coalesced-dispatch failure semantics + observability
pass: compliance
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T21:48:56Z
prompt_source: review.py implementation ... 'failure semantics' core/airlock.js test/egress-coalescing.test.js
---

VERDICT: pass

## Reasoning

Meets ACs 1–3 for the two coalesced-dispatch sites. The shared `dispatch` closure (core/airlock.js) is called at both
`worker.onmessage` sites (single-beacon + coalesced), emits `{level:"warn", kind:"egress-failure", destination:
originPath(url), method, bytes?}` on rejection while preserving the additive `dispatched++` (AC1), does exactly one
`fetch` with no retry (AC2), and computes `bytes` as the UTF-8 byte length POST-only, no event-count, no contract change
(AC3). `originPath` returns origin+pathname, so no query/PII in `destination` (proven by the SECRET123 test). The new
tests are non-vacuous (diagnose-dependent ones fail on revert via `toBeDefined()`; no-retry / dispatched-count guards
pin their properties).

## Scope ruling (explicit)

Covering only the two `worker.onmessage` sites is **COMPLIANT with AC1 as written** — AC1 scopes to "the dispatch
(single + coalesced)", exactly the two sites; the slice's grounded Current-state enumerates only those; the flush path
never coalesces; the closure is local to `worker.onmessage`; `:599`/`:604` is unmodified pre-existing debt. The flush
omission is NOT a blocking gap, but a real residual that must be recorded honestly.

## Specific issues (all folded)

- `setConsent` held-beacon flush still swallows a rejected fetch — compliant-as-scoped, a residual against the
  "close the swallowed-failure gap" goal. **[FOLDED: recorded as a named follow-up in refinement-todo + the deviation
  log; not silent.]**
- `bytes` keyed off `req.body != null` regardless of method (a GET with a stray body would report bytes). **[FOLDED:
  guard is now `req.method !== "GET" && req.body != null`; a test pins the GET-stray-body case.]**

## Reconciliation notes (addressed)

- AC2 requires closing ADR-0021 OQ#1, which was still listed open. **[FOLDED: ADR-0021 OQ#1 struck RESOLVED → 040-04
  ("accept the loss, surface it").]**
- Deviation log + reconciliation sweep were `_TBD`. **[FOLDED: both written, recording the flush residual + the OQ#1
  closure.]**
