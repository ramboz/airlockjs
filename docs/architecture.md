> Status: Living document — reflects the architecture as built through v0.8.0 (MVP8).

# Architecture — Airlock

> This document reflects the architecture **as built through MVP8 (v0.8.0)**: the stable core is frozen ([ADR-0017](decisions/adr-0017-airlock-1-0-api-contract.md)) and the design decisions summarized under § Core architecture decisions are now recorded as ADRs in [docs/decisions/](decisions/) (0001–0030). The five sections through **Contract surfaces** are the load-bearing module boundary; **Core architecture decisions** and **Open questions** track the ADR record and what remains open (1.0 = adoptable with confirmed parity, [ADR-0018](decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md)).
>
> Vocabulary: **the airlock** = the mediated boundary; a **chamber** = a connector's sandbox; a **cycle** / **lock-through** = a batch crossing to the worker; **the seal** = consent/allowlist gating. Repo/package slug: `airlockjs`; connector namespace `airlock/*`.

## Repository structure

A framework-agnostic runtime core, with EDS as the first adapter and connectors as a pluggable directory:

- `core/` — the orchestrator, event log, state projection, capability broker, and worker-runtime host. No framework or vendor coupling.
- `core/*.worker.js` + `core/worker-dom/` — the **chambers** (the worker-side connector runtime) and the worker-side DOM-compat mirror ([ADR-0014](decisions/adr-0014-worker-dom-compat-minimal-mirror.md)). One chamber per connector; the roster is the table below.
- `adapters/eds/` — EDS integration: the three-phase hooks, block-decoration instrumentation, eager-window decisioning, and the native-tag suppressor (see below).
- `connectors/` — the pluggable connector directory, one connector per vendor tag. See **The connectors** below.
- `drivers/consent/` — host-neutral **consent-input drivers**: the *source* side of the seal (produce a consent vector to feed in), distinct from `core/consent.js`'s egress enforcement. See below.
- `diagnostics/` — the `PerformanceObserver` wrappers and the inspector surface (reuses/vendors `aem-cwv-helper` primitives).
- `test/` — vitest suites, including the oracle components servo will score.
- `.jig/` — durable workflow state.

### The connectors

Each connector runs in its own chamber, consumes typed events, and emits a vendor beacon. Two archetypes: **wire-protocol** (reimplement the beacon) and **wrapped-SDK** (contain a stock vendor library in a chamber). Deep detail lives in each connector's spec and ADR.

| Connector | Wire | Chamber | Spec · ADR |
|---|---|---|---|
| `ga4` | Measurement Protocol (`/mp/collect`) | `chamber.worker.js` | 004 · ADR-0017 |
| `ga4-gtag` | gtag `/g/collect` | `ga4-gtag-chamber.worker.js` | 039 · ADR-0019 |
| `pixel` (meta / linkedin / bing) | GET `/tr` | `pixel-chamber.worker.js` | 026 · ADR-0022 |
| `google-ads` | `ccm/collect` GET | `google-ads-chamber.worker.js` | 044 · ADR-0023 |
| `floodlight` | `ccm/collect` + `activity` matrix | `floodlight-chamber.worker.js` | 046 · ADR-0024/25 |
| `helix-rum` | RUM/CWV (replaces inline `sampleRUM`) | `helix-rum-chamber.worker.js` | 022 / 030 |
| `alloy` | wrapped-SDK (Adobe Web SDK, adopter-supplied) | `alloy-chamber.worker.js` | 012 · ADR-0009/16 |

Registry namespace: `airlock/ga4`, `airlock/ga4-gtag`, `airlock/pixel/{meta,linkedin,bing}`, `airlock/google-ads`, `airlock/floodlight`, `airlock/helix-rum`, `airlock/alloy`.

Three cross-connector facts that are architectural, not per-connector:

