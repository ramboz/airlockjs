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
**Resolved by:** [ADR-0005: Servo oracle design: AND-gate, isolation routing, and flicker (OQ6)](decisions/adr-0005-oracle-design.md).

### OQ7 — Inspector scope in MVP1
**Deferred:** How much of the "why did this beacon fire / hold at the seal / get gated" panel ships in MVP1 vs later.
**Resolution trigger:** When the diagnostics/inspector surface is specced.

### OQ8 — Distribution channel
**Deferred:** git subtree (matching aem-martech/aem-experimentation) vs npm for the EDS audience. (Repo/package slug settled: `airlockjs`.)
**Resolution trigger:** Before the first external release cut.

### OQ9 — MVP2 chamber isolation model + synchronous-host-access mechanism (coupled)
**Deferred:** The per-connector isolation model for MVP2 (worker-per-chamber vs QuickJS/WASM sandbox) and the synchronous cookie/storage access mechanism it requires are one coupled decision. R-004 grounded sync-access feasibility only in the plain-Worker single-realm model (host globals by reference); both MVP2 models break that precondition — separate-thread caches cannot share a synchronous cookie view without SharedArrayBuffer + Atomics (AD-4-forbidden); a WASM sandbox must marshal each read, losing the unmodified-stock-bundle property. Also unresolved: out-of-band-write staleness (a credentialed fetch `Set-Cookie`, a second tab, or a main-thread write leaving the worker's synchronous view stale). The MVP1 single-connector case (GA4 `client_id`) is served by a simple per-worker sync-cache; the multi-chamber case is not grounded. Promoted from [ADR-0001](decisions/adr-0001-chamber-isolation-strength.md) (its exposed forward-commitment).
**Resolution trigger:** Before the step-5 capability contract freezes. Settle via a **model-agnostic** coherency probe (e.g. a two-worker proxy exercising concurrent and out-of-band cookie writes) that does not presuppose the deferred B-vs-C model; then record via ADR.
**Probe (spec 011-01, in-band axis, 2026-08-28):** the two-worker coherency rig measured the in-band case — under the MVP1 seed+async-write-back shim generalized to two chambers, the sync-caches diverge on a concurrent RMW into a reproducible **split-identity fault** (both chambers mint an ECID; the jar loses one), and **broker-push invalidation self-heals** it. Window-width ≠ correctness (the coherent broker-push control carried the *wider* staleness window). Per the spec this is a **B-specific discriminator** (single-thread models event-loop-serialize the reads), a real input to the deferred model choice, **not** a premise-threatening no-go. The out-of-band axis (011-02), the go/no-go, and the resolving ADR (011-03) remain open.
**Probe (spec 011-02, out-of-band axis, 2026-08-28):** extended the rig with out-of-band writers. Both positive JS sources (a foreign main-thread script, a second same-origin tab) drive the identity cookie stale; a foreign write under the seed+async shim is a **split-identity fault** (the chamber mints a duplicate), and **broker-push invalidation self-heals** it — a **go** on the out-of-band axis, **not** a stop-and-re-shape. Detection: `cookieStore` `change` did **not** fire for `document.cookie` writes in this Chromium (the listener was validated via `cookieStore.set()`), so both sources detect via the **`document.cookie`-polling fallback** — i.e. option B must **poll**, not rely on `change`. Network `Set-Cookie` is confirmed a **negative boundary** (both variants; header unreadable, R-006 F4); the server-side/CNAME `kndctr_*` `Set-Cookie` mode is out of scope. The go/no-go synthesis + resolving ADR are **011-03**.
**Resolved — coherency/sync-access axis ([ADR-0008](decisions/adr-0008-oq9-coherency-sync-access.md), 2026-08-29):** **GO** — the async concurrent-first-mint fault (two chambers both mint → split identity, model-independent) is retired by **broker-side async request coalescing** (the single-threaded broker holds the second concurrent mint; async, no SAB), **conditional** for the wrapped-SDK archetype (Alloy) on chamber-side vendor-`fetch` interception into the orchestrator's *existing* main-thread dispatch (ADR-0004) + XDM mint-recognition; wire-protocol connectors (GA4) already satisfy it. OQ9's "one coupled decision" premise is **amended**: the coherency axis is separable from the B-vs-C model choice. **Carried forward** (narrower, contract-freeze-constrained): the B-vs-C isolation model, Option-C read-semantics, the design of the wrapped-SDK interception+coalescing mechanism (the freeze-held gate), and the 011-01 synchronous-mint reconciliation (owner approval — issue #125). Converged through 7 ADR-0008 frame-critique rounds; the demonstration slice **011-04 was abandoned** (the deterministic rig can't measure a race the broker serializes away).
**Resolved — B-vs-C isolation axis ([ADR-0009](decisions/adr-0009-mvp2-isolation-option-b.md), 2026-08-29):** **Option B** (a dedicated Worker per chamber) for the MVP2 proof scope; Option C / WASM deferred. Ratified against the built chamber ([spec 012-01](specs/012-mvp2-alloy-chamber/slice-01-host-and-boot.md)): stock alloy runs unmodified in a classic Worker, egress-confined; the 012-01 frame-critique's driver is **egress-chokepoint completeness for untrusted code** (B is adequate *because* AC5 makes the mediated `fetch` the sole network surface, not because a Worker is inherently safe). **The wrapped-SDK interception mechanism is built** (012-01 AC4 — vendor-`fetch` intercepted into the orchestrator's main-thread dispatch + minting), retiring the freeze-held gate for the **single-chamber** case. **012-02 built + demonstrated the concurrent-chamber coalescing** (2026-08-29): two concurrent alloy chambers both first-minting are coalesced by the single-threaded broker to **one** ECID in both jars (in-flight-hold + late-suppression via a completed-mint association; sync-register-before-await invariant; no SAB), while coalescing-off reproduces the split-identity fault — deterministic in a real two-Worker chromium rig (`rig:alloy-coalescing`). ADR-0008's mechanism is thus **demonstrated end-to-end** (single + concurrent chambers), turning its analytical GO into a shown one. This **lifts the freeze _hold_** — but **not** the freeze itself: ADR-0008's kill-criterion still requires a creds-gated **live-Alloy** mint-recognition re-probe before the step-5 contract freeze. **Still carried forward:** Option-C read-semantics (deferred, Option-C only); the **creds-gated live-Alloy mint-recognition re-probe** before the freeze. (The 011-01 synchronous-mint reconciliation, issue #125, was applied 2026-08-29.)
**Tracked debt — wrapped-SDK core integration + hardening (012-01 review, 2026-08-29):** (a) the round-trip egress (request/response, host-owned URL rewrite, cookie write-back) currently lives in the rig harness as a *parallel* mirror of `core/airlock.js` — wire it into `core/airlock.js` proper (**named owner needed**, so the harness isn't the sole home of an egress model core doesn't share — arch-review flag 1); (b) decide whether the wrapped-SDK **round-trip egress surface** is lifted into `contracts/*.d.ts` or stays chamber-internal gated by the seal (arch flag 2 — `handle → EgressRequest[]` models only fire-and-forget); (c) **converge the two connector-hosting paths** (generic `core/connector-host.js` vs GA4-hardcoded `core/chamber.worker.js`) — retrofit GA4 onto the host so they don't calcify (arch flag 3); (d) wrapped-SDK **production-hardening** (012-01 craft nits): confine the dead-man real-fetch guard, tighten the blanket `eslint-disable`, add a fetch-shim timeout so a never-answered main response can't hang `sendEvent`; (e) **the coalescing broker's in-flight hold reject path** — the rig broker now **settles held awaiters on first-mint dispatch failure** (012-02 craft fix: `catch` rejects held chambers with the error, `completed` left unpopulated → self-heal; tested with a bounded timeout so a regression hangs the test, not the suite); the **core port must preserve** this reject/failure path, and still consider a `completed`-association **invalidation-on-reset** path (bounded today by datastream cardinality, no leak).

### ~~OQ10 — Egress dispatch and delivery model (incl. last-beacon)~~ — RESOLVED 2026-08-26
~~**Deferred:** [ADR-0002](decisions/adr-0002-event-descriptor-cycle-semantics.md) deliberately stops at the worker boundary; the whole egress model is one coupled decision adversarial review showed cannot be settled by argument. It spans **dispatch location** (worker-side eager and off the INP path but needing a two-sender dedup/ack and a consent snapshot, vs orchestrator-side main-thread and capability-mediated but requiring idle-gating), **delivery under interaction-storm load** (idle-gated main-thread dispatch stalls and builds an undeliverable backlog; eager worker dispatch avoids it), the **aggregate 64 KiB keepalive budget** (Chrome 255/9 caps) that limits the end-of-session flush, and the **unload / last-beacon path**. The canonical last beacon — an outbound click or closing pageview generated *within* the unload window — cannot complete an async worker round-trip to be mapped before the page is torn down, so it is absent from the un-sent requests the unload flush dispatches. Rescuing it needs a main-thread **synchronous mapping fast path** for a declared set of unload-critical event types, which cuts against "mapping stays worker-side" and must honor ADR-0003's out-of-chamber minimization. Shared by egress Option B too (it also maps in the worker), so the Option-B fallback does not retire it.~~
**Resolution trigger:** With the risk-retirement spike, which must measure the INP-versus-delivery tension directly (an INP oracle alone is insufficient; a delivery-rate oracle is needed). The delivery-rate oracle must instrument the **drain stage** too, not just worker egress: the idle-gated main→worker drain (frozen in ADR-0002) itself caps delivery under no-idle load — it either drops-oldest before events reach the worker, or fires on its max-latency cap and runs structured-clone serialization during the storm — so worker-side egress cannot rescue events the drain never delivered, and a number measuring only egress would attribute drain-induced loss to the wrong stage. Record in a dedicated egress ADR. Load-bearing for UC-2 analytics correctness.
**Measured (spike 003, 2026-08-26):** the delivery risk is real — a worker-only keepalive egress delivered 155/300 beacons when the page closed before the worker drained (9s of off-thread work), vs 300/300 with a normal settle; main-thread naive/deferred paths delivered 300/300. So the egress model must backstop delivery on the main thread at `visibilitychange`→`hidden`.
**Closed (2026-08-26):** the main-thread synchronous mapping fast path is implemented (`core/egress.js` `createCriticalDispatcher`; `pushCritical()` + the `visibilitychange`/`pagehide` ring-tail flush in `core/airlock.js`) and re-measured (`rig/teardown.mjs`): the enqueued last beacon is lost in the teardown window (0/5) while `pushCritical` delivers it (5/5) and the ring-tail flush delivers the un-drained tail (50/50), with steady-state INP p75 unchanged at 8ms. Unit-tested (`test/egress-fastpath.test.js`, contract-conformant). The decision is recorded in **ADR-0004**, which extends ADR-0002's deferred egress section. One residual facet (in-worker backlog under *extreme* early close) is parked in ADR-0004 Open questions, not part of OQ10's last-beacon scope.
**Resolved by:** [ADR-0004: Egress dispatch and delivery model](decisions/adr-0004-egress-dispatch-delivery.md).

### OQ11 — Event-payload read-boundary governance
**Deferred:** [ADR-0003](decisions/adr-0003-projection-snapshot-privacy.md) governs the projection-snapshot read channel (default-deny allowlist). The event-payload channel (the connector's primary input) is open and site-defined — UC-2 custom events, `push()` open object, OQ3 emergent schema — so a field-allowlist collapses to a wildcard (= default-allow). It needs a different model: a host-owned **sensitive-field denylist** that strips known-dangerous fields (raw form inputs, declared PII paths) at the boundary outside the connector's chamber, optionally tightened to an allowlist if OQ3 pins a schema.
**Resolution trigger:** With the connector interface contract at drive-order step 5; resolve jointly with **OQ3** (schema pin vs emergent). Record via ADR.

### OQ12 — `push()`-surface contract completion — items 1–3 + `workFactor` RESOLVED 2026-08-27 (004-04); item 4 open
**Deferred (original):** Slice 004-02's reviews surfaced four small contract/robustness items around the now-reconciled `push()` surface, none blocking that slice: (1) **`pushCritical`'s caller-facing shape is pinned in no contract doc** — it shares `push()`'s `{ event, ...params }` shape by design (implemented + tested), and the **`push()`-XOR-`pushCritical` caller rule** (ADR-0004: violation silently double-counts) is likewise unpinned; both belong in `contracts/push-api.md`. (2) **Malformed-push behavior** (missing/empty/non-string `event` → drop + `console.warn`, never throw — mirrors `push-event.schema.json`) is a runtime-side clarification the contract doc is silent on. (3) **`getState()` returns the live projection by reference** (contract-consistent per its 🟡 not-a-deep-clone row) — the write-through hazard deserves one contract sentence. (4) **Dispose / idempotent-boot guard**: `createAirlock` registers global unload listeners with no teardown and `bootEdsAnalytics` overwrites `window.airlock`; once-per-page on EDS so accepted, but a library distribution needs a guard. Also: prune the spike's `workFactor` knob from the adapter options, and `pushCritical` bypasses the event log/projection (sent-but-unrecorded; couples to ADR-0004's parked idempotency guard, which wants a descriptor the fast path never creates).
**Resolved (slice 004-04, 2026-08-27):** items **1–3** pinned into [contracts/push-api.md](../contracts/push-api.md) — a `pushCritical()` subsection (its `{event,...params}` shape, synchronous, fire-and-forget keepalive, bypasses the log+projection, the aggregate-keepalive-budget drop behavior) + Supported-table row; the **push()-XOR-`pushCritical`** caller-rule callout; the `getState()`-returns-live-projection-by-reference note; and the malformed-push behavior is covered. The spike's **`workFactor`** knob is **pruned** from `adapters/eds/index.js` (arch review 004-04; the rigs that need it call `createAirlock` directly).
**Still open — item 4 only:** the **dispose / idempotent-boot guard** (a re-boot leaks a Worker + unload listeners and overwrites `window.airlock`; the `pushCritical` log/projection bypass couples to ADR-0004's parked idempotency guard). **Resolution trigger:** before OQ8 (distribution) ships the runtime as a library; coincides with OQ13 item 4's grant-wrapper work.

### OQ13 — Identity-cookie follow-ups (post-004-03 review residue)
**Deferred:** Slice 004-03 shipped host-side GA4 identity sourcing (`_ga` parse; GA1-format generate+persist; per-page session fallback) and its reviews parked five follow-ups, none blocking that slice: (1) **Consent-gating the identity-cookie write** — the seal gates egress only (AD-9); the first-party `_ga` write is consent-ungated in MVP1 (fine on the consent-free testbed; a privacy-positioned deployment wants the write behind consent state too). (2) **Session-cookie persistence** — on a gtag-free site nothing writes `_ga_<stream>`, so an MPA mints a fresh session per page; deciding whether/what airlock persists for sessions is deliberately NOT in 004-03. (3) **Multi-stream `_ga_*` selection policy** — current policy is first-in-jar-order wins (documented in `connectors/ga4/cookies.js`); also open: whether the capability shape grows a `list()` for chamber-side discovery or discovery stays a host duty feeding ctx. (4) **Name-scoped cookie grant wrapper** — `adapters/eds/cookies.js` is the RAW whole-jar host backing (JSDoc caveat added); before any connector grant it needs a default-deny name-scope wrapper per `CapabilityRequest.cookies`, with the cookie **name validated** on `set` (attribute-injection surface), and its likely eventual home is `core/` per capability.d.ts's "backed by the orchestrator". Two accepted behaviors ride with this item: a `SecurityError` in cookie-blocked/sandboxed contexts currently degrades to a **visible boot failure** (`__airlockBootFailed`) rather than a null-identity boot — revisit toward graceful null-identity when the wrapper lands; and whether the init-time identity ctx eventually folds into the **ADR-0003 declaration mechanism** (a manifest declaring `clientId`/`sessionId` needs) or stays host-composed. (5) **Pair-scan loop duplication** (adapter accessor vs connector parser) — rule-of-three: extract on a third copy.
**Resolution trigger:** (1) with the consent/inspector surface work (OQ7-adjacent) or the first privacy-positioned deployment. (2) before an MPA field deployment where per-page sessions would visibly inflate session counts (UC-2 rollout). (3)+(4) with the first connector-requested cookie grant (OQ9/MVP2 capability work). (5) mechanical, on the third copy.

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

### Decision: Code style and linting
**Deferred:** No signal from the initial pitch. (Still open.)
**Resolution trigger:** First spec that produces non-trivial code, or first time inconsistency causes friction.

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
