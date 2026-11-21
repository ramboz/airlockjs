---
status: READY_FOR_IMPLEMENTATION
dependencies: [064-21, 069-01, 069-02, ADR-0065]
last_verified: 2026-11-21
---

## Slice 064-31 — stock `alloy()` wrapper parity (identity list, `sendEvent` result, hook argument, configure diagnostics, `setConsent` promise)

> **Re-scoped 2026-11-21 against [ADR-0065](../../decisions/adr-0065-airlock-martech-library.md).** The product path for `aem-martech` sites is the new Airlock martech library (spec 069), not this wrapper. The wrapper stays as a lower-level API and gets no new parity work of its own. Each AC below is kept, moved or dropped; the numbering is unchanged. Nothing is left for this slice to build: it closes as DONE-by-reference once ADR-0065 is Accepted and 069-01 and 069-02 are DONE (until then it is READY_FOR_IMPLEMENTATION with no work of its own).

**Goal:** A page written against stock `alloy(command, options)` (the `aem-martech` journey) sends the identity query it configured and gets back what stock's `sendEvent` resolves with.

**DoR:**
- ✅ 064-21 done (the wrapper and its S10 differential exist).

**Acceptance Criteria:**

1. A boot with the stock `idMigrationEnabled: false` sends `query.identity.fetch` of `["ECID"]` (the recorded S10 interact and the stock run), and the default boot keeps `["ECID","CORE"]`, shown by the 064-21 differential with the `query.identity.fetch[1]` exception removed.
   - **Dropped (ADR-0065).** Closed by 064-30: the S10 differential has no `query.identity.fetch` exception left (`thirdPartyCookiesEnabled: false` made the list equal stock's), and that differential is the guard. `idMigrationEnabled` is not a `bootAlloy` option; the library's `initMartech` diagnoses it as `unsupported-option` (069-02 AC4).
   - Note (064-30): the S10 stock config sets both `thirdPartyCookiesEnabled: false` and `idMigrationEnabled: false`. Matching only the first already makes the fetch list equal stock's, so the difference was `thirdPartyCookiesEnabled` (closed by 064-30). This AC is re-grounded or dropped at the 064-31 re-scope.
2. **Moved to 069-01 (ADR-0065)** (AC1 there; the wrapper picks it up where free, 069-01 AC6). The wrapper's `sendEvent` resolves with the result stock gives for the same call (`propositions` and `decisions` from the interact response), shown by a differential test that reads the resolved value in both arms. Today `handle.push` returns nothing, so the wrapper resolves `{}`.
3. **Moved to 069-01 (ADR-0065)** (AC2 there). The `onBeforeEventSend` hook the wrapper runs sees the same `xdm` stock passes it (context merged in), shown by a differential that records the hook argument in both arms. `aem-martech` only edits `data` unless `includeDataLayerState` is set, so the S10 journey is unaffected.
4. Moved to 064-30 (ADR-0064).
5. **Moved to 069-01 (ADR-0065)** (AC3 there). An `onBeforeEventSend` that throws drops the event with a `hook-threw` diagnostic today; the differential records what stock does for a throwing hook and the wrapper matches it.
6. **Moved to 069-02 (ADR-0065)** (AC7 there, re-expressed for the library's `webSDKConfig`; the `renderDecisions: true` check against what stock renders moves to 069-02 AC6; the wrapper's existing diagnostics stay as they are). `configure` options the wrapper cannot honour that conflict with the boot options (`orgId`, `datastreamId`, `edgeDomain`, `idMigrationEnabled`, `thirdPartyCookiesEnabled`, `clickCollectionEnabled`) get an `unsupported-option` diagnostic, and a `renderDecisions: true` call is checked against what stock renders (the wrapper sends `false` unless the page asks, so personalization rendering through `aem-martech` stays inert until `sendEvent` resolves the interact result, AC2).
7. **Moved to 069-02 (ADR-0065)** (AC4 for `edgeConfigOverrides`, AC6 for `datasetId` and the `type` versus `xdm.eventType` precedence, AC7 for the `__view__` check; the wrapper keeps its `unsupported-option` diagnostic). Per-event `edgeConfigOverrides` and `datasetId` on a stock `sendEvent` are either carried as the stock wire shape or the disposition is recorded against ADR-0062's config-pin rule (stop and ask if it needs a new ADR); the wrapper's `type` versus `xdm.eventType` precedence matches stock; and a page-requested `__view__` scope on a first call with named boot scopes is checked against the live-Alloy `__view__` suppression (connector.js, 064-21 round-3 craft low). `configure` options the journey passes that the wrapper deliberately leaves inert (`defaultConsent`, `debugEnabled`, `targetMigrationEnabled`, `autoCollectPropositionInteractions`) are named in the wrapper's header.
8. **Moved to 069-01 (ADR-0065)** (AC5 there, as `handle.setAdobeConsent` settling; the wrapper's `setConsent` returns that promise). The wrapper's `setConsent` promise settles with Alloy's own outcome (resolves when stock resolves, rejects with a plain `Error` carrying stock's message when stock rejects), shown by a differential that reads the settled value in both arms. Today it resolves after the post (ADR-0064 point 9).

**DoD:**
- `npm test && npm run lint` and servo gate pass.
- Real-browser tests run under `describe.runIf(process.env.AIRLOCK_REAL_CHROMIUM === "1")` with a GATING step in the `browser-oracle` job.

**Anti-horizontal-phasing check:** Vertical: the `aem-martech` journey from boot option to wire body to the value the page awaits.

## Notes

Found by the 064-21 stock-versus-airlock differential (AC1) and its mapping review (AC2, AC3). Whether `idMigrationEnabled` becomes a boot option or a pinned default is for the implementer to settle against ADR-0062's config-pin rule; stop and ask if it needs a new ADR. The set-consent body and host differences found by 064-21 moved to 064-30 (ADR-0064); AC8 is the `setConsent` promise difference found while writing it.