- **Egress-confined chambers.** A chamber that emits is egress-confined (`withholdFetch`): it maps the beacon off-thread and hands a ready request back, and only the main-thread orchestrator dispatches it. A compromised chamber cannot reach the network directly.
- **Consent-gated ad connectors.** `google-ads` and `floodlight` are `ad_storage`-purposed and opt into `holdOnDenied` ([ADR-0023](decisions/adr-0023-ad-pzn-egress-hold-until-consent.md)): a denied purpose holds the beacon instead of sending, and it is re-mapped under the current consent when a grant flushes it.
- **Shared Consent-Mode encoder.** `connectors/consent-mode.js` holds the gtag-family Consent Mode v2 (`gcs`/`gcd`/`npa`) encoders, reused by `ga4-gtag`, `google-ads`, and `floodlight`. It lives connector-side, not in `core/`, because it emits Google-specific wire strings and `core/` carries no vendor coupling (the [conventions](conventions.md) *code-home rule*).

### The native-tag suppressor and consent-input drivers

Two host-coupled pieces sit outside `core/` and `connectors/` by the same code-home rule:

- **`adapters/eds/tag-suppressor.js`** ([spec 049](specs/049-native-tag-suppressor/spec.md) / [ADR-0030](decisions/adr-0030-native-tag-suppressor.md)) — a vendor-neutral, adopter-facing primitive an EDS site installs *before* its tag-manager container loads, to page-side-suppress a migrated vendor's native tags. It patches the DOM script-insertion surface to neutralize a matching `<script>` before it connects (so a blocked runtime never downloads, which is the TBT win), matches by URL/path/query (so a partial `?id=` migration is possible), and carves out airlock's own egress. This is the developer-side MVP9 after-arm ([ADR-0029](decisions/adr-0029-mvp9-developer-side-after-arm.md)), needing no tag-manager-profile change. It ships as a served `dist` sibling.
- **`drivers/consent/onetrust.js`** ([spec 047](specs/047-onetrust-consent-input-driver/spec.md) / [ADR-0026](decisions/adr-0026-onetrust-consent-input-source.md)) — a main-thread, zero-import leaf that reads OneTrust's *resolved-consent* surface (`OnetrustActiveGroups`, never the configured-default `GetDomainData().Status`) and maps the site's OneTrust groups to the `core/consent.js` purpose vector via a host-provided map. It also subscribes to OneTrust's change signal, so a mid-session accept flushes held ad beacons on the grant edge. Since [ADR-0027](decisions/adr-0027-onetrust-composite-governance-field.md), `onetrust` is a top-level `boot(config)` governance field wired once onto the composite `setConsent` fan-out, so one accept flushes held Google Ads *and* Floodlight beacons across every booted connector.

## Tech stack

ES modules, no runtime framework dependency. Web Worker for the connector runtime, communicating by **batched `postMessage`** (structured clone) — each drain is a cycle — explicitly **not** SharedArrayBuffer, avoiding the COOP/COEP cross-origin isolation that breaks embeds. Egress via `fetch(url, { keepalive: true })` **dispatched on the main thread** by the orchestrator — the worker maps off-thread and returns ready requests, plus a main-thread synchronous fast path for the unload window (ADR-0004 "Option C"; mind the ~64KB aggregate keepalive body cap when batching). `PerformanceObserver` for INP/CLS/LCP attribution. vitest for tests. GA4 Measurement Protocol as the external, machine-validatable contract.

## Module boundaries

This is the load-bearing section. The system is one privileged main-thread module and one unprivileged worker, connected by the airlock:

