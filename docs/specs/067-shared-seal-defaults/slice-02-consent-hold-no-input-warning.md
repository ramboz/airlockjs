---
status: DONE
dependencies: [067-01, 067-11]
last_verified: 2026-11-13
---

## Slice 067-02: Consent hold on every track, with a no-consent-input warning

**Goal:** On every track and by default, events are held until consent is explicitly given. This holds for a site with no consent input at all: nothing is sent, a diagnostic warning says no consent input is wired, and the held events flush on grant. A site overrides the hold only with explicit config (decision D2: a per-connector switch).

**DoR:**
- ✅ ADR-0062 point 4 and exception (a). ADR-0007 and ADR-0023 stand.
- Ground first (spec 067 section 2): every EDS adapter sets `egressPurposes: consent ? X : []` (`adapters/eds/index.js:513,792,893,1038,1150`), so with no consent input the seal is skipped and every track sends today. These adapter gates are the change site. List each in the slice notes.
- At unload `criticalDispatchGated` drops non-send verdicts (`core/airlock.js:303-315`): held events are lost on page unload. State this in the notes; persistence is out of scope.
- Ground the hold ring (spec 067 section 8, check 1): `heldBeacons` has no cap on `main`.

**Acceptance Criteria:**

1. With no consent input and no explicit override, a connector that declares any egress purpose holds, sends nothing, and a `warn` diagnostic (`kind: "consent"`, a stable reason such as `no consent input wired`) is emitted once per airlock, not once per event. "No consent input" means no `consent` boot option and no `setConsent` call by the first held beacon (sites often call `setConsent` after a consent tool loads, `core/airlock.js:778`); the warning fires at that first held beacon, not at boot.
2. A connector that declares no egress purpose also holds under the same condition, so the hold is shared and not limited to connectors with a declared purpose. Where a connector's purposes are empty, it falls under the purpose D4 set: ad pixels use `ad_storage`, and helix-rum uses the `measurement` purpose from 067-11, which is granted by default, so RUM still sends with no consent input. This slice never holds helix-rum without that purpose in place.
3. A later grant flushes the held events through the existing `heldBeacons` and `setConsent` machinery, re-mapped under the now-current consent where a `remap` exists (spec 045-01, 045-03).
4. The consent hold ring is capped, drops the oldest past the cap and emits a diagnostic when it does (architecture.md Q2, ADR-0062 point 6 exception). The cap value and its diagnostic are recorded in the slice notes and in architecture.md Q2.
5. The explicit override from D2 is a per-connector wiring option, `consentHold: false`, on each track's options (the adapters in `adapters/eds/index.js`). It turns the hold off for that connector, emits a one-time `warn` per connector that the hold is off, and sends as stock does. The default path never reads this option as true by accident (a test passes a truthy non-boolean and the hold stays on).
6. When a site wires consent, behavior is unchanged: pending holds, denied follows ADR-0007 and ADR-0023, granted sends. A regression test pins each.
7. Tests cover the stock-default path (consent supplied as granted: stock output unchanged) and the opt-in as separate states.
8. Parity helpers used by existing rigs supply the recorded consent state, so the hold never fails a comparison.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- The warning is visible in the inspector stream (`onDiagnostic`) and the console, and is documented in `docs/architecture.md` next to the seal.

**Consumers:** Adobe 064-18 onward (vendor-adobe); Google G3; Meta M4 and the D1 row.

**Anti-horizontal-phasing check:** Vertical: seal verdict, diagnostic, override and flush on one connector, proven in the browser rig.

### Deviation log

- The slice's "check" for the existing no-consent tests changed meaning: tests that booted a track with no consent and expected a send now pass a granted vector or `consentHold: false`. No product deviation.

- Review round 1 deviations (noted): `pushCritical` events (`outbound_click`, pagehide `page_view`) are dropped, not held, when consent is pending, so with no consent input they are lost and never sent on grant (unload gate, persistence out of scope). The hold covers connectors with no purposes only because every adapter declares a non-empty list (D4); core `createAirlock` with no purposes declared does not hold. The `hold-off` warning fires only when no `consent` vector is wired.

### Reconciliation sweep

- Spec 067 D2 (per-connector `consentHold: false`, one-time `warn`), D4 (helix-rum granted by default via `measurement`): match.
- ADR-0007, ADR-0023, ADR-0062 point 4 and exception a: no change needed. `docs/architecture.md` (seal paragraph, Q2) and `contracts/README.md` and the config schema name the option.

**Implementation notes (2026-11-13):**
- Adapter gates changed in `adapters/eds/index.js` (line numbers shifted from the slice text): `bootGa4Core` (ga4), `bootGa4Gtag`, `bootGoogleAds`, `bootFloodlight`, `bootPixelConnector` (meta, linkedin, bing). Each used `egressPurposes: consent ? X : []` and now passes `egressPurposes: X` plus `consentHold`. The Alloy gate (`consent ? ALLOY_EGRESS_PURPOSES : []`) is untouched: it belongs to 067-03. `bootHelixRum` is untouched (always passes its default-granted purposes).
- `createAirlock` (`core/airlock.js`) takes `consentHold`. Only the exact value `false` with no `consent` wired makes the effective purposes `[]` (stock behaviour); a wired vector still applies the seal. One `warn` (`disposition: "hold-off"`) at construction when the hold is off.
- No-input warning: `warn`, `kind: "consent"`, `disposition: "held"`, reason `no consent input wired …`, once per airlock at the first held beacon, suppressed once `consent` was passed or `setConsent` called.
- AC4 cap: `MAX_HELD_BEACONS = 200` in `core/airlock.js`; the oldest is dropped with a `warn` (`disposition: "dropped"`, reason `consent hold ring full (cap 200)`). Recorded in `docs/architecture.md` Q2.
- Unload: `criticalDispatchGated` still drops non-send verdicts at teardown (`core/airlock.js`), so held events are lost on page unload. Persistence is out of scope.
- Config schema accepts `consentHold` (const `false`) on ga4, ga4-gtag, pixel (all three vendors), google-ads, floodlight, with a golden fixture.
- AC8: the parity rigs (`rig/chamber-capture.mjs` and the descriptors) already supply a granted vector. The EDS testbed (`probes/eds-testbed/scripts/scripts.js`) and `rig/subtree-install.mjs` booted with no consent, so they now pass a granted stand-in. `npm run rig:subset-smoke` and `npm run rig:google-ads-hold-flush` pass; `rig:subtree` could not run here (`git subtree` missing).
- Tests: `test/consent-hold-default.test.js` (AC1-AC7); about 34 existing tests updated to supply consent or `consentHold: false`.
