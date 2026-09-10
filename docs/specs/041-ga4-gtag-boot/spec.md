---
status: DONE
skill:
use_cases: []
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 041: GA4 gtag connector — live boot wiring

> **DONE (2026-09-10) — the GA4 gtag connector is fully live.** Specs 039 + 040 built the gtag (`/g/collect`) field
> mapper + Consent-Mode/session-state carriage + the coalescing/batching stack, but it was DORMANT (not wired into any
> boot path). This spec turned it on, applying the established connector-hosting pattern (no new ADR — execution of
> ADR-0001/0002 off-thread, ADR-0006/0007 declaration+consent, ADR-0019 gtag protocol, ADR-0021 batching). All four
> slices DONE + landed:
> - **041-01** — `createGa4GtagConnector` is a `Connector` (`{manifest, init, handle}`); a new egress-confined
>   `core/ga4-gtag-chamber.worker.js`; the `"ga4-gtag"` `createAirlock` branch + `build.mjs` entry; a minimal
>   `bootGa4Gtag` (cid/sid + consent seal). A page's `page_view` fires a real `/g/collect` GET. (Generalized pixel's
>   AC10 mis-map guard to `workerMappedGetEgress`.)
> - **041-02** — host-side `writeGa4SessionState` (its first caller) + the raw consent-vector fold, so live beacons
>   carry session-state + `gcs`/`gcd`, with the write's `sessionId` overriding the pre-write `sid` for consistency.
> - **041-03** — `coalesce: coalesceGa4` wired, so same-context bursts egress as batched `/g/collect` POSTs.
> - **041-04** — declarative `type: "ga4-gtag"` config selection (KNOWN_CONNECTOR_TYPES + `bootConnector` switch + JSON
>   Schema), governance threaded like ga4/pixel; the config `endpoint` override wired end-to-end.
>
> **End-to-end:** declarative config → egress-confined worker chamber → session-state + Consent-Mode payload → batched
> `/g/collect` egress, governed throughout. Tracked follow-ups (non-blocking, in `docs/refinement-todo.md`): the
> boot-snapshot-ctx post-boot-update deferral (017-01 residual, shared with MP); a GET-shaped unload-critical dispatcher
> (shared with pixel — the ring tail is dropped, not mis-mapped, at teardown); and the n=1 batch-marker live-accept
> DebugView re-validation (from spec 040).

## Overview

The GA4 gtag connector is the last mile of the MVP7 "rewire a real intuit-class site's GA4 from its Tealium/GTM
container to airlock" goal: spec 039 proved the wire protocol and spec 040 the batching, but a page cannot yet *run*
either. Concretely (grounded against the code, 2026-09-09):

- `createGa4GtagConnector` (`connectors/ga4/gtag.js:321-340`) returns **`{ handle }` only** — no `manifest`, no
  `init(caps)` — so `core/connector-host.js` (which reads `connector.manifest` at `:89` and calls `init`) cannot host
  it. Its own doc comment (`:299-306`) says a `Connector`-conforming wrapper "remains host-wiring work for a later
  slice." **That later slice is this spec.**
- There is **no gtag chamber worker** (`core/*gtag*` is empty), **no `"ga4-gtag"` branch** in `createAirlock`'s
  connector-selection seam (`core/airlock.js:239-258`), **no `build.mjs` worker entry** (`WORKER_ENTRIES:62-67`), and
  **no EDS boot function** (`adapters/eds/index.js`) — so nothing constructs or boots it.
- `coalesceGa4` (`connectors/ga4/coalesce.js`) and the core coalescing seam (`core/airlock.js:380-412`) are live and
  ready, but `coalesce` is passed only in tests — no boot wires it.
- `writeGa4SessionState` (`connectors/ga4/cookies.js:313-362`, the host-side `_ga_<stream>` read-modify-write that
  produces the beacon's session-state) has **zero callers** today; `sourceGa4Ctx` (the `cid`/`sid` sourcer) IS wired
  (in `bootGa4Core:392`) and is the precedent to imitate.

Every missing piece has a byte-for-byte analog: **pixel's chamber mechanics** (`core/pixel-chamber.worker.js` +
`core/confine-pixel-chamber.js`, GET/postMessage-egress twin of gtag — both withhold `fetch` in-worker) for the
plumbing, and **`bootGa4Core`** (`adapters/eds/index.js:365-476`) for the host-side ctx/consent sourcing. The gtag boot
is "pixel's chamber + GA4-MP's host ctx-sourcing, retargeted at `/g/collect`, with a `Connector` wrapper added to
`gtag.js`."

## Assumptions

- **The connector-hosting pattern is established and directly applicable (grounded, not novel).** A hostable connector
  is `{ manifest, init, handle }` (`contracts/connector.d.ts:166-181`); `createGa4Connector`
  (`connectors/ga4/connector.js:72-157`) and `createPixelConnector` are the wrapper precedents; chamber workers are thin
  glue over `createConnectorHost` (`core/connector-host.js:40-89`) that first-import a confinement module; the
  `createAirlock` seam (`core/airlock.js:239-258`) selects a static-literal worker URL per `connector` value and posts
  an init message (`connectorConfig` verbatim for the non-GA4 branches). gtag's `handle` already returns the
  contract-shaped `EgressRequest[]`. So the wrapper is small (add `manifest` + no-op `init`) and the chamber/branch/build
  entry mirror pixel exactly. (Why the slices are Interface/Path, not Spike.)