- **Capture layer** (main thread, pre-LCP): a few delegated passive listeners at the document root that write minimal event descriptors into a ring buffer. No processing during the LCP window.
- **Orchestrator** (main thread): the *only* martech code with DOM access. Owns the append-only event log, the synchronous state projection, the `WeakMap` element→data associations, consent state, and the capability broker. Drains the ring buffer on idle and cycles batches to the worker.
- **Worker runtime** (off-thread): hosts connectors, each in its own chamber. Connectors consume typed events, build vendor payloads, and emit egress. **No DOM, no ambient globals.**
- **The airlock (capability bridge)**: connectors request mediated capabilities rather than reaching for browser APIs. DOM injection is fulfilled by the orchestrator through `reserveSpace` / `insertAfterInteraction`, so injected content is CWV-safe by construction. Egress is fulfilled through the egress seam and held at the seal until consent and allowlist pass. The seal's verdict (`core/consent.js`, enforced in `core/airlock.js`) is **pending → hold** (buffer, flush on grant), **granted → send**, **strict → drop**. A connector instance may additionally opt into **`holdOnDenied`** ([ADR-0023](decisions/adr-0023-ad-pzn-egress-hold-until-consent.md), spec 045), so a *denied* purpose holds instead of sending, grounded per vendor (Google Ads holds; GA4 sends cookieless). A held beacon is re-mapped under the current consent when flushed, never a stale under-denial re-send; a fan-out connector re-maps each held beacon by a per-beacon key ([ADR-0024](decisions/adr-0024-fanout-remap-per-beacon-key.md)). Enforcement stays at the core seal; alloy (wrapped-SDK) is a separate path (`core/wrapped-sdk-host.js`).
- **Two seams (drivers swappable from day one, only local variants shipped in MVP)**: a **decision source** seam (local | edge) and an **egress** seam (direct keepalive | service-worker chokepoint | edge-proxied).

## Data model

The datalayer is deliberately split into the two objects that ACDL and GTM conflate:

- **Event descriptor** — the minimal record a `push` writes on the interaction path (type + payload-ref + timestamp). Cheap to create; this is what keeps INP low. *(Exact shape is OQ2.)*
- **Event log** — append-only, ordered, the source of truth. Cycles to the worker in batches; ordering preserved across the lock-through.
- **State projection** — derived from the log, held in the orchestrator, read synchronously. `Map` for keyed state, `WeakMap` for element associations. A `push` folds its event into the projection synchronously (so synchronous readers see current state) *and* enqueues for the worker (so processing is off-thread) — the split that resolves `patchDatalayer`'s async-read caveat.
  - *WeakMap ownership (clarified, spec 006 arch review):* the orchestrator's `WeakMap` holds **projection / cross-airlock** element→data associations. An **adapter** may keep its own **transient, module-local** element→lookup `WeakMap` for adapter-specific metadata that deliberately does NOT enter the vendor-neutral `core/` projection or cross the airlock — e.g. `adapters/eds/blocks.js`'s element→`{ block_name }` map (UC-3): EDS block names are an EDS concern, so they stay adapter-local rather than leaking into `core/`.
- **Projection snapshot slice** — the bounded, privacy-filtered subset of projection state that crosses the airlock to the worker alongside each event for enrichment. *(What is allowed to cross is OQ4.)*

## Contract surfaces

Feeds `/jig:contracts`. Five surfaces, in priority order:

1. **GA4 Measurement Protocol** — external, versioned, validatable at `/debug/mp/collect`. The MVP1 conformance oracle.
2. **The `push()`-shaped datalayer API** — the drop-in compatibility surface (loosely GTM/ACDL-shaped) that maps onto the event-log/projection split underneath.
3. **The connector interface** — what a connector implements: consume typed events, request capabilities, emit to a declared endpoint. A mapper MAY **throw** on contract-invalid input (e.g. GA4 rejects a `purchase` missing `transaction_id`/`currency`/`value`/`items[]`); the airlock isolates that throw to the failing event, drops just it into the cycle's `dropped[]`, and surfaces the drop through an injectable diagnostics seam (spec 009 / 012). The synchronous unload path is a separate, worker-independent path reusing the connector's own main-thread mapper (**OQ16**). One documented exception to `push()` governance: the pixel connector's advanced-matching identity rides a dedicated worker channel that hashes PII in-chamber (SHA-256) and posts back only the hash, adding an additive `setIdentity(raw)` verb to the frozen handle ([ADR-0022](decisions/adr-0022-pixel-advanced-matching-hashing.md)).
4. **The capability API** — what the orchestrator grants across the airlock (mediated DOM injection, mediated egress) and how scopes are declared.
5. **The seam driver interfaces** — decision-source and egress driver contracts.

