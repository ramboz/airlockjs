---
status: DONE
dependencies: [041-01]
last_verified: 2026-09-10
---

## Slice 041-04 — declarative instrumentation-config selection

**Goal:** Let a page's declarative instrumentation config select the gtag connector (`type: "ga4-gtag"`), not only the
programmatic `bootGa4Gtag` call — so a rewired page's config JSON can turn on gtag the same way it turns on `ga4`/`pixel`/
`helix-rum`/`alloy`.

**Blocked-on:** 041-01 (the `bootGa4Gtag` fn the switch dispatches to).

## Current state (grounded)

- Config-driven selection lives in `adapters/eds/index.js`: `bootConnector(entry, …)` `switch (type)` (`:1388-1423`)
  dispatches per `type`; `KNOWN_CONNECTOR_TYPES = ["ga4","pixel","helix-rum","alloy"]` (`:1230`); `validateConnectorEntry`
  (`:1278`) gates against it; the JSON Schema (`contracts/instrumentation-config.schema.json`) enumerates only those four
  `type` consts. **No `"ga4-gtag"`.**
- Precedent: the `"ga4"` case (`:1392-1393`) → `bootGa4Core(...)` with `GA4_MANIFEST_EVENTS` (`:1211`).

**Acceptance Criteria:**

1. **`"ga4-gtag"` is a selectable config type.** Add `"ga4-gtag"` to `KNOWN_CONNECTOR_TYPES`, a `bootConnector` switch
   case → `bootGa4Gtag({...rest, ...governance})` with an events manifest const (a `GA4_GTAG_MANIFEST_EVENTS`, `["*"]`
   like GA4), and a `type` const + config shape in `contracts/instrumentation-config.schema.json` (measurementId +
   the gtag-specific fields: `streamCookieName`, `consentDefault`, endpoint override). `validateConnectorEntry` accepts a
   well-formed gtag entry and still rejects an unknown type.
2. **Governance threads through.** A gtag entry receives the composite `governance` (consent / consentStrict /
   payloadDenylist) exactly as the `"ga4"`/`"pixel"` cases do — no governance-exemption (unlike helix-rum).

**DoD:**
- [x] All ACs pass; full suite green (95 files / 1472 tests).
- [x] Coverage: a config with a `"ga4-gtag"` entry boots the gtag connector through `boot(config)`; a malformed gtag
      entry (missing OR non-string `measurementId`, unknown type) is rejected by `validateConnectorEntry` + the schema;
      governance threads through (byte-equal `createAirlock` inputs vs standalone `bootGa4Gtag`, consent engaged); the
      endpoint override reaches both `connectorConfig.endpoint` and the ceiling. Each new-feature test fails on revert.
- [x] Reviewed by `reviewer` (compliance + craft — both PASS).
- [x] Deviation log + reconciliation sweep produced.

## Assumptions

- **Mechanical registration following the `ga4`/`pixel` precedents** — a new `KNOWN_CONNECTOR_TYPES` entry, a switch
  case, an events const, and a schema `type` const/shape. No new load-bearing assumption (hence no `frame_review`); the
  only judgment is the config shape for the gtag-specific fields (`streamCookieName`, `consentDefault`), which mirror
  041-01/02's `connectorConfig`.

## Anti-horizontal-phasing check

After this slice a rewired page's declarative instrumentation config (the real EDS integration surface) can select the
gtag connector — the wiring is complete from config JSON → live `/g/collect` egress.

### Deviation log (after reconciliation)

Implemented in `adapters/eds/index.js` (`GA4_GTAG_MANIFEST_EVENTS`, `"ga4-gtag"` in `KNOWN_CONNECTOR_TYPES`, the
`validateConnectorEntry` gtag check, the `bootConnector` `case "ga4-gtag":` → `bootGa4Gtag`) +
`contracts/instrumentation-config.schema.json` (the `ga4GtagConnector` `$def` in the `oneOf`) + 4 test files. Both
gating passes (compliance + craft) PASS. Deviations + fold-ins:

1. **Endpoint override was a NO-OP field until an in-slice gap-fix (both reviewers; folded).** The schema declared an
   optional `endpoint` and the `bootConnector` switch threaded it via `...rest`, but `bootGa4Gtag` (from 041-01)
   hardcoded `GA4_GTAG_COLLECT_ENDPOINT` at BOTH the `connectorConfig.endpoint` site AND the `endpoints:[…]` ceiling —
   silently ignoring the override (a misleading config knob). Fixed: `bootGa4Gtag` now destructures
   `endpoint = GA4_GTAG_COLLECT_ENDPOINT` from opts and uses it at both sites, so a config-supplied endpoint egresses
   there AND the ceiling widens to allow it (an override that dead-ends in a ceiling-hold is worse than no override).
   This touched 041-01's `bootGa4Gtag`, but it is completing the config surface THIS slice introduces (the ga4/pixel
   precedents both honor endpoint overrides) — not a redesign. Tested: custom-endpoint egress + no ceiling-hold +
   default preserved when absent.
2. **`GA4_GTAG_MANIFEST_EVENTS` is a deliberate separate const from `GA4_MANIFEST_EVENTS` (both `["*"]`).** A
   future-divergence hedge (gtag's event manifest may diverge from MP's), not accidental duplication — documented at the
   const.
3. **Review-driven test tightenings folded (post-pass):** added `expect(initMsg().endpoint).toBe(CUSTOM_ENDPOINT)` to the
   override test (was proving only the ceiling side, not `connectorConfig.endpoint`); added a non-string
   (`measurementId: 12345`) rejection test exercising the runtime `validateConnectorEntry` guard's `typeof !== "string"`
   branch (the missing-field case was already tested at both layers).

**No deviation from:** the mechanical-registration scope (KNOWN_CONNECTOR_TYPES + switch + events const + schema), the
governance threading (identical to ga4/pixel, no helix-rum-style exemption), or the closed-`oneOf` schema shape.

### Reconciliation sweep

- **`docs/refinement-todo.md` / `docs/inbox.md`:** nothing new.
- **Deferred / carried forward:** none new — the endpoint override was completed here rather than deferred.
- **Spec 041 roll-up:** with 041-01..04 all DONE, the GA4 gtag connector is fully live end-to-end — declarative config
  (`type: "ga4-gtag"`) → egress-confined worker chamber → session-state + Consent-Mode payload → batched `/g/collect`
  egress, governed throughout. Spec 041 returns to DONE at close-out (spec-level status + board + the architecture
  connector inventory).
- **`docs/architecture.md`:** the connector inventory should gain the `ga4-gtag` live entry at close-out (it currently
  lists the pure gtag mapper from 039; 041 makes it bootable).
- **Full suite:** 95 files / 1472 tests green.
