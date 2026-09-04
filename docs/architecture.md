> Status: Draft (wizard-generated)

# Architecture — Airlock

> Pre-seeded 2026-08-25 to the `jig:vision-elicitation` architecture contract: five elicitation slots (Repository structure, Tech stack, Module boundaries, Data model, Contract surfaces) plus two marker-less sibling sections (Core architecture decisions, Open questions) populated by ADRs and refinement-todos. Run `/jig:arch-review` on this file, then promote the proto-ADRs below into real ADRs via `/jig:adr-workflow new` and resolve the MVP1-blocking open questions before SPIDR-splitting.
>
> Vocabulary: **the airlock** = the mediated boundary; a **chamber** = a connector's sandbox; a **cycle** / **lock-through** = a batch crossing to the worker; **the seal** = consent/allowlist gating. Repo/package slug: `airlockjs`; connector namespace `airlock/*`.

## Repository structure

<!-- elicited: 2026-08-25 / status: filled -->

A framework-agnostic runtime core, with EDS as the first adapter and connectors as a pluggable directory:

- `core/` — the orchestrator, event log, state projection, capability broker, and worker-runtime host. No framework or vendor coupling.
- `core/worker/` — the connector runtime (chambers) that runs inside the Web Worker.
- `adapters/eds/` — EDS integration: the three-phase hooks, block-decoration instrumentation, in-house decisioning for the eager window.
- `connectors/ga4/` — MVP1 wire-protocol connector (Measurement Protocol). `connectors/alloy/` — MVP2 wrapped-SDK connector. Registry namespace `airlock/ga4`, `airlock/alloy`.
- `diagnostics/` — the `PerformanceObserver` wrappers and the inspector surface (reuses/vendors `aem-cwv-helper` primitives).
- `test/` — vitest suites, including the oracle components servo will score.
- `.jig/` — durable workflow state.

## Tech stack

<!-- elicited: 2026-08-25 / status: filled -->

ES modules, no runtime framework dependency. Web Worker for the connector runtime, communicating by **batched `postMessage`** (structured clone) — each drain is a cycle — explicitly **not** SharedArrayBuffer, avoiding the COOP/COEP cross-origin isolation that breaks embeds. Egress via `fetch(url, { keepalive: true })` **dispatched on the main thread** by the orchestrator — the worker maps off-thread and returns ready requests, plus a main-thread synchronous fast path for the unload window (ADR-0004 "Option C"; mind the ~64KB aggregate keepalive body cap when batching). `PerformanceObserver` for INP/CLS/LCP attribution. vitest for tests. GA4 Measurement Protocol as the external, machine-validatable contract.

## Module boundaries

<!-- elicited: 2026-08-25 / status: filled -->

This is the load-bearing section. The system is one privileged main-thread module and one unprivileged worker, connected by the airlock:

- **Capture layer** (main thread, pre-LCP): a few delegated passive listeners at the document root that write minimal event descriptors into a ring buffer. No processing during the LCP window.
- **Orchestrator** (main thread): the *only* martech code with DOM access. Owns the append-only event log, the synchronous state projection, the `WeakMap` element→data associations, consent state, and the capability broker. Drains the ring buffer on idle and cycles batches to the worker.
- **Worker runtime** (off-thread): hosts connectors, each in its own chamber. Connectors consume typed events, build vendor payloads, and emit egress. **No DOM, no ambient globals.**
- **The airlock (capability bridge)**: connectors request mediated capabilities rather than reaching for browser APIs. DOM injection is fulfilled by the orchestrator *through* `reserveSpace` / `insertAfterInteraction`, so injected content is CWV-safe by construction. Egress is fulfilled through the egress seam and held at the seal until consent/allowlist pass.
- **Two seams (drivers swappable from day one, only local variants shipped in MVP)**: a **decision source** seam (local | edge) and an **egress** seam (direct keepalive | service-worker chokepoint | edge-proxied).

## Data model

<!-- elicited: 2026-08-25 / status: filled -->

The datalayer is deliberately split into the two objects that ACDL and GTM conflate:

