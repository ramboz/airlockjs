---
slice: 040-04 — coalesced-dispatch failure semantics + observability
pass: reconciliation
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T21:51:35Z
prompt_source: review.py reconciliation docs/specs/040-core-egress-batching/spec.md 'failure semantics'
---

VERDICT: pass

## Reasoning

The deviation log and reconciliation sweep are honest and complete against what was built. All five logged fold-ins are
verifiable: (a) the `setConsent` flush (core/airlock.js:609-610) still swallows failures, tracked in refinement-todo;
(b) the `bytes` guard keys off method (`isPost = req.method !== "GET"`, then `isPost && req.body != null`) with a
GET-stray-body test; (c) the hoisted `EGRESS_TEXT_ENCODER`; (d) the empty-string-body `bytes: 0` test; (e) ADR-0021
OQ#1 closed. ADR-0021 was actually amended (OQ#1 struck RESOLVED → 040-04; OQ#3 → 040-03; OQ#2 open → 040-05). The
`setConsent` flush residual is genuinely tracked in refinement-todo with a resolution trigger, not silently dropped. The
7 new tests + the diagnostic behavior match ACs 1–3 with no undocumented deviation. Implementation is lean — a shared
`dispatch` closure + one module-level encoder, mirroring `holdIfOffCeiling`, no speculative abstraction.

## Specific issues

(none)

## Reconciliation notes

- The deviation log's `~:604` flush pointer is approximate (actual swallow is at core/airlock.js:609-610); the `~`
  prefix makes it acceptable and refinement-todo carries the same approximate reference consistently — not amended.
