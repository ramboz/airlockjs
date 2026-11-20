---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-21]
last_verified: 2026-11-20
---

## Slice 064-31 — stock `alloy()` wrapper parity (identity list, `sendEvent` result)

**Goal:** A page written against stock `alloy(command, options)` (the `aem-martech` journey) sends the identity query it configured and gets back what stock's `sendEvent` resolves with.

**DoR:**
- ✅ 064-21 done (the wrapper and its S10 differential exist).

**Acceptance Criteria:**

1. A boot with the stock `idMigrationEnabled: false` sends `query.identity.fetch` of `["ECID"]` (the recorded S10 interact and the stock run), and the default boot keeps `["ECID","CORE"]`, shown by the 064-21 differential with the `query.identity.fetch[1]` exception removed.
2. The wrapper's `sendEvent` resolves with the result stock gives for the same call (`propositions` and `decisions` from the interact response), shown by a differential test that reads the resolved value in both arms. Today `handle.push` returns nothing, so the wrapper resolves `{}`.
3. The `onBeforeEventSend` hook the wrapper runs sees the same `xdm` stock passes it (context merged in), shown by a differential that records the hook argument in both arms. `aem-martech` only edits `data` unless `includeDataLayerState` is set, so the S10 journey is unaffected.

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: the `aem-martech` journey from boot option to wire body to the value the page awaits.

## Notes

Found by the 064-21 stock-versus-airlock differential (AC1) and its mapping review (AC2, AC3). Whether `idMigrationEnabled` becomes a boot option or a pinned default is for the implementer to settle against ADR-0062's config-pin rule; stop and ask if it needs a new ADR. The set-consent body and host differences found by 064-21 are owned by 064-30 (stock consent path), not by this slice.
