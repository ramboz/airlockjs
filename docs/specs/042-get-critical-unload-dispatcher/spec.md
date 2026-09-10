---
status: IN_PROGRESS
skill:
use_cases: [UC-2]
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on first use and link the term to docs/memory/glossary.md (or jig's lexicon). See docs/workflow.md "Self-defining vocabulary". -->

# Spec 042: GET-shaped unload-critical dispatcher

> Resolves the deferred item in [refinement-todo.md](../../refinement-todo.md)
> ("Worker-mapped GET-egress connectors DROP their ring tail at teardown — no
> GET critical dispatcher") and the inbox follow-on in
> [inbox.md](../../inbox.md) (the 030-01 `method`-option un-defer).

## Overview

Worker-mapped **GET-egress** connectors — `pixel` and `ga4-gtag`, together the
`workerMappedGetEgress` class — currently **drop their ring tail at page
teardown**. `core/airlock.js` gates them out of the `visibilitychange` /
`pagehide` unload wiring and drops their `pushCritical`, so any event still
buffered in the ring at unload is silently lost — a bounded, disclosed
unload-loss, never mis-mapped. This spec closes that gap: those connectors flush
their unload-window tail as correct **GET** beacons.

**The gap, precisely.** The synchronous unload path routes through
`createCriticalDispatcher` (`core/egress.js`), which is **POST-only**: it maps
`event → object → JSON.stringify → body` and issues one
`fetch(endpoints[t], { method: "POST", body, keepalive: true })` per tracker.
Spec 030-01's `mapper` DI generalized *who* maps but stayed POST-shaped
(`mapToRum` also returns a body). A GET connector's mapper (gtag's
`mapToGtagCollect`, pixel's declarative projection) instead returns
`EgressRequest[]` — `{ url, method: "GET" }`, params in the URL, **no body, no
per-tracker loop**. Wiring the POST dispatcher for a GET connector would
MP-mis-map the beacon to a POST-shaped destination, so gating them out (drop)
was the safe neutralization disclosed by spec 026 (pixel) and 041-01 (gtag).

**Current state (grounded 2026-09-10).**
- `createCriticalDispatcher` is POST-only — `mapper(event, ctx)` → `JSON.stringify` → `fetch(endpoints[t], { method:"POST", body, keepalive:true })` ([core/egress.js:70-88](../../../core/egress.js)).
- The **steady-state** worker path already dispatches GET correctly via `fetchInit` — GET omits `body` ([core/airlock.js:53-55](../../../core/airlock.js), `:305-324`).
- The unload gate: `workerMappedGetEgress = connector === "pixel" || connector === "ga4-gtag"` ([core/airlock.js:506](../../../core/airlock.js)) skips the unload wiring (`:513-516`); `pushCritical` drops for the same class (`:583-590`).
- Both GET connectors' `handle()` are pure, Node-importable `EgressRequest[]`-returning functions ([connectors/ga4/gtag.js](../../../connectors/ga4/gtag.js), [connectors/pixel/connector.js](../../../connectors/pixel/connector.js)), constructed in-worker via `createConnectorHost(createXxxConnector, config)` where `config` is the init message minus its `type` discriminant ([core/ga4-gtag-chamber.worker.js](../../../core/ga4-gtag-chamber.worker.js), [core/pixel-chamber.worker.js](../../../core/pixel-chamber.worker.js)); `core/airlock.js:262` posts `{type:"init", ...connectorConfig}`, and `routeBatch` calls `handle` on the raw `{seq,type,ts,params}` descriptor ([core/connector-host.js:70-76](../../../core/connector-host.js)).

**Approach.** Extend `createCriticalDispatcher` with an optional
`requestMapper: (event) => EgressRequest[]` path; when present it dispatches
each request GET/POST-aware (the same `fetchInit` shape the steady-state seam
uses — shared, not duplicated), bypassing the POST body/per-tracker path. The
legacy `mapper` (POST) path stays **byte-identical** for GA4-MP and helix-rum.
`core/airlock.js` constructs the main-thread `requestMapper` from the
connector's own factory (`createGa4GtagConnector(connectorConfig).handle` /
`createPixelConnector(connectorConfig).handle` — byte-identical to the worker,
A1), removes the `workerMappedGetEgress` gate-out of the unload wiring, and
un-gates `pushCritical` for the class. Mirrors the existing
`connector === "helix-rum"` mapper-selection branch
([core/airlock.js:188-200](../../../core/airlock.js)).

**Preserved by design (inherited residuals, NOT re-opened here):**
- The unload/critical path **bypasses the endpoint ceiling** (host-trusted mapper) — the existing design fact ([spec 030-02](../030-rum-subsume/slice-02-rum-authority.md)); the GET URL is produced by the host-constructed connector `handle`, the same trust level as the POST `mapToMp` / `mapToRum` on this path.
- An unload GET carries **boot-time** consent in `gcs`/`gcd` (the 017-01 worker-ctx-resend residual — a flushed beacon carries boot-time reshape). The live consent **verdict** gate (`criticalDispatchGated`) still applies — an un-granted purpose still DROPs at teardown.
- Input-side payload governance (`governParams`) still runs before the mapper, exactly as on the POST path.

## Assumptions

- **A1 — main-thread reconstruction is byte-identical (grounded; re-verify at implementation).** `createGa4GtagConnector(connectorConfig).handle(event)` / `createPixelConnector(connectorConfig).handle(event)` on the main thread produce the same `EgressRequest[]` the worker chamber does for the same governed descriptor. Grounded: both chambers construct via `createConnectorHost(createXxxConnector, config)` with `config` = the init message minus its `type` discriminant (`core/{ga4-gtag,pixel}-chamber.worker.js`), `core/airlock.js:262` posts `{type:"init", ...connectorConfig}`, `routeBatch` calls `connector.handle(event)` on the raw `{seq,type,ts,params}` descriptor (`core/connector-host.js:70-76`), and both `handle`s are pure functions of `config` + `event.type` + `event.params||event.payload` with a no-op `init`. **Residual to re-verify at implementation:** no chamber-side transform sits between the init message and `handle` for either connector (init is a no-op today; confirm it stays so). **Bound (frame-critique):** the byte-parity holds only while `connectorConfig.ctx` is a **frozen boot snapshot** — a hermetic Node test cannot catch a structured-clone divergence a real Worker would show (the worker gets a deep copy of `connectorConfig` at `postMessage` init; the main-thread `requestMapper` binds the live reference). The two are symmetric today because both consume the immutable boot-time `ctx` with no per-event resend (017-01 deferred) and `handle` is stateless; a future 017-01 ctx-resend into the worker without a matching main-thread refresh would silently break it. 042-01 AC5 asserts parity against the worker `routeBatch` path (not a self-comparison) and records this bound.
- **A2 — GET beacons don't consume the keepalive body budget.** A GET carries no request body (`fetchInit` omits it), so it contributes ~0 to Chrome's aggregate keepalive request-body cap (architecture.md § Tech stack). The GET unload path therefore dispatches without body-budget accounting — consistent with the steady-state GET path, which already dispatches GET survivors with no budget check. URL-length limits are a separate, unbudgeted boundary (named, not enforced by this spec).

## Decomposition

SPIDR — **Interface / Rules split by connector** (S not used; no research needed
— the mechanism is grounded above, not an open unknown).

Considered **one slice** (the whole class at once, as the refinement-todo frames
it) but split by connector for cleaner review boundaries and two distinct
witnessed hazards (GA4 analytics teardown vs. ad-pixel teardown), matching the
030 precedent (build the core mechanism + wire the first consumer, then
generalize). Each slice is vertical — the `core/egress.js` + `core/airlock.js`
seam plus real connector wiring plus a witnessed page-hide GET beacon — so
neither is horizontal phasing.

- **042-01** builds the `requestMapper` GET path in `core/egress.js` and wires it for **ga4-gtag** (UC-2 analytics — the primary consumer, `/g/collect`), witnessed end-to-end. `arch_review: true` (changes the `createCriticalDispatcher` module seam).
- **042-02** generalizes the wiring to **pixel** (the ad-vendor parity class, Meta/LinkedIn/Bing `/tr`), reusing 042-01's mechanism and retiring the now-empty `workerMappedGetEgress` gate. Depends on 042-01.

## Slices

- [042-01 — GET-critical dispatcher + ga4-gtag unload flush](slice-01-get-critical-dispatcher-gtag.md)
- [042-02 — generalize the GET-critical unload flush to pixel](slice-02-pixel-unload-flush.md)
