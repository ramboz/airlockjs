---
status: DRAFT
dependencies: [041-01]
last_verified:
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
- [ ] All ACs pass; full suite green.
- [ ] Coverage: a config with a `"ga4-gtag"` entry boots the gtag connector through `boot(config)`; a malformed gtag
      entry is rejected by `validateConnectorEntry` + the schema; governance threads through. Each new-feature test fails
      on revert.
- [ ] Reviewed by `reviewer` (compliance + craft).
- [ ] Deviation log + reconciliation sweep produced.

## Assumptions

- **Mechanical registration following the `ga4`/`pixel` precedents** — a new `KNOWN_CONNECTOR_TYPES` entry, a switch
  case, an events const, and a schema `type` const/shape. No new load-bearing assumption (hence no `frame_review`); the
  only judgment is the config shape for the gtag-specific fields (`streamCookieName`, `consentDefault`), which mirror
  041-01/02's `connectorConfig`.

## Anti-horizontal-phasing check

After this slice a rewired page's declarative instrumentation config (the real EDS integration surface) can select the
gtag connector — the wiring is complete from config JSON → live `/g/collect` egress.

### Deviation log (after reconciliation)

_TBD at implementation._

### Reconciliation sweep

_TBD at implementation._
