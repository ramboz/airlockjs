---
status: DRAFT
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 048: Ad-connector boot wiring — the MVP8 end-to-end accept-flow

> DRAFT — drafted 2026-09-14. Closes the deferred **044-01 §A2** boot-wiring edge and the primary **047-02** follow-up
> (`docs/refinement-todo.md` § Spec 047). Provisional number (reserved `--no-push`; 048 is the next free id after 047).

## Overview

MVP8's ad-conversion connectors are **built but not yet reachable end-to-end**. Google Ads
([spec 044](../044-google-ads-connector/spec.md)) and Floodlight ([spec 046](../046-floodlight-connector/spec.md)) ship
their governed-GET beacon mappers + their `holdOnDenied` seal opt-in, and the OneTrust consent-input driver
([spec 047](../047-onetrust-consent-input-driver/spec.md)) produces + subscribes to a consent vector — but **no boot
adapter, config type, or composite membership** wires any of it onto a real page. Each connector is exercised only through
a raw `createAirlock({ egressPurposes:["ad_storage"], holdOnDenied:true, remap })` in its seal test; the seal test's own
header names this gap: *"real boot wiring in adapters/eds is the deferred edge, §A2"* (`test/google-ads-seal.test.js`).

This spec closes that edge. It adds the two ad-connector **boot adapters** + their `boot(config)` connector types + their
**composite** membership, and promotes `onetrust` to a **`boot(config)` governance field** wired to the composite consent
fan-out — so a mid-session OneTrust accept flushes held Google Ads **and** Floodlight beacons **end-to-end through the real
composite**, not against a stand-in `createAirlock`. That end-to-end proof is exactly what MVP8's release-check criteria 1+2
need demonstrated **together** ([releases/mvp8.md](../../releases/mvp8.md) § Release-Check), and it resolves the
coarse-consent OQ13-1 accept-flow residual (`docs/refinement-todo.md`, 2026-09-05 inbox note).

**What already exists (do NOT rebuild):** the connectors + their `holdOnDenied` opt-in (044-02 / 046-03, proven via
`createAirlock`); the seal's hold-until-granted re-map machinery (045-01) + the N-beacon fan-out `remapKey` (045-03); the
composite `setConsent` fan-out (`createComposite`, `adapters/eds/index.js` — it already calls every member handle's
`setConsent`); and the OneTrust driver's `resolveOnetrustBootConsent` + `subscribeOnetrustConsentChanges` (047). This spec
is **wiring + one governance-surface addition**, not new connector behavior.

**Rejected alternative (why boot adapters, not "just document `createAirlock`"):** the other boots (`bootMetaPixel`,
`bootHelixRum`, `bootGa4Gtag`, `bootAlloy`) are all first-class adapters routed through `boot(config)`; leaving the ad
connectors as raw-`createAirlock`-only would make them the only MVP8 connectors a site owner cannot select declaratively —
splitting the config surface and stranding the OneTrust-accept story as synthetic-only. The connector-shape question was
already ratified per-connector (044/046); this spec ratifies only the **boot + composite + governance-field** surface.

## Assumptions

_Load-bearing claims about runnable surfaces; the probed ones are stated as grounded in the Overview / slices, the
unverified ones are flagged here (risk-gated per ADR-0020)._