> **The five surfaces above (plus the adopter boot layer) are FROZEN — the stable core** —
> [ADR-0017](decisions/adr-0017-airlock-1-0-api-contract.md) (spec 037-01) is the recorded, enforced stable-core
> contract: contract-stability guards (`test/contract-stability.test.js`) pin the frozen surfaces, so a future
> regression fails a test rather than surfacing as a broken integration. Two aspects stay explicit carve-outs — the
> event-payload SCHEMA (OQ3) and multi-chamber sync-coherence (OQ9's remaining axis) — see the ADR. **What "1.0"
> *means* is not this pin** — since the 2026-09-05 reframe ([ADR-0018](decisions/adr-0018-reframe-onto-adoptable-one-point-oh.md))
> 1.0 is *adoptable with confirmed parity*, cut at MVP9; this frozen surface is the stable core airlock ships *on*.
>
> **Plus one experimental surface, deliberately NOT among the frozen five (spec 032):** the **instrumentation config**
> schema (`contracts/instrumentation-config.schema.json`) — the project JSON config `boot(config)` consumes. It is
> validated (ajv) + documented in [contracts/README](../contracts/README.md)'s "Not-yet-frozen contracts" section, but is
> **iterable/not-frozen** — ADR-0017 deliberately keeps it experimental (its break-attribution
> semantics differ from the five above); a later config-surface freeze (a follow-on ADR extending ADR-0017) pins what
> survives. Listed here only so a `/jig:contracts` scan sees the authoring boundary.

> **Measurement surface (not a caller-facing API).** The before/after CWV scoreboard — the "punchline" success criterion in product-vision § Use cases — doubles as the servo oracle. Its measurement contract (INP threshold, Lighthouse score, the `ga4_mp_conformance` / `cwv_budget` / `isolation_invariant` oracle components) is not a public interface but must be pinned before the spike loop runs; tracked as OQ6. **Resolved by spec 007 / [ADR-0005](decisions/adr-0005-oracle-design.md):** the three are routed by oracle strength — `ga4_mp_conformance` is the hermetic servo-unattended gate (`oracle.sh`, AND-gated at `THRESHOLD=1.0`), `isolation_invariant` is a real-Worker browser-CI rig, and `cwv_budget` is a jig-supervised advisory invocation (not in the gating composite; INP pinned as a cross-invocation delta, not an absolute).

## Core architecture decisions

*(The load-bearing decisions surfaced in the original design conversation, since promoted to ADRs in [docs/decisions/](decisions/) and hardened through arch-review — the summary below stays as the at-a-glance map; the ADRs are the authoritative records.)*

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
- **OQ8 — Distribution.** ~~git subtree (matching aem-martech/aem-experimentation) vs npm for the EDS audience. (Repo slug settled: `airlockjs`.)~~ **RESOLVED 2026-09-04 ([ADR-0015](decisions/adr-0015-distribution-git-subtree.md); layout pinned by spec 031-01):** git-subtree of ready-to-serve built artifacts, published to a **dist-rooted `dist` branch** (root = `eds.js` + the sibling `*.worker.js` + a `VERSION` marker) a consumer `git subtree add`s at the served-path convention **`scripts/airlock/`** — buildless, same-origin by construction (004-01). Each release is pinned as an immutable **`dist-vX.Y.Z` tag** (the `VERSION` marker reconciled to the tag; the semver substitute git subtree lacks) a consumer `git subtree pull --squash`es to update (spec 031-02). npm deferred as the future bundler-audience channel. Proven end-to-end by `npm run rig:subtree` (subtree-add → boot → beacon on a clean EDS checkout, plus the `dist-vA`→`dist-vB` update path; `WITH_CWV=1` adds the Lighthouse arm showing CWV preserved).

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
