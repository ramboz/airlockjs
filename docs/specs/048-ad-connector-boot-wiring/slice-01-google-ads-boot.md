---
status: DRAFT
dependencies: [044-01, 044-02, 045-01, 032-02]
last_verified:
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 048-01 — bootGoogleAds + `{type:"google-ads"}` config type + composite membership (consent-gated)

**Goal:** Add a first-class `bootGoogleAds` boot adapter (`adapters/eds/index.js`) + a `boot(config)`
`{type:"google-ads"}` connector type + composite membership, wiring the spec-044 Google Ads connector's governed-GET
beacon through the seal with `egressPurposes:["ad_storage"]` + `holdOnDenied:true`. End-to-end value: a real EDS page can
select Google Ads **declaratively** (`boot({connectors:[{type:"google-ads", …}]})`) and consent is enforced — a denied
`ad_storage` beacon holds at the seal, a granted one sends — closing the 044-01 §A2 "boot wiring is the deferred edge" gap
for the first ad connector.

**Why `arch_review: true`.** This introduces a **new connector class** to the frozen-ish `boot(config)` surface: it grows
`KNOWN_CONNECTOR_TYPES` (today `["ga4", "ga4-gtag", "pixel", "helix-rum", "alloy"]`, `adapters/eds/index.js:1600` — grepped
2026-09-14), adds a `bootConnector` dispatch case, and establishes the ad-connector-boot pattern 048-02 reuses. The arch
pass ratifies that the ad boot reuses the existing adapter/composite shape (no new core seam) rather than inventing one.

**DoR:**
- ✅ The connector + its seal opt-in exist and are DONE: `connectors/google-ads/connector.js` (044-01) + its
  `holdOnDenied` opt-in with `egressPurposes:["ad_storage"]` (044-02), proven through a REAL
  `createAirlock({ holdOnDenied, remap })` in `test/google-ads-seal.test.js`.
- ✅ The boot-adapter pattern is established and reusable: `bootMetaPixel` / `bootHelixRum` / `bootGa4Gtag` each construct a
  `createAirlock`, return the standard boot handle, and are dispatched by `bootConnector` into `createComposite`
  (`adapters/eds/index.js`) — the exact shape this slice mirrors.
- ✅ The seal machinery is DONE: `holdOnDenied` + the hold-until-granted re-map (045-01), threaded through `createAirlock`.
- ⚠️ Assumption A1 (boot-shape — main-thread `remap`/seal seam vs a worker chamber) is the load-bearing frame-critique
  check for this slice; see `## Assumptions`.

**Acceptance Criteria:**

1. **A new `bootGoogleAds(opts)` adapter boots the Google Ads connector, consent-wired.** It constructs the connector's
   governed-GET airlock with `egressPurposes:["ad_storage"]` + `holdOnDenied:true` + the connector's `remap`
   (`createGoogleAdsRemap`) + `endpoints` = the host-owned ceiling, and returns the **standard boot handle**
   (`{ push, pushCritical, setConsent, getState, flushNow, stats, dispose }`) — byte-shape-identical to `bootMetaPixel`'s
   handle. Absent `consent` stays back-compat (no seal gate) exactly as the other boots gate on `consent` being wired.
2. **`boot(config)` accepts `{type:"google-ads", …}`.** `google-ads` is added to `KNOWN_CONNECTOR_TYPES`; the hand-rolled
   config validator accepts a well-formed entry and rejects one missing its required id(s) (the exact id set — e.g.
   `conversionId` — read off `connectors/google-ads/connector.js` + `cookies.js`, per A3), naming the connector by index;
   `bootConnector` dispatches `{type:"google-ads"}` to `bootGoogleAds` and adds it to the composite with its manifest
   events. A `{type:"google-ads"}` entry with the top-level governance (`consent`/`consentStrict`/`payloadDenylist`) is
   threaded exactly like the `ga4`/`pixel` cases (NOT the helix-rum carve-out).
3. **Consent is enforced END-TO-END through the boot, against the REAL seal.** Booting Google Ads with
   `consent:{ad_storage:"denied"}` + `holdOnDenied` HOLDS a beacon (zero `fetch`); a subsequent `setConsent({ad_storage:
   "granted"})` on the returned handle re-maps + flushes it (exactly the `test/google-ads-seal.test.js` proof, but now
   driven through `bootGoogleAds`, not a hand-built `createAirlock`). Uses the established FakeWorker + `ready`/`setConsent`
   harness (`test/eds-boot-onetrust.test.js`'s ad-airlock pattern).
4. **Back-compat + inspector-observable.** A `boot(config)` with no `google-ads` connector is byte-unchanged; a boot that
   passes no `consent` sends as today. `bootGoogleAds` threads `opts.onDiagnostic` to its `createAirlock` (spec 028) so a
   prod-booted Google Ads instance's held/dropped decisions reach the inspector collector, mirroring the other boots
   (regression-covered by a wired-collector assertion, as in `test/eds-boot-inspector.test.js`).

**DoD:**
- [ ] All ACs pass; full test suite green (no regressions).
- [ ] Implementer test coverage exercises each AC with at least one fixture; the held→granted→flush edge is explicit.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore) — in particular the
      denied-holds / granted-sends assertions and the `KNOWN_CONNECTOR_TYPES` acceptance.
- [ ] Reviewed by `reviewer` subagent (compliance) + craft pass + arch pass (`arch_review: true`) + frame-critique
      (`frame_review: true`).
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decision was deferred; the manifest `purposes`/`endpoints` mirror-drift
      residual (inbox) is noted, not silently widened.

## Assumptions

- **A1 (load-bearing) — the boot constructs a main-thread `remap`/seal airlock, no new `connector:` chamber branch.**
  `core/airlock.js` has no `connector:"google-ads"` selection branch (its branches are `pixel`/`dom`/`helix-rum`/
  `ga4-gtag`, grepped 2026-09-14), and the seal test drives the connector via `createAirlock({ egressPurposes, holdOnDenied,
  remap })`. Assumed `bootGoogleAds` builds the airlock on that same seam with **no** `core/airlock.js` change. **If the
  connector's steady-state (non-held) beacon actually requires a worker chamber** (a `connector:` branch + a
  `*-chamber.worker.js` + a `build.mjs` entry), 048-01 re-scopes to include that — this is the frame-critique's first check.
- **A3 — the required config id set** for a `{type:"google-ads"}` entry is read off `connectors/google-ads/connector.js` +
  `cookies.js` during implementation, not invented in this slice.