- **Event descriptor** — the minimal record a `push` writes on the interaction path (type + payload-ref + timestamp). Cheap to create; this is what keeps INP low. *(Exact shape is OQ2.)*
- **Event log** — append-only, ordered, the source of truth. Cycles to the worker in batches; ordering preserved across the lock-through.
- **State projection** — derived from the log, held in the orchestrator, read synchronously. `Map` for keyed state, `WeakMap` for element associations. A `push` folds its event into the projection synchronously (so synchronous readers see current state) *and* enqueues for the worker (so processing is off-thread) — the split that resolves `patchDatalayer`'s async-read caveat.
  - *WeakMap ownership (clarified, spec 006 arch review):* the orchestrator's `WeakMap` holds **projection / cross-airlock** element→data associations. An **adapter** may keep its own **transient, module-local** element→lookup `WeakMap` for adapter-specific metadata that deliberately does NOT enter the vendor-neutral `core/` projection or cross the airlock — e.g. `adapters/eds/blocks.js`'s element→`{ block_name }` map (UC-3): EDS block names are an EDS concern, so they stay adapter-local rather than leaking into `core/`.
- **Projection snapshot slice** — the bounded, privacy-filtered subset of projection state that crosses the airlock to the worker alongside each event for enrichment. *(What is allowed to cross is OQ4.)*

## Contract surfaces

<!-- elicited: 2026-08-25 / status: filled -->

Feeds `/jig:contracts`. Five surfaces, in priority order:

