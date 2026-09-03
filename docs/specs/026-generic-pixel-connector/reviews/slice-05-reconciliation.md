---
slice: 026-05 — live-shippability: the `pixel-chamber.worker.js` bundle entry + N-worker build assertion
pass: reconciliation
verdict: pass
reviewer: jig:reviewer (orchestrator)
reviewed_at: 2026-09-03T02:07:06Z
prompt_source: reconciliation sweep
---

Reconciliation (026-05) — PASS. The pixel connector is now genuinely live-shippable: build.mjs emits
core/pixel-chamber.worker.js as a same-origin sibling (npm run build emits all 3 siblings; both new Worker refs
resolve; all_workers_are_same_origin_file_urls:true), and the single-worker sibling-layout assertion is generalized to
N workers with the guard proven non-vacuous (a dropped entry throws). No regression (rig:bundle PASS; airlock tests
green). Implemented by the orchestrator directly (a stuck subagent was stopped having made no edits) + independently
reviewed (compliance + craft both PASS). Resolved: the docs/inbox.md build.mjs item (pixel done); the stale
core/airlock.js:171-179 comment (corrected — "wired as a build.mjs entry (026-05)" + the trap literal removed + the
matchAll N-worker description). Deferred (grounded, named): the dom-chamber worker's bundle entry (never new Worker'd
in production → 025-03+); identity/advanced-matching + POST/body (026-04, real-driver-gated); a pixel-path runtime
bundle-smoke. No orphans; no live identifiers; the emitted bundle outputs are gitignored.
