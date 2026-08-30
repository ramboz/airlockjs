---
slice: 014-01 — round-trip egress + generic hosting in core (alloy driver)
pass: compliance
verdict: pass
reviewer: general-purpose
reviewed_at: 2026-08-30T17:33:12Z
prompt_source: review.py compliance docs/specs/014-mvp3-wrapped-sdk-core-integration/spec.md 014-01 <deliverables>
---

## Compliance review — slice 014-01 — **pass**
All 6 ACs pass with genuine runtime proof. The core question (does the 012-01 scenario really run
through `core/wrapped-sdk-host.js`, not re-implemented inline?) is conclusively YES — the rig imports
+ drives the real core module; the mainDispatch tally lives inside core; server-assigned ECID lands in
the AMCV_* jar via core's write-back. Full suite green (479→481), rig green (26 assertions), read-only
core files (airlock.js/chamber.worker.js/alloy-chamber.worker.js) confirmed untouched, stub-only (no
live ids). All 3 reported deviations legitimate (main-thread host API {init,driveEvent,getState};
AC4 probe rig-wired since the host is transport-agnostic; ceremony-for-reconciliation).
- **[AC5] minor pin gap → FIXED** — `EgressDispatchResponse.headers?` was declared but not pinned;
  added the pin.
