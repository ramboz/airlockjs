---
slice: 017-03 — seal hold-pending + strict-drop
pass: arch
verdict: pass
reviewer: orchestrator-opus
reviewed_at: 2026-08-31T02:32:43Z
prompt_source: independent Opus review (017-03)
substrate: non-interactive
---

## Arch review — 017-03 (seal hold/flush/drop + main-thread setConsent) — PASS
Independent Opus review of the Sonnet diffs.
- egressVerdict (core/consent.js) is vendor-neutral + correct: pending→hold, denied→send (storage/data-use
  denials are 017-01/02's concerns; the beacon egresses), strict→drop, granted→send. Multi-purpose fail-closed
  (worst-of).
- 017-03 BUILDS its OWN main-thread consent-update path (mutable consentVector + setConsent handle method +
  heldBeacons buffer) — NOT 017-01's boot-time seam (which stays deferred for the worker reshape). Flush =
  a pure main-thread re-fetch of the already-mapped held {url,body}, no worker. Coherent with the
  frame-critique's resolution.
- Composition with 016-01: the consent gate runs FIRST in worker.onmessage (hold/drop → continue, never
  reaching the ceiling/fetch); the ceiling + honest granted path byte-unchanged when the gate is off.
- Sync/unload path DROPS (criticalDispatchGated wraps unloadFlush + pushCritical) — no hold at teardown;
  core/egress.js untouched (one consent-logic home in core/airlock.js).
- The back-compat deviation (egressPurposes gated on consent) is CORRECT + necessary — unconditional wiring
  would hold every beacon forever for non-consent deployments (resolveConsent maps absent==pending). Locked
  in with a test. Good catch.
No arch findings.
