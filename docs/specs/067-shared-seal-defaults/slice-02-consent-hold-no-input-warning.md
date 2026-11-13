---
status: DRAFT
dependencies: [067-01]
last_verified: 2026-11-13
---

## Slice 067-02: Consent hold on every track, with a no-consent-input warning

**Goal:** On every track and by default, events are held until consent is explicitly given. This holds for a site with no consent input at all: nothing is sent, a diagnostic warning says no consent input is wired, and the held events flush on grant. A site overrides the hold only with explicit config (decision D2).

**DoR:**
- ✅ ADR-0062 point 4 and exception (a). ADR-0007 and ADR-0023 stand.
- Ground first (spec 067 section 2): every EDS adapter sets `egressPurposes: consent ? X : []` (`adapters/eds/index.js:513,792,893,1038,1150`), so with no consent input the seal is skipped and every track sends today. These adapter gates are the change site. List each in the slice notes.
- At unload `criticalDispatchGated` drops non-send verdicts (`core/airlock.js:303-315`): held events are lost on page unload. State this in the notes; persistence is out of scope.
- Ground the hold ring (spec 067 section 8, check 1): `heldBeacons` has no cap on `main`.

**Acceptance Criteria:**

1. With no consent input and no explicit override, a connector that declares any egress purpose holds, sends nothing, and a `warn` diagnostic (`kind: "consent"`, a stable reason such as `no consent input wired`) is emitted once per airlock, not once per event. "No consent input" means no `consent` boot option and no `setConsent` call by the first held beacon (sites often call `setConsent` after a consent tool loads, `core/airlock.js:778`); the warning fires at that first held beacon, not at boot.
2. A connector that declares no egress purpose also holds under the same condition, so the hold is shared and not limited to connectors with a declared purpose. Where a connector's purposes are empty, the slice names the default governing purpose it falls under and records the choice in the slice notes; the choice is policy, so it goes to the owner as D4 if no obvious purpose exists.
3. A later grant flushes the held events through the existing `heldBeacons` and `setConsent` machinery, re-mapped under the now-current consent where a `remap` exists (spec 045-01, 045-03).
4. The consent hold ring is capped, drops the oldest past the cap and emits a diagnostic when it does (architecture.md Q2, ADR-0062 point 6 exception). The cap value and its diagnostic are recorded in the slice notes and in architecture.md Q2.
5. The explicit override from D2 (recommended: boot option `consentHold: false`) turns the hold off, emits a one-time `warn` that the hold is off, and sends as stock does. The default path never reads this option as true by accident (a test passes a truthy non-boolean and the hold stays on).
6. When a site wires consent, behavior is unchanged: pending holds, denied follows ADR-0007 and ADR-0023, granted sends. A regression test pins each.
7. Tests cover the stock-default path (consent supplied as granted: stock output unchanged) and the opt-in as separate states.
8. Parity helpers used by existing rigs supply the recorded consent state, so the hold never fails a comparison.

**DoD:**
- `npm test && npm run lint` and the servo quality-gate pass.
- The warning is visible in the inspector stream (`onDiagnostic`) and the console, and is documented in `docs/architecture.md` next to the seal.

**Consumers:** Adobe 064-18 onward (vendor-adobe); Google G3; Meta M4 and the D1 row.

**Anti-horizontal-phasing check:** Vertical: seal verdict, diagnostic, override and flush on one connector, proven in the browser rig.
