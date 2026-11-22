---
status: READY_FOR_IMPLEMENTATION
dependencies: [069-03]
last_verified: 2026-11-22
---

## Slice 069-05 — Real-Chromium display flows of the martech library (overflow of 069-03 AC6)

**Goal:** Overflow from 069-03 AC6. The library arm already matches the stock run's requests for the default path (`martechEager`, `martechLazy`, `martechDelayed`), `trackPageView` on and off, `performanceOptimized: false` with the body style changes, and the `martechConfig.airlock` boot path. This slice adds the flows that need a new rig scenario: personalization off, a late display after the timeout, and a synthetic offer answer that renders and sends `propositionDisplay` (also `trackPageView: false` with an offer).

**Definition of Ready:**
- ✅ 069-03 DONE (except this AC6 remainder).

**Definition of Done:**
- The three fresh Opus 5.5 `jig:reviewer` reviews saved in `reviews/`.
- `npm test && npm run lint` pass; spec lint exit 0 for 069; the real-Chromium file runs green with `AIRLOCK_REAL_CHROMIUM=1`.

**Acceptance Criteria:**

1. Personalization off in real Chromium: a journey that calls `martechLazy` before awaiting `sendEvent` (the 069-03 journey awaits `sendEvent` first, which cannot settle while personalization is off, in the stock run too) sends the stock run's requests.
2. A late display after `personalizationTimeout` sends the stock run's `decisioning.propositionDisplay` requests.
3. A SYNTHETIC offer answer (the 064-20 sense, no new live capture) renders with `renderDecisions: true` and reports the same displays as the stock run.
4. No `core/` change; the 064-21 and 069-03 tests stay green.

## Notes

Raised by 069-03's Findings. The hermetic tests of 069-03 already cover the personalization-off, timeout and late-display logic with the fake worker.
