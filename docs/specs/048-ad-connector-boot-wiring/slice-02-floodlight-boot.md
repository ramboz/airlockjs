---
status: DRAFT
dependencies: [048-01, 046-01, 046-03, 045-01, 032-02]
last_verified:
frame_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions in the spec's `## Assumptions` — never assert an unverified claim as fact. -->

## Slice 048-02 — bootFloodlight + worker chamber + `{type:"floodlight"}` config type + composite membership (consent-gated)

**Goal:** Host the spec-046 Floodlight connector in its own worker chamber and wire `bootFloodlight` + the `boot(config)`
`{type:"floodlight"}` type + composite membership over it, reusing the ad-connector chamber+boot pattern 048-01
establishes. A real page selects Floodlight declaratively; its steady-state beacons for **both** DC forms (the `ccm/collect`
form, 046-01, and the `;`-delimited `activity` form, 046-02) are mapped off-thread in the chamber and dispatched governed;
consent is enforced (denied `ad_storage` holds, granted sends). Completes the ad-connector boot layer 048-03 depends on.

**Frame-critique inheritance (2026-09-14).** Like Google Ads, `connectors/floodlight/connector.js` is a gtag-family
`{ manifest, init, handle }` Connector "hosted the SAME way `core/connector-host.js` hosts GA4-gtag/pixel"
(`connector.js:141`, `createFloodlightConnector` at `:154`) — its steady-state beacon is **worker-chamber**-mapped, and
`createFloodlightRemap` covers only the seal's held→flush re-map. So this slice's scope (like 048-01's, corrected) includes
the **chamber + `core/airlock.js` `connector:"floodlight"` branch + `build.mjs` entry**, following the pattern 048-01
ratified. `arch_review` stays off: 048-01 already ratified the ad-connector chamber/boot addition; Floodlight reuses it.

**DoR:**
- ✅ The Floodlight connector + its seal opt-in are DONE: `connectors/floodlight/connector.js` is a `{manifest,init,handle}`
  gtag-family connector covering both DC forms (046-01/046-02) with a `holdOnDenied` opt-in for both (046-03), proven via a
  REAL `createAirlock({ holdOnDenied, remap })` in `test/floodlight-seal.test.js` (FakeWorker-simulated `ready`).
- ✅ 048-01 established (and its arch/frame passes ratified) the ad-connector chamber+boot pattern — a
  `core/<connector>-chamber.worker.js` + a `core/confine-<connector>-chamber.js` + a `core/airlock.js` `connector:` branch +
  a `build.mjs` entry + `bootConnector` dispatch + composite membership + `onDiagnostic` thread — which this slice mirrors.
- ✅ The seal machinery (045-01) is DONE.

**Acceptance Criteria:**

1. **A worker chamber hosts the Floodlight connector off-thread**, mirroring 048-01: `core/floodlight-chamber.worker.js`
   (`createConnectorHost(createFloodlightConnector, config)`) + `core/confine-floodlight-chamber.js` first-import; a
   `core/airlock.js` `connector === "floodlight"` branch (Worker URL + init + `requestMapper` case); a `build.mjs`
   `WORKER_ENTRIES` entry (covered by the N-worker sibling guard). **Both DC forms** map through the one chamber (the form
   selection — one config or the connector's own dispatch — read off `connectors/floodlight/connector.js`, per A1-floodlight).
2. **A new `bootFloodlight(opts)` adapter boots the chamber, consent-wired**, mirroring `bootGoogleAds` (048-01 AC2):
   `createAirlock({ connector:"floodlight", connectorConfig, endpoints, egressPurposes:["ad_storage"], holdOnDenied:true,
   consent, onDiagnostic })`, returning the standard boot handle.
3. **`boot(config)` accepts `{type:"floodlight", …}`**: added to `KNOWN_CONNECTOR_TYPES`; validator accepts a well-formed
   entry, rejects one missing its required id(s) (advertiser/activity ids, read off the connector), names it by index;
   `bootConnector` dispatches to `bootFloodlight` + composite; top-level governance threaded like `ga4`/`ga4-gtag`.
4. **Consent enforced END-TO-END through the boot, against the REAL seal, for both forms.** `consent:{ad_storage:"denied"}`
   + `holdOnDenied` HOLDS a beacon (zero `fetch`); `setConsent({ad_storage:"granted"})` re-maps + flushes it — asserted for
   **each** DC form (the `test/floodlight-seal.test.js` proof, now driven through `bootFloodlight`).
5. **Steady-state proven through the REAL chamber** (rig arm, mirroring 048-01 AC5): a config-booted Floodlight connector's
   beacon egresses through its actual `core/floodlight-chamber.worker.js` against the real build.
6. **Back-compat + inspector-observable.** No-`floodlight` configs byte-unchanged; `opts.onDiagnostic` threaded (spec 028),
   wired-collector regression assertion.

**DoD:**
- [ ] All ACs pass; full test suite green; `npm run build` emits the new sibling; the rig proof (AC5) passes.
- [ ] Implementer test coverage exercises each AC; the held→granted→flush edge is explicit **for both DC forms**; the build-sibling guard covers the new worker.
- [ ] Each new test shown to fail when its feature is removed (mutate → red → restore).
- [ ] Reviewed by `reviewer` subagent (compliance) + craft pass + this frame-critique.
- [ ] Deviation log + reconciliation sweep produced under this slice heading.
- [ ] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decision was deferred.

## Assumptions

- **A1-floodlight — both DC forms route through one `bootFloodlight` chamber.** Assumed the two beacon forms (046-01
  ccm/collect + 046-02 activity) are served by one chamber-hosted connector (a form option or the connector's internal
  dispatch), not two separate chambers/config types. The exact form-selection shape is read off
  `connectors/floodlight/connector.js` during implementation; if the forms genuinely need distinct config entries, this
  slice re-scopes.
- **A1'/A2 (inherited)** — the worker-chamber hosting model (frame-critique 2026-09-14) + zero-*new-mechanism* core seam
  (mirroring ga4-gtag/048-01) + zero-core-change composite membership; re-confirmed here for Floodlight.