1. **GA4 Measurement Protocol** — external, versioned, validatable at `/debug/mp/collect`. The MVP1 conformance oracle.
2. **The `push()`-shaped datalayer API** — the drop-in compatibility surface (loosely GTM/ACDL-shaped) that maps onto the event-log/projection split underneath.
3. **The connector interface** — what a connector implements: consume typed events → request capabilities → emit to a declared endpoint. A mapper MAY **throw** on contract-invalid input (e.g. GA4 `mapToMp` rejects a `purchase` missing `transaction_id`/`currency`/`value`/`items[]`, spec 008); the airlock isolates that throw to the failing **descriptor** per Q1 — a per-event catch in the generic connector host (`core/connector-host.js` `routeBatch`, spec 012-01, converged onto by GA4 in spec 014-03; formerly a GA4-hardcoded per-descriptor catch in `chamber.worker.js`'s retired `mapBatch`, spec 009-01) drops just that event and records it in the cycle's `dropped[]`, and the main thread surfaces each drop plus any chamber-level `worker.onerror` through an injectable diagnostics seam (spec 009-02). OQ14 **resolved**; the unload/critical fast path is not yet routed through `routeBatch` (**OQ16** — by design, spec 014-03: the synchronous unload path stays a separate, worker-independent path reusing the byte-identical `mapToMp` directly, `core/egress.js`).
4. **The capability API** — what the orchestrator grants across the airlock (mediated DOM injection, mediated egress) and how scopes are declared.
5. **The seam driver interfaces** — decision-source and egress driver contracts.

> **Measurement surface (not a caller-facing API).** The before/after CWV scoreboard — the "punchline" success criterion in product-vision § Use cases — doubles as the servo oracle. Its measurement contract (INP threshold, Lighthouse score, the `ga4_mp_conformance` / `cwv_budget` / `isolation_invariant` oracle components) is not a public interface but must be pinned before the spike loop runs; tracked as OQ6. **Resolved by spec 007 / [ADR-0005](decisions/adr-0005-oracle-design.md):** the three are routed by oracle strength — `ga4_mp_conformance` is the hermetic servo-unattended gate (`oracle.sh`, AND-gated at `THRESHOLD=1.0`), `isolation_invariant` is a real-Worker browser-CI rig, and `cwv_budget` is a jig-supervised advisory invocation (not in the gating composite; INP pinned as a cross-invocation delta, not an absolute).

## Core architecture decisions

*(No elicitation markers — populate via `/jig:adr-workflow new`. These are the proto-ADRs surfaced in the design conversation; promote and let `/jig:arch-review` attack them.)*

- **AD-1 Client-first runtime; edge as pluggable drivers.** Two seams (decision source, egress) baked in on day one; only local variants ship in MVP so "add edge" is a driver swap, not a rewrite.
- **AD-2 Capture-and-drain.** Main thread only captures and enqueues; the worker does the expensive **mapping** off-thread (egress *dispatch* is main-thread by the orchestrator — ADR-0004 refined OQ10 to "Option C": map in the worker, dispatch on the main thread). This is the single move that pays out in CWV, datalayer, and security at once.
- **AD-3 Event-sourced datalayer.** Append-only log + synchronous projection, not ACDL semantics; the compat `push()` surface sits on top.
- **AD-4 No SharedArrayBuffer / COOP-COEP in MVP.** Batched `postMessage` (cycles) instead; preserves third-party embed compatibility.
- **AD-5 Capability-mediated DOM/egress.** The only DOM-injection path routes through the CWV-safe helpers, making layout stability structural rather than a discipline; egress held at the seal.
- **AD-6 Reuse aem-cwv-helper.** Scheduling taxonomy becomes the drain scheduler; diagnostics become the inspector and the oracle.
- **AD-7 Two connector archetypes.** Wire-protocol (reimplement the beacon; GA4) and wrapped-SDK (contain a vendor lib in a chamber; alloy). MVP1 is wire-protocol only; completing both proves the connector abstraction generalizes.
- **AD-8 EDS three-phase integration.** Personalization eager (blocking, pre-paint), analytics lazy, third-party delayed — matching established EDS practice.
- **AD-9 Consent defaults to pending; egress is prerender-aware** (held until activation, so prerenders don't inflate counts).

## Open questions

*(No elicitation markers — feed these to refinement-todos and to shaper's risk-retirement. Leanings noted so reviewers have a position to attack.)*

- **OQ1 — Chamber isolation strength for MVP1.** Plain Web Worker vs QuickJS-compiled-to-WASM with a capability bridge. *Leaning: plain Worker for MVP1* — the GA4 connector is first-party code with no untrusted vendor JS; hard chamber isolation becomes load-bearing only at MVP2 (running alloy). Blocks MVP1.
- **OQ2 — Event descriptor shape + cycle semantics.** Exact fields crossing the airlock, ordering guarantees, batching cadence, backpressure. First architecture spec. Blocks MVP1.
- **OQ3 — Vendor-neutral schema now vs emergent.** Commit to a Snowplow/Segment-style self-describing schema up front, or let it emerge from the GA4 mapping and generalize after MVP2? *Leaning: minimal/emergent* to avoid designing a schema before connectors validate it.
- **OQ4 — Projection snapshot privacy boundary.** Exactly what projection state is allowed to cross the airlock to the worker per event. Blocks MVP1 (it's part of the boundary contract).
- **OQ5 — Identity / first-party cookie store home.** A no-go for MVP1, but where it eventually lives (orchestrator, main thread) and how connectors get scoped access.
- **OQ6 — Flicker oracle design.** Screenshot-diff between pre- and post-decoration paint vs a CLS-after-apply proxy. This is a servo oracle-component question; the proxy-gap here is why the PZN item stays jig-supervised.
- **OQ7 — Inspector scope in MVP1.** ~~How much of the "why did this beacon fire / hold at the seal / get gated" panel ships in MVP1 vs later.~~ **RESOLVED 2026-09-03 (spec 028, MVP5):** a read-layer over the 009-02 `onDiagnostic` stream (collector + per-beacon `beaconId` chains + a drop-in local panel); no new instrumentation, no remote backend. See [refinement-todo OQ7](refinement-todo.md).
- **OQ8 — Distribution.** ~~git subtree (matching aem-martech/aem-experimentation) vs npm for the EDS audience. (Repo slug settled: `airlockjs`.)~~ **RESOLVED 2026-09-04 ([ADR-0015](decisions/adr-0015-distribution-git-subtree.md); layout pinned by spec 031-01):** git-subtree of ready-to-serve built artifacts, published to a **dist-rooted `dist` branch** (root = `eds.js` + the sibling `*.worker.js` + a `VERSION` marker) a consumer `git subtree add`s at the served-path convention **`scripts/airlock/`** — buildless, same-origin by construction (004-01). npm deferred as the future bundler-audience channel. Proven end-to-end by `npm run rig:subtree` (subtree-add → boot → beacon on a clean EDS checkout; `WITH_CWV=1` adds the Lighthouse arm showing CWV preserved).

### Risk-retirement bet — RETIRED 2026-08-26 (reframed)

The original bet: can the event-log/projection + worker boundary **beat the
main-thread version on INP while emitting a Measurement-Protocol-conformant GA4
payload, on a real EDS page, at 100 Lighthouse?** Everything else is construction;
this was the load-bearing uncertainty.

**Retired by [spec 003](specs/003-risk-retirement-spike/spec.md), with an honest
reframing.** The blanket "beats a competent main-thread version on INP" is **false**
at GA4 loads — a competently `requestIdleCallback`-deferred main-thread baseline is
already INP-safe, and the worker only *ties* it (both INP p75 ~8ms). The measured,
defensible claims are: **INP-safe by construction** (the naive synchronous-mapping
stack is impossible to write in the airlock), **~19× better than the common naive
multi-tracker stack** (INP p75 152ms → 8ms, the case that actually occurs in
production), **wins heavy / indivisible mapping load** (the MVP2 alloy case, where
chunked-yield deferral can't hide the cost), and **per-tracker isolation**.
Lighthouse: CWV-clean at load (TBT 0, CLS 0); LCP impact ~0 with the EDS lazy-phase
+ bundling. The egress/delivery model (OQ10) is advanced by the same spike —
Option-C egress implemented (300/300 under normal settle); the unload last-beacon
main-thread fast path remains open.

## Clarifications

_Pass 1 — 2026-08-25, via `/jig:clarify`. Targets ambiguities not already captured as OQ1–OQ8; the MVP1-blocking OQs (OQ1/OQ2/OQ4) are deferred to `/jig:arch-review` + `/jig:adr-workflow`. Several answers below are load-bearing enough to warrant their own ADRs — flagged for the adr-workflow step._

### Q1: When a connector throws or its chamber crashes mid-cycle, does the airlock isolate that chamber (drop/restart it, other chambers and the page unaffected)?
_(category: Edge Cases & Failure Modes)_
_(provenance: [judgment])_

Isolate the chamber, page unaffected — drop/restart just the failing chamber; other chambers and the page keep running. This realizes the fault-isolation half of the thesis (a broken tag must not sink the page).

**Reconciled 2026-08-27 (spec 009).** Two of the three verbs are delivered; the third is honestly deferred. **Page unaffected** — free from the Worker boundary itself (a throw or crash in the worker cannot take down the page's main thread), so no code "keeps the page running"; it never stopped. **Drop the failing event** — delivered per-descriptor by 009-01's `mapBatch` catch (finer than "drop the chamber": one malformed event is dropped, the rest of the batch still maps), and made **observable** by 009-02 (each drop + any `worker.onerror` surfaced via the diagnostics seam) — the failure is now diagnosable, not silent. **Restart the failing chamber** is **NOT** delivered — there is no chamber-recreate/replay; a chamber that hard-crashes stays down until page reload. Chamber restart remains deferred (**OQ9**). The critical/unload fast path is not yet routed through `mapBatch` (**OQ16**).

### Q2: If consent is never granted (or an endpoint stays un-allowlisted), how long are events held at the seal retained?
_(category: Edge Cases & Failure Modes)_
_(provenance: [judgment])_

Retain until page unload in a bounded (capped) ring buffer; drop oldest past the cap; flush if consent arrives before unload.

### Q3: When a drained batch exceeds the ~64KB aggregate keepalive body cap, what happens?
_(category: Edge Cases & Failure Modes)_
_(provenance: [grounded: architecture.md → Tech stack (~64KB keepalive cap)])_

Split into multiple cycles — chunk the batch under the cap and emit sequentially, preserving all events and their ordering.

### Q4: MVP1's in-house eager-window decisioning — behind the AD-1 "decision source" seam, or as EDS-adapter code that bypasses the seam?
_(category: Scope & Boundaries)_
_(provenance: [grounded: architecture.md → AD-1 + Repository structure])_

Behind the local decision-source seam — ship the in-house logic AS the local driver so the seam is exercised from day one and "add edge" is a driver swap, not a rewrite. (Reconciles the `adapters/eds/` placement in Repository structure with AD-1's seam.)

### Coverage summary

| Category | Status |
|---|---|
| Scope & Boundaries | Resolved (Q4) |
| Acceptance Criteria Testability | Clear |
| Dependencies & Blockers | Clear (OQ1/OQ2/OQ4 named; deferred to arch-review + adr-workflow) |
| Non-functional Requirements | Partial (INP bar is comparative only — no absolute capture-path budget yet) |
| Edge Cases & Failure Modes | Partial (Q1–Q3 resolved; no-Worker/`postMessage`-unavailable fallback still Outstanding) |
| Terminology Consistency | Clear |
