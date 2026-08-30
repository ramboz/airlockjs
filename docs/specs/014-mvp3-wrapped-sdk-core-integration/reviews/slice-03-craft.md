---
slice: 014-03 — converge connector-hosting (GA4 retrofit)
pass: craft
verdict: pass
reviewer: self (orchestrator; subagent stalled)
reviewed_at: 2026-08-30T19:46:33Z
prompt_source: review.py craft … 014-03 (subagent reviewers stalled on a vitest hang; orchestrator completed)
substrate: non-interactive
---

## Craft review — slice 014-03 — **pass** (deviation-5 hardened)
_Provenance: independent craft subagent stalled (vitest hang) + was stopped; orchestrator completed._
- **Bridge fidelity** — `handle()` reproduces the old `mapBatch`'s per-tracker work byte-for-byte
  (per-tracker `mapToMp` + `busy(workFactor)` + `{url:endpoints[t], body:JSON.stringify(body)}`); the
  `event.params||event.payload` bridge feeds `mapToMp` exactly `{type,params}` (the same bridge alloy uses).
- **Worker rewrite** — preserves the exact `{type:init/events}`→`{ready,dropped}` protocol; init-before-events
  chained off `initPromise`; per-event containment via routeBatch equivalent to the old per-descriptor mapBatch.
- **Deviation 5 → FIXED** — the `.then` chain had no `.catch`, so a top-level routeBatch rejection would be a
  SILENT unhandled rejection (vs the old sync-throw → worker.onerror). Added a `.catch` that surfaces a
  batch-level `dropped` diagnostic through the 009-02 seam. Unreachable in practice, but no silent path.
- Tests non-vacuous (10 GA4-connector + the ported chamber-isolation).
