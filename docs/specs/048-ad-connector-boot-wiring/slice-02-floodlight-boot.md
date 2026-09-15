---
status: DONE
dependencies: [048-01, 046-01, 046-03, 045-01, 032-02]
last_verified: 2026-09-14
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
   consent, onDiagnostic, remap: createFloodlightRemap(...) })`, returning the standard boot handle.
   **The `endpoints` ceiling is NOT a single-element mirror of 048-01 (frame-critique 2026-09-14).** Google Ads is
   single-origin (`endpoints:[ccm]`); Floodlight is TWO-origin, so when the activity form is configured (`src` set →
   `hasActivityIdentity`) `bootFloodlight` must pass a **two-element** ceiling `[ccmEndpoint,
   "ad.doubleclick.net/activity;src=<id>"]` — the second element a DIFFERENT origin, DATA-DEPENDENT on `src`, CONDITIONALLY
   present, and built with the SAME `core/path-matrix.js` `appendMatrixParam`/`joinMatrixUrl` join the connector uses for its
   `activityCeilingEndpoint` (`connectors/floodlight/connector.js` — a duplicated join silently mis-matches, per its own
   drift warning), matched by the segment-anchored **prefix** ceiling mode (ADR-0025 / 046-02 AC4). A naive single-element
   `endpoints:[ccm]` would fail-closed-HOLD the activity beacon forever — reuse the connector's own ceiling-endpoint
   derivation, don't re-build it inline.
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
- [x] Reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decision was deferred.

## Assumptions

- **A1-floodlight — both DC forms route through one `bootFloodlight` chamber.** Assumed the two beacon forms (046-01
  ccm/collect + 046-02 activity) are served by one chamber-hosted connector (a form option or the connector's internal
  dispatch), not two separate chambers/config types. The exact form-selection shape is read off
  `connectors/floodlight/connector.js` during implementation; if the forms genuinely need distinct config entries, this
  slice re-scopes.
- **A1'/A2 (inherited)** — the worker-chamber hosting model (frame-critique 2026-09-14) + zero-*new-mechanism* core seam
  (mirroring ga4-gtag/048-01) + zero-core-change composite membership; re-confirmed here for Floodlight.

### Deviation log (after reconciliation)

Original ACs preserved above; deviations append here (2026-09-14). All from a green implementation + a clean compliance +
craft review (both **pass**, no blockers, no fix round).

- **`type`-field wire-protocol collision (biggest, discovered at implementation).** Floodlight's connector config carries a
  field literally named `type` (the Floodlight-native activity tag, spec 046). It collides at TWO boundaries: (a) the chamber
  init envelope `{type:"init", ...connectorConfig}` — spreading would clobber the `type:"init"` discriminant; (b)
  `boot(config)`'s `{type:"floodlight", ...}` entry — `type` is the reserved connector-kind discriminant. Resolved on
  BOTH: the chamber init **nests** `connectorConfig` (a bespoke floodlight branch, not the shared spread — `core/airlock.js`),
  and the boot/config surface field is renamed **`activityType`** (translated to the connector's real `type` inside
  `bootFloodlight`). Design-choice recorded (craft): the connector's INTERNAL `type` was kept (not renamed end-to-end)
  because it maps 1:1 to the `;`-matrix wire param `type=`; the rename is pushed only to the reserved boot/config boundary.
  Mutation-tested (12 tests red on the naive spread).
- **Two-element data-dependent endpoint ceiling (frame-critique).** Unlike 048-01's single `[ccm]`, `bootFloodlight` passes
  `[ccm, activity]` when `src` is configured, the activity element via the connector's shared `deriveActivityCeilingEndpoint`
  (its connector-level WRAPPER extracted this slice — the lower-level `joinMatrixUrl` primitive was 046-02 — giving one home
  for the matrix-join so the manifest + boot ceiling can't drift into a permanent HOLD).
  Matched by the segment-anchored prefix ceiling (ADR-0025 / 046-02). Mutation-tested (single-element → activity held).
- **Rule-of-three extraction DECLINED** (assessed). Floodlight is the 3rd GET-family `connector:` branch, but a
  table-driven lookup fails `build.mjs`'s literal-`new Worker(new URL(...))` bundle-layout scan, and the six connector
  branches are non-uniform (helix-rum `mapper`, pixel wrapped closure, dom absent from requestMapper, floodlight's nested
  init) — kept parallel, added floodlight's literal branch exactly as 048-01 did. Reasoning in `refinement-todo.md`.
- **AC2 header wording corrected** (craft nit): `core/floodlight-chamber.worker.js`'s "mirrors byte-for-byte" was reworded
  to acknowledge the nested-init deviation.
- **AC3 required-id resolved to `conversionId` only** (compliance note): narrower than the slice's "advertiser/activity ids"
  wording — `src`/`activityType`/`cat` are optional, opt-in on `src` (mirrors the connector's own `hasActivityIdentity` gate).
- **Validator footgun (craft nit, logged not fixed):** an entry with `activityType`/`cat` set but `src` omitted is accepted,
  then silently emits no activity beacon. A loud "activityType/cat without src" warning would close it — logged in
  `refinement-todo.md` as a small hardening follow-up (non-blocking; consistent with the connector's own permissive gate).
- **ADR: none** — reuses the ratified 048-01 chamber/boot pattern + ADR-0023/0024/0025 (hold-remap, per-beacon key,
  matrix-prefix ceiling); no new load-bearing decision with rejected alternatives.

### Reconciliation sweep

Drift-prone surfaces checked (updated / no-op / deferred):

- `docs/architecture.md` — **updated**: added `floodlight-chamber.worker.js` to the chamber runtime list + noted
  `connectors/floodlight/` is now chamber-hosted + bootable (two-element ceiling, `activityType` rename, nested init).
- `contracts/instrumentation-config.schema.json` — **updated**: `floodlightConnector` `$def` + `oneOf`; the
  `KNOWN_CONNECTOR_TYPES`↔schema cross-check test (from 048-01) now covers floodlight.
- `docs/refinement-todo.md` — **updated**: 048-02 section (rule-of-three decline, manifest mirror-drift, AC5 rig residual) +
  the validator footgun added this reconciliation.
- `docs/specs/README.md` (status board) — **updated**: regenerated on transition (+ at DONE).
- `core/floodlight-chamber.worker.js` header — **updated**: overclaim reworded (craft nit).
- `docs/inbox.md` — **no-op**: nothing 048-02-relevant to park.
- `CLAUDE.md` primer / close-out — **deferred**: 048-02 does NOT close spec 048 (048-03 remains) — no compress-on-close-out yet.
- Lightweight decisions / conventions — **no-op**.
- Memory-sync — the load-bearing learning (the `type`-field collision + its two-boundary fix; the two-element ceiling) is in
  the deviation log + `architecture.md` + heavy code comments; no new glossary term.

### Named residuals (carried forward)

- **AC5** — the real-chamber rig proves the GRANTED steady-state for both DC forms; held→remap→flush-through-the-real-chamber
  stays FakeWorker + source-verified (mirrors 048-01; trigger + reasoning in `refinement-todo.md`).
- **Validator footgun** — `activityType`/`cat` without `src` silently no-ops the activity beacon (logged above).
- **Manifest const mirror-drift** — `FLOODLIGHT_EGRESS_PURPOSES`/`FLOODLIGHT_MANIFEST_EVENTS` hand-mirror the connector
  manifest (pre-existing standing residual, not widened).
