---
slice: 014-03 — converge connector-hosting (GA4 retrofit)
pass: compliance
verdict: pass
reviewer: self (orchestrator; subagent stalled)
reviewed_at: 2026-08-30T19:46:33Z
prompt_source: review.py compliance … 014-03 (subagent reviewers stalled on a vitest hang; orchestrator completed)
---

## Compliance review — slice 014-03 — **pass**
_Provenance: the independent compliance subagent stalled (a full-`vitest` child hung on the stale
nested worktree's shell-out oracle test) and was stopped; the orchestrator completed the verification._
- **AC1 GA4 via generic host** PASS — `connectors/ga4/connector.js` is a ConnectorFactory hosted via
  `createConnectorHost`; the 3 impedances bridged: (a) manifest authored; (b) `event.params||event.payload`
  feeds `mapToMp` the legacy `{type,params}` (mapToMp untouched); (c) `busy(workFactor)` re-homed.
- **AC2 byte-identity** PASS — `git diff connectors/ga4/map.js` EMPTY; GA4 egress unchanged.
- **AC3 unload fast path** PASS — `git diff core/egress.js` EMPTY; egress-fastpath green; unload stays sync.
- **AC4 one hosting mechanism** PASS — `core/chamber.worker.js` retired its mapBatch, now hosts GA4 via
  `createConnectorHost`; `git diff core/airlock.js` EMPTY (legitimate — the worker was rewritten in place
  keeping the exact `{ready,dropped}` protocol + init payload). Alloy NOT routed through airlock.js.
- **AC5 no GA4 regression** PASS — full suite 500/500 incl. all ga4-*, egress-fastpath, oracle-ga4.
- **DoD arch-2** PASS — `rig/alloy-coalescing-broker.js` deleted; test/harness redirected at
  `core/coalescing-broker.js`; no dangling imports. Mechanical, done.
- **Deviation 5** — the async top-level-routeBatch-throw diagnostic gap is unreachable (airlock always
  posts an array batch) and was hardened (a `.catch` now surfaces a batch-level `dropped` diagnostic).