- **A1 — the ad connectors egress via the main-thread `remap`/seal seam, not a worker chamber.** `test/google-ads-seal.test.js`
  and `test/floodlight-seal.test.js` construct `createAirlock({ egressPurposes:["ad_storage"], holdOnDenied:true, remap })`
  with a `remap` function (`createGoogleAdsRemap`, `createFloodlightRemap`), and `core/airlock.js` has **no** `connector:
  "google-ads"`/`"floodlight"` selection branch (its branches are `pixel`/`dom`/`helix-rum`/`ga4-gtag`, grepped
  2026-09-14). **Assumed:** the boot adapter constructs the airlock with that same `remap` + `egressPurposes` seam and needs
  **no** new `connector:` chamber branch in `core/airlock.js`. The implementer must confirm the steady-state (non-held)
  beacon path each connector uses at boot (main-thread `pushCritical`/remap vs a worker `ready` message) and, if a worker
  chamber IS required, re-scope 048-01 (this is the frame-critique's load-bearing check).
- **A2 — no `core/airlock.js` change is needed to make an ad connector a composite member.** `createComposite` only needs a
  handle exposing `push`/`pushCritical`/`setConsent`/`getState`/`flushNow`/`stats`/`dispose` (read from `createComposite`,
  `adapters/eds/index.js`). **Assumed:** each ad boot returns that handle shape (as the other boots do), so composite
  membership + the `setConsent` fan-out work with zero core change. Confirm at implementation.
- **A3 — the config id fields per connector.** The `boot(config)` entry shape for `{type:"google-ads"}` /
  `{type:"floodlight"}` (e.g. `conversionId` / advertiser + activity ids) mirrors the connector's own config surface
  (`connectors/google-ads/connector.js` + `cookies.js`, `connectors/floodlight/connector.js`). **Assumed** the exact
  required-id set is read off those modules during 048-01/048-02, not invented here.

## Decomposition

**SPIDR — Interface axis (by connector), completed by a Path-axis capstone.** No Spike: the pattern is known — the boot
adapters mirror the existing `bootMetaPixel`/`bootHelixRum`/`bootGa4Gtag` shape, the composite fan-out already exists, and
047 already built the OneTrust subscription. Every slice is vertical: it touches the `boot(config)` / boot-adapter
**user-facing** layer and delivers end-to-end value (a real page can select the connector via config and see consent
enforced), never a boot-only or seal-only horizontal shard.

- **048-01 (Interface — Google Ads first, the reference boot):** add `bootGoogleAds` + the `{type:"google-ads"}` config
  type + composite membership, with `egressPurposes:["ad_storage"]` + `holdOnDenied` wired. End-to-end: a config-selected
  Google Ads connector holds a beacon under denied `ad_storage` and sends it under granted. Establishes the
  ad-connector-boot pattern 048-02 reuses.
- **048-02 (Interface — Floodlight, reusing the pattern):** add `bootFloodlight` + `{type:"floodlight"}` + composite
  membership, same consent wiring, both DC forms (ccm/collect + activity). Mirrors 048-01.
- **048-03 (Path — the OneTrust-accept capstone, end-to-end):** promote `onetrust` to a `boot(config)` governance field
  wired to the composite `setConsent` fan-out; prove that with Google Ads **and** Floodlight booted under denied consent
  (beacons held), a fixture OneTrust accept flushes **both** through the real composite. Resolves 047-02's primary
  follow-up + OQ13-1; records the both-fire coalesce decision.

## Slices

- [048-01 — bootGoogleAds + `{type:"google-ads"}` config type + composite membership (consent-gated)](slice-01-google-ads-boot.md)
- [048-02 — bootFloodlight + `{type:"floodlight"}` config type + composite membership (consent-gated)](slice-02-floodlight-boot.md)
- [048-03 — `onetrust` as a `boot(config)` governance field → composite consent fan-out (end-to-end accept-flow)](slice-03-onetrust-composite-governance.md)

## Out of scope

- **The true conversion ping** (a real Google Ads/Floodlight conversion event, vs the page-load family) — MVP9 (spec 044 §A3 / spec 046).
- **DMP / audience sync** (ADR-0018 Emergent E10).
- **A live-Edge / real-capture confirmation** of the booted beacons — captures are local-only (R5); this spec proves against redacted fixtures + the hermetic composite, like every prior MVP8 slice.
- **`_gcl_au` linker-cookie *writing* on a rewired page** — OQ13-b, resolves MVP9 (read-when-present / never-mint stays the 044-01 rule).
- **Growing the vision `## Use cases`** with an ad-conversion behavior — this spec is the boot/composite wiring of already-built connectors, so `use_cases: []` (declined; the ad-conversion behavior itself is 044/046). A vision-elicitation refresh covering MVP7/MVP8 behaviors is a separate follow-up.

## References

- [spec 044 — Google Ads connector](../044-google-ads-connector/spec.md) (§A2 deferred the boot wiring this spec lands)
- [spec 046 — Floodlight connector](../046-floodlight-connector/spec.md)
- [spec 047 — OneTrust consent-input driver](../047-onetrust-consent-input-driver/spec.md) (047-02's primary follow-up)
- [spec 045 — consent hold-until-granted](../045-consent-hold-until-granted/spec.md) (the seal machinery this relies on)
- [spec 032 — instrumentation config](../032-instrumentation-config/spec.md) (`boot(config)` + `KNOWN_CONNECTOR_TYPES`)
- [releases/mvp8.md](../../releases/mvp8.md) (§ Release-Check criteria 1+2)
- `docs/refinement-todo.md` § Spec 047 (the primary follow-up) + the OQ13-1 accept-flow residual
