---
slice: 040-04 — coalesced-dispatch failure semantics + observability
pass: frame-critique
verdict: pass
reviewer: jig:reviewer
reviewed_at: 2026-09-09T21:37:14Z
prompt_source: review.py frame-critique docs/specs/040-core-egress-batching/spec.md 'failure semantics' slice-04-failure-semantics.md
---

VERDICT: pass

## Reasoning

The load-bearing bet — "surface the failure + explicit no-retry" over retry/split-retry or a count cap — survives the
strongest attack. No-retry is grounded, not asserted: a keepalive POST that rejects cannot distinguish "server never
received it" from "received, connection dropped before response," so retry genuinely risks duplicate ingestion — worse
for the high-value conversion connectors (Google Ads/Floodlight) the 1.0 target names, where retry would double-count
revenue, reinforcing no-retry. The "concentrated blast-radius" framing does not increase aggregate loss (same event
volume, concentrated vs. spread), and only GA4 analytics events coalesce today (default no-coalesce elsewhere), so
accept-the-loss is defensible for what actually merges. The observability premise is confirmed true from source: both
dispatch branches swallow failures identically (`.then(() => dispatched++, () => dispatched++)`, no `diagnose` — single
~:344-345, coalesced ~:372-373); coalescing runs only in `worker.onmessage`, not the synchronous `unloadFlush`
(~:436-447), so a rejection fires page-alive; `diagnose` is a caller-overridable production seam (:94).

## Specific issues (resolved before implementation)

- Primary assumption (observability + no-retry) — survives; not a blocker.
- AC3 exposure: the slice motivated itself on *event-count* blast-radius but committed only to a *byte-length* floor (a
  weak proxy), and the "040-05's byte ceiling transitively bounds event count" assumption conflated bytes with count.
  **[RESOLVED: AC3 recalibrated — the byte-length floor is what ships, the motivation is downgraded to "a sized egress
  failed" (not a precise tally), and precise per-POST event-count is explicitly DEFERRED to be designed with 040-05's
  splitting (where per-POST counts arise) via an optional EgressRequest hint. The Assumptions no longer claim bytes
  bound count — the count cap is declined for a stated reason (no-retry+observability makes it outcome-neutral), not the
  conflation.]**
- Stale line citations (:328-332 / :362-364) **[RESOLVED: corrected to ~:344-345 / ~:372-373 / unloadFlush ~:436-447.]**
