# Contracts

Pinned external-interface contracts for airlockjs — drive-order **step 5**,
authored via `/jig:contracts`. Pinning these *before* implementation keeps
failure attribution clean: **a break against a pinned contract is a
tooling/agent failure, not spec ambiguity.** The five surfaces are
architecture.md § Contract surfaces, in priority order.

Initially pinned to what MVP1 evidence grounded; the five surfaces below (plus
the adopter boot layer) are now **frozen at 1.0**
([ADR-0017](../docs/decisions/adr-0017-airlock-1-0-api-contract.md)). Two
genuinely open aspects remain explicit carve-outs — the event-payload SCHEMA
(OQ3) and multi-chamber sync-coherence (OQ9's remaining axis) — see
"What remains open past 1.0" below.

## The five surfaces

| # | Surface | Artifact | Validation | Status |
|---|---|---|---|---|
| 1 | **GA4 Measurement Protocol** | [ga4-mp-request.schema.json](ga4-mp-request.schema.json) + [fixtures/](fixtures/) + [ga4-mp.md](ga4-mp.md) | `npm run validate` (ajv) + live `/debug/mp/collect` | **Frozen at 1.0** (external, versioned; ADR-0017) |
| 2 | **`push()` datalayer API** | [push-event.schema.json](push-event.schema.json) + [push-api.md](push-api.md) | `npm run validate` (ajv) | **Frozen at 1.0** — envelope + `push()`/`pushCritical()`→void; the event/param SCHEMA stays emergent, NOT frozen (OQ3) |
| 3 | **Connector interface** | [connector.d.ts](connector.d.ts) | `npm run typecheck` (tsc) | **Frozen at 1.0** — `AirlockEvent`/`EgressRequest`/`ConnectorManifest`/`Connector` shapes; NOT frozen: `payload`'s schema (OQ3) and multi-chamber sync-coherence (OQ9's remaining axis, capability.d.ts) |
| 4 | **Capability API** | [capability.d.ts](capability.d.ts) | `npm run typecheck` (tsc) | **Frozen at 1.0** — cookie get/set (async + single-chamber sync), CWV-safe DOM, projection snapshot, the round-trip `egress.dispatch` capability (ADR-0010), decisions-as-data (finalized 012-03); NOT frozen: multi-chamber sync-coherence and the host-internal `cookies.reconcile` sink |
| 5 | **Seam drivers** | [seams.d.ts](seams.d.ts) | `npm run typecheck` (tsc) | **Frozen at 1.0** — both driver interfaces; honestly recorded **proven-for-one** (no second implementation of either driver type has been written) |

