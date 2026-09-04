# Contracts

Pinned external-interface contracts for airlockjs — drive-order **step 5**,
authored via `/jig:contracts`. Pinning these *before* implementation keeps
failure attribution clean: **a break against a pinned contract is a
tooling/agent failure, not spec ambiguity.** The five surfaces are
architecture.md § Contract surfaces, in priority order.

Contracts are pinned to what MVP1 evidence grounds. Where a surface is coupled
to an open question (OQ9/OQ10/OQ11/OQ3), the groundable part is pinned and the
rest is marked deferred inline — the same discipline the accepted ADRs used.

## The five surfaces

| # | Surface | Artifact | Validation | Status |
|---|---|---|---|---|
| 1 | **GA4 Measurement Protocol** | [ga4-mp-request.schema.json](ga4-mp-request.schema.json) + [fixtures/](fixtures/) + [ga4-mp.md](ga4-mp.md) | `npm run validate` (ajv) + live `/debug/mp/collect` | **Pinned** (external, versioned) |
| 2 | **`push()` datalayer API** | [push-event.schema.json](push-event.schema.json) + [push-api.md](push-api.md) | `npm run validate` (ajv) | **Pinned** envelope; schema emergent (OQ3) |
| 3 | **Connector interface** | [connector.d.ts](connector.d.ts) | `npm run typecheck` (tsc) | **Pinned** shape; async host-calls only (OQ9), egress request not dispatch (OQ10), payload gov. (OQ11) |
| 4 | **Capability API** | [capability.d.ts](capability.d.ts) | `npm run typecheck` (tsc) | **Pinned** MVP1 (async cookie/storage, CWV-safe DOM, snapshot); sync-access (OQ9), egress dispatch (OQ10), decisions-as-data sketched |
| 5 | **Seam drivers** | [seams.d.ts](seams.d.ts) | `npm run typecheck` (tsc) | Decision-source **pinned**; egress driver interface pinned, dispatch semantics **deferred** (OQ10) |

Artifact choice follows the `/jig:contracts` recommendation table: **JSON Schema**
for data shapes (GA4 MP request, push envelope), validated with **ajv**; a
**`.d.ts`** for each code interface (a vanilla-ESM library's public surface),
type-checked with **tsc**. These are the pinned reference; the runtime implements
against them.

## Pre-1.0 contracts (documented + validated, but NOT frozen)

Distinct from the five surfaces above (external, versioned, frozen), this surface is
pinned **PRE-1.0 — explicitly NOT frozen** (spec 032-02): the MVP6 real-site validation
is meant to *exercise* the shape, and the later **1.0 API pin** freezes what settles.
It is documented + ajv-validated here so drift is caught, but it is **not** yet one of
architecture.md's five frozen contract surfaces.

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

**Coverage gap (honest).** This config contract covers **GA4 + the three pixel vendors +
helix-rum**, but **NOT Adobe/alloy**: alloy has no adapter boot (it is hosted via
`core/wrapped-sdk-host.js` + `connectors/alloy/*`), so a `{type:"alloy"}` entry is alloy's
first-ever adapter boot — spike-sized, **deferred to its own spec** (recorded in
[`docs/refinement-todo.md`](../docs/refinement-todo.md) § *alloy config-wiring* with a resolution
trigger). So MVP6's named *"GA4 + Adobe/alloy"* supported subset is only **partially** covered by
this authoring surface until that spec lands. The gap is also stated in the schema's own
top-level `description` and in the root `README.md` "Configure airlock" section.

## What is deliberately deferred (and where it resolves)

| Open question | What it blocks in these contracts | Resolves at |
|---|---|---|
| **OQ9** — MVP2 multi-chamber synchronous host-access | The capability API exposes only **async** cookie/storage; a stock vendor SDK needs synchronous access whose multi-chamber coherence is unproven | Model-agnostic coherency probe **before** the contract freezes for MVP2 |
| **OQ10** — egress dispatch/delivery model | The egress *request* is pinned; where `fetch` runs, delivery-under-load, and the unload path are not (seams `dispatch` signature is provisional) | The risk-retirement spike (measured) + a dedicated egress ADR |
| **OQ11** / **OQ3** — event-payload governance & schema | `AirlockEvent.payload` is pass-through; a denylist model and any pinned event schema are deferred | Connector contract work, jointly with the OQ3 schema call |

MVP1 (first-party GA4, wire-protocol) is fully served by the pinned surfaces. The
deferred parts are the MVP2 / wrapped-SDK (alloy) needs, designed-for but not
frozen (per accepted ADR-0001/0003).

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
