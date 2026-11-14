---
slice: 067-08: Alloy context defaults to the stock list
pass: craft
verdict: pass
reviewer: claude-opus-5.5 (jig:reviewer)
reviewed_at: 2026-11-14T00:19:41Z
prompt_source: slice-08 diff, conventions
---

Round 1 gaps (no tests for event-time re-collection, fingerprint dedupe, payloadDenylistOverride; resolveDenylist called twice; ALLOY_DEFAULT_CONTEXT tied to STOCK_CONTEXT_GROUPS; non-array context handling) fixed with tests and a single-call refactor. Round 2 lows: connector now normalizes a non-array context; all-empty-collection and href-fallback notes logged for 064-17.