Artifact choice follows the `/jig:contracts` recommendation table: **JSON Schema**
for data shapes (GA4 MP request, push envelope), validated with **ajv**; a
**`.d.ts`** for each code interface (a vanilla-ESM library's public surface),
type-checked with **tsc**. These are the pinned reference; the runtime implements
against them.

## Pre-1.0 contracts (documented + validated, but NOT frozen)

Distinct from the five surfaces above (external, versioned, frozen), this surface is
pinned **PRE-1.0 — explicitly NOT frozen** (spec 032-02), ratified by
[ADR-0017](../docs/decisions/adr-0017-airlock-1-0-api-contract.md)'s 1.0 API pin, which
deliberately keeps this surface experimental (it is recent — 033/034 — and still
settling): a later minor freezes what survives. It is documented + ajv-validated here so
drift is caught, but it is **not** one of architecture.md's five frozen contract surfaces.

| # | Surface | Artifact | Validation | Status |
|---|---|---|---|---|
| 6 | **Instrumentation config** (`boot(config)`) | [instrumentation-config.schema.json](instrumentation-config.schema.json) + [fixtures/](fixtures/) (`instrumentation-config-*.golden.json` / `*.negative.json`) | `npm run validate` (ajv) | **PRE-1.0 / NOT frozen** — the shape iterates until the 1.0 pin |

The project JSON config `boot(config)` (`adapters/eds/index.js`) consumes:
`{ connectors: [...], consent?, consentStrict?, payloadDenylist? }`, where each connector
entry is a **discriminated union** on `type` (`ga4` / `pixel` / `helix-rum`; nested `vendor`
∈ {`meta`,`linkedin`,`bing`} under `pixel`; helix-rum's governance-free shape). Modelled with
`oneOf` on the `type` const, golden fixtures one-per-connector + a breadth golden (ga4 + pixel +
helix-rum), and negative controls (unknown type/vendor, missing required id, wrong-typed field).

**Reference-only — no ajv in the shipped bundle.** This schema is the pinned *reference*, ajv
compiled here (a `contracts/` dev-dependency). `boot(config)`'s **runtime** validation is a
**lightweight hand-rolled subset** (loud, actionable errors) — ajv never reaches `dist/` (a
`build.mjs` assertion enforces it).

**Coverage (updated).** This config contract covers **GA4 + the three pixel vendors +
helix-rum + Adobe/alloy**. Alloy's config-surface gap named at 032-02 is CLOSED: a
`{type:"alloy"}` entry now boots both the **analytics** vertical
([spec 033-02](../docs/specs/033-alloy-config-wiring/slice-02-alloy-config-build.md), via
`bootAlloy` over `core/wrapped-sdk-host.js`) and **personalization** / decisions-as-data
([spec 033-03](../docs/specs/033-alloy-config-wiring/slice-03-alloy-decisions.md) + 034-02's
N-placement `decisionScopes`). So MVP6's named *"GA4 + Adobe/alloy"* supported subset is
covered for both verticals through this authoring surface. The schema's own top-level
`description` reflects the same coverage.

## What was resolved since these contracts were first pinned

| Open question | Resolution |
|---|---|
| **OQ9** (async-only cookie/storage) | Single-chamber SYNCHRONOUS cookie access shipped (`cookies.sync`, capability.d.ts, spec 012-01). Multi-chamber COHERENCE of that cache remains open — see below. |
| **OQ10** — egress dispatch/delivery model | Resolved: [ADR-0004](../docs/decisions/adr-0004-egress-dispatch-delivery.md) (the two-path dispatch/delivery model) + [ADR-0010](../docs/decisions/adr-0010-roundtrip-egress-capability.md) (the wrapped-SDK round-trip `egress.dispatch` capability). |
| **OQ11** — event-payload read-boundary governance | Resolved: [ADR-0012](../docs/decisions/adr-0012-payload-governance.md) — a host-owned sensitive-field denylist (spec 019-01) governs `AirlockEvent.payload` before it reaches a connector routed through the standard dispatch path. |

## What remains open past 1.0 (the only two carve-outs; [ADR-0017](../docs/decisions/adr-0017-airlock-1-0-api-contract.md))

| Open question | What it blocks in these contracts | Resolves at |
|---|---|---|
| **OQ3** — event-payload schema | `AirlockEvent.payload` is frozen as a pass-through container; its SHAPE/field-vocabulary is site-defined and not frozen | A future connector/schema spec, recorded via a follow-on ADR |
| **OQ9's remaining axis** — multi-chamber sync-coherence | The single-chamber `cookies.sync` surface (capability.d.ts) is frozen; coherence of that cache across concurrent chambers is not | A future coherence spec, recorded via a follow-on ADR |

The five surfaces (plus the adopter boot layer) are otherwise **frozen at 1.0** — see
ADR-0017.

## Validating

```bash
cd contracts
npm install
npm run validate     # ajv: golden fixtures + push examples pass; negative controls fail
npm run typecheck    # tsc --noEmit on the .d.ts interfaces (needs typescript installed)
```

`validate.mjs` is the hermetic half of the `ga4_mp_conformance` servo oracle
(R-002). The live `/debug/mp/collect` check is the complementary half, gated on
the *presence* of validation errors and kept non-blocking — see
[ga4-mp.md](ga4-mp.md).

## Changing a contract

These are external-interface contracts; a breaking change is load-bearing.
Capture the rationale in an ADR (`/jig:adr-workflow`) and update the artifact in
the same change-set. The jig boundary-change hook nudges on edits to these files.
For the surfaces that [ADR-0017](../docs/decisions/adr-0017-airlock-1-0-api-contract.md) froze
at 1.0, a breaking change additionally requires a major-version break — a superseding ADR alone
is not sufficient once a surface is frozen.