- **gtag reads identity/consent/session-state from `config.ctx`, not from worker capabilities** (grounded:
  `gtag.js:251-292` reads `ctx.clientId`/`ctx.sessionId`/`ctx.consent`/`ctx.consentDefault`/`ctx.sessionState`). So the
  chamber wires no capabilities (`host.init({})`, like pixel/GA4-MP), and ALL identity/session/consent sourcing happens
  **host-side before `createAirlock`** — exactly `bootGa4Core`'s posture. `init(caps)` is a no-op for contract
  conformance only.
- **The host-side `_ga_<stream>` session-state write is a main-thread cookie mutation — a sanctioned boundary (039-03).**
  `writeGa4SessionState` lives host-side by design (039-03 arch review: cookies are an orchestrator/host concern, the
  same place `sourceGa4Ctx`'s `_ga` read lives), so wiring its first caller in the EDS boot is applying that decision,
  not making a new one. It needs a concrete `streamCookieName` from host config (it cannot scan like the read-side
  `findGaStreamCookie`). (Why the session-state slice carries `arch_review`.)
- **The endpoint ceiling is `/g/collect`, NOT `/mp/collect`.** The gtag boot must declare `GA4_GTAG_COLLECT_ENDPOINT`
  (`gtag.js:48`) as the endpoints ceiling, not the MP `DEFAULT_ENDPOINTS` (`adapters/eds/index.js:62`).
- **gtag's consent fold is the RAW ADR-0007 vector, not `shapeMpConsent`'s output.** `gtag.js:100-107`
  `encodeGcs`/`encodeGcd` consume the raw `{ad_storage,analytics_storage,ad_user_data,ad_personalization}` vector; the
  boot folds it into `connectorConfig.ctx.consent` (+ `ctx.consentDefault`), a DIFFERENT mechanism from the MP path's
  `shapeMpConsent`. The egress seal itself is governed by `analytics_storage` (like MP).

## Decomposition

**SPIDR — Interface + Path (no Spike): the pattern is known, the work is applying it.** Split by boot-path completeness
(happy path first), each slice a vertical cut through the runtime that a page can actually exercise end-to-end.

- **041-01 (Interface/Path — the connector boots and egresses):** make `createGa4GtagConnector` a `Connector` (add
  `manifest` + no-op `init`); add a `core/ga4-gtag-chamber.worker.js` + `core/confine-ga4-gtag-chamber.js` (mirror
  pixel); add the `"ga4-gtag"` `createAirlock` branch (worker URL + verbatim-`connectorConfig` init) + the `build.mjs`
  entry; add a minimal `bootGa4Gtag` in the EDS adapter sourcing `cid`/`sid` via `sourceGa4Ctx` + wiring the consent
  seal. End-to-end: a page boots gtag and a `page_view` fires a real `/g/collect` GET (v/tid/cid/sid) through the
  governed chamber→host→dispatch path. (`arch_review` — new egress-confined worker boundary + connector-selection
  branch.)
- **041-02 (Data — session-state + Consent-Mode carriage on the live path):** wire the host-side `writeGa4SessionState`
  (session-state `sct`/`seg`/`_fv`/`_ss`/`_nsi` into `ctx.sessionState`, gated on `analytics_storage`) and the raw
  `ctx.consent`/`ctx.consentDefault` fold (so live beacons carry `gcs`/`gcd`). End-to-end: the live gtag beacon now
  carries the full 039-02/03/05 payload, not just the 039-01 core. (`arch_review` — first caller of the host-side
  `_ga_<stream>` cookie write.)
- **041-03 (Interface — batching on the live path):** pass `coalesce: coalesceGa4` in the gtag boot. End-to-end: a
  same-context event burst on a rewired page egresses as batched POSTs (the 040 payoff), through the real seam.
- **041-04 (Interface — declarative config selection):** register `"ga4-gtag"` in `KNOWN_CONNECTOR_TYPES`, the
  `bootConnector` switch, a `*_MANIFEST_EVENTS` const, and the instrumentation-config JSON Schema. End-to-end: a page's
  declarative instrumentation config can select the gtag connector (not only the programmatic `bootGa4Gtag` call).

## Slices

- [041-01 — gtag connector boots + egresses (Connector wrapper + chamber + createAirlock branch + minimal boot)](slice-01-connector-boot.md)
- [041-02 — session-state + Consent-Mode carriage on the live path](slice-02-session-consent-wiring.md)
- [041-03 — batching on the live path (coalesceGa4 wired)](slice-03-coalesce-wiring.md)
- [041-04 — declarative instrumentation-config selection](slice-04-config-selection.md)
