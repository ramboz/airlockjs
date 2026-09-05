---
status: DONE
dependencies: [033-02]
last_verified: 2026-09-04
arch_review: true  # extends the wrapped-SDK host message contract + the decisions→reserveSpace delivery path.
frame_review: true  # rests on 033-02's config-boot design; the {type:"decisions"} path is genuinely un-built today.
---

<!-- jig self-defining vocabulary (soft, forward-only): expand each acronym on
     first use and link the term to docs/memory/glossary.md (or jig's lexicon). -->
<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about runnable
     surfaces by probe first (run it / read source) or a citation, else mark them
     as assumptions — never assert an unverified claim as fact. -->

## Slice 033-03 — build: config-boot alloy (the personalization vertical) — decisions-as-data → `reserveSpace`

> **The follow-on vertical to [033-02](slice-02-alloy-config-build.md)** (the SPIDR-Path split). 033-02 delivers
> config-booted alloy for **analytics** (`sendEvent` → intercepted interact). This slice adds **Target
> personalization**: the chamber's `{type:"decisions"}` message — **un-consumed by `createWrappedSdkHost` today**
> (`core/wrapped-sdk-host.js` `handleMessage` handles phase / intercepted-fetch / cookie-writeback / result / fatal
> only; a rig harness is the only current listener) — delivered through the composite handle to `reserveSpace`
> (spec 012-03 built the mechanism headless; 018 is the sanitizer boundary). **Gated on 033-02 DONE.**

**Goal:** config-booted alloy (`{type:"alloy"}`) renders **Target personalization as data**: the host consumes the
chamber's `{type:"decisions"}` message and delivers propositions via `caps.decisions.deliver` → the composite handle
→ `reserveSpace` (headless, `renderDecisions:false` — decisions-as-data, R-004/012-03), **subject to consent** (AC6 —
decisions ride the shared interact, held all-or-nothing by the strict gate). Closes the personalization half of MVP6's
alloy config-surface support.

**DoR:**
- ✅ **033-02 DONE** (config-bootable alloy: `bootAlloy` + the composite handle + the served worker + the strict
  consent + config-integrity + endpoint-ceiling gates). Landed 2026-09-04.
- ✅ The mechanism exists headless (012-03) — this slice **wires it through the config-boot adapter**, it does not
  invent it. Grounded (read 2026-09-04):
  - **Production:** the chamber's `decisions.deliver(decisions)` posts `{type:"decisions", decisions}` to the host
    (`connectors/alloy/alloy-chamber.worker.js:157-158`), called by the connector's `granted.decisions` when alloy
    returns Target propositions (`renderDecisions:false`); analytics-only cycles never call it (additive — 033-02 safe).
  - **The host gap:** `createWrappedSdkHost.handleMessage` (`core/wrapped-sdk-host.js:383-425`) does NOT consume
    `{type:"decisions"}`. `bootAlloy`'s chamber deliberately uses `addEventListener` (not single-slot `onmessage`)
    with the comment *"so a future decisions listener (033-03) can coexist independently"* — the seam is pre-built.
  - **Delivery machinery (012-03, built + rig-proven `rig/alloy-decisions*`):** `extractDecisions(result,{scope})` +
    `VIEW_SCOPE="__view__"` + `htmlOfDecision` (`connectors/alloy/decisions.js`); `reserveSpace().fill()` with the 018
    active-markup sanitizer (`adapters/eds/dom.js`, `createDomCapability(document)`); the `proposition_display`
    exposure mapper (`adapters/eds/decisions-exposure.js`, `PROPOSITION_EXPOSURE_EVENT`). The connector already takes
    a `decisionScope` config option (`connectors/alloy/connector.js:69`).

**Frame-critique (2026-09-04) reshaped the design — four findings adopted below.** The naive "reserve at
`boot(config)` time" was structurally unsound: `eds.js`/`boot(config)`/`bootAlloy` are dynamically imported + run in
`loadLazy` **after** `body.appear` (paint) — a reserve there is the post-paint FLICKER case the 012-03 rig gates as a
failure (`rig/alloy-decisions.mjs:148-151`; `adapters/eds/dom.js:12-19`; testbed `probes/eds-testbed/scripts/scripts.js`
`loadEager`→`body:appear` vs `loadLazy`→airlock import). So personalization needs a **distinct synchronous eager
entrypoint** called from `loadEager` *before* paint, decoupled from the lazy fill.

**Acceptance Criteria:**

1. **Host consumes `{type:"decisions"}` (additive).** `createWrappedSdkHost.handleMessage` gains a `{type:"decisions"}`
   branch that calls `caps.decisions.deliver(decisions)` **iff the adapter wired `caps.decisions`** — a no-op
   otherwise (GA4 / analytics-only alloy byte-unchanged; 033-02 no regression). Test: a host with a spy
   `caps.decisions.deliver` receives the chamber's posted decisions; a host without one ignores them (as today).
2. **A synchronous eager reserve entrypoint — a SEPARATE LIGHTWEIGHT module (the no-flicker fix, AD-8 / UC-1).** A NEW
   exported entrypoint (e.g. `reservePersonalization(config)`) that, called from `loadEager` **before `body.appear`**,
   **synchronously initiates** the reserve of the configured `__view__` placement box
   (`createDomCapability(document).reserveSpace(spec)` — prehidden, pre-paint; the box is sized synchronously before
   the handle Promise resolves, `dom.js:199-228`). It **must NOT be exported from `eds.js`** — an eager
   `import(eds.js)` before paint pulls the full runtime (`createAirlock` + every connector + web-vitals,
   `adapters/eds/index.js:34-54`) onto the critical path, regressing LCP against the very AD-8 lazy discipline this AC
   invokes; the reserve path (only `createDomCapability` + placement parsing) is its **own separately-importable dist
   module**. The reserve **handle** (its `fill`/`reveal` closure — `reserveSpace` is **NOT** idempotent-by-selector
   (`dom.js:174`, each call re-reserves with a fresh id), so the lazy fill cannot re-derive it) is shared with the lazy
   fill by an **explicit hand-off**: `reservePersonalization` returns the reserve handle **promise(s)** (`reserveSpace`
   returns `Promise<handle>`, `dom.js:230`; the box is sized synchronously, so it resolves next-microtask — well before
   any decision) and the loader passes them to `boot(config, { reservedPlacements })`; `bootAlloy` awaits before
   `.fill()`. A **new `build.mjs` dist entry** emits this lightweight module to the served tree (alongside `eds.js`; +
   `publish-dist.mjs` `DIST_ARTIFACTS`). **NOT** via `window.airlock` (disposed+replaced by `installOnWindow` at
   lazy boot, `index.js:306-311`) and **NOT** a module store (esbuild inlines a *separate* copy into the eager module
   vs `eds.js` — no shared instance across the two dist entries). Proof: a rig asserts the reserve mark precedes
   `body:appear` (mirror `rig/alloy-decisions.mjs`'s `reserve < appear` gate — the post-appear reserve is the caught
   negative). The testbed loader (`probes/eds-testbed/scripts/scripts.js`) wiring — `reservePersonalization` in
   `loadEager` (pre-appear) + the hand-off to `boot(config)` in `loadLazy` — is **in scope**.
3. **`bootAlloy` (lazy) fills + reports.** `bootAlloy` (given `reservedPlacements`) provides `caps.decisions.deliver(decisions)`
   — where `decisions` is **already `__view__`-filtered by the connector** (`decisionScope=VIEW_SCOPE`,
   `connector.js:69,178`; the adapter does NOT itself call `extractDecisions`) — that, per decision matched to its
   reserved placement: renders it (`htmlOfDecision`) → **fills the pre-reserved box** via the **handed-off**
   (awaited) `reserveSpace` handle's `.fill()` (the 018 sanitizer boundary — never a raw write) → reports a
   `proposition_display` exposure (`decisions-exposure.js`). The **worker touches NO DOM** (012-03 AC2: propositions
   cross as DATA). A placement whose selector matched nothing (reserve rejected), a decision with no matching
   placement, or a decision arriving with **no handed-off handle** (the loader shipped a placement config but
   skipped/mis-wired the eager `reservePersonalization`) is **dropped + diagnosed** (`caps` diagnostics), never thrown.
   **INVARIANT:** `bootAlloy` MUST NOT lazily reserve as a fallback — a post-paint reserve reintroduces the exact
   flicker AC2 fixes; the only reserve is the eager one.
4. **Exposure routes to the analytics sink, NOT alloy (no loop).** The `proposition_display` exposure is pushed
   through the **composite** (`window.airlock.push`, late-bound in `deliver`, since the composite installs at boot),
   so it fans to an analytics connector that accepts it (GA4, `["*"]`); alloy's own handle is `["page_view"]`-gated and
   **ignores** it (no second interact / no proposition loop). `deliver` **guards** `window.airlock` being absent or
   push-less (a standalone `bootAlloy` never calls `installOnWindow`) → the same **drop + diagnose** path, never a
   throw. A boot **without** an analytics `["*"]` sink (alloy-only) likewise has nowhere for the exposure to land →
   **dropped + diagnosed** (documented limitation: personalization *exposure telemetry* requires an analytics
   connector in the same `boot(config)`; the *display* still works).
5. **Placement config surface — a single `__view__` placement (this slice).** The alloy config gains a `__view__`
   placement (`placements: [{ scope: "__view__", selector, minHeight, prehide? }]`) in the schema (+ golden fixture).
   The **connector** delivers `__view__`-filtered decisions by default (`decisionScope=VIEW_SCOPE`,
   `connector.js:69,178` — the scope alloy fetches by default); `bootAlloy` fills that one placement from them. **Multi-scope is DEFERRED** (a named follow-on): a non-`__view__`
   placement scope is **rejected at validation** with a clear message, because alloy's interact does not request
   non-`__view__` scopes today (`connector.js:172-175` sends `{renderDecisions:false, xdm}` with no `decisionScopes`),
   so declaring one would silently never populate — wiring `decisionScopes` into the interact + the multi-placement
   host-side map is the follow-on. Edge cases: a `__view__` decision whose selector matched nothing at reserve time,
   or a cycle returning no `__view__` decision, is **dropped + diagnosed** (the reserved box reveals on its
   prehide-timeout backstop), never thrown.
6. **Consent — the REAL all-or-nothing behavior (grounded, not the earlier misframing).** Decisions ride the **shared
   interact**, gated by the strict `egressVerdict` over `["analytics_storage","personalization"]` (020-02), which
   **HOLDS the whole interact if EITHER purpose is un-granted** (`core/consent.js`, `core/wrapped-sdk-host.js`). So a
   `personalization`-denied config yields **no interact at all** — hence no decisions AND no analytics. Test asserts
   that real behavior (whole interact held; no fill, no `proposition_display`). **Documented limitation:** the common
   "analytics-yes / personalization-no" posture gets neither; a finer per-purpose split (an analytics-only interact
   when personalization is denied) is a named follow-on (`docs/refinement-todo.md`), NOT this slice.
7. **End-to-end proof.** A rig/test does the real TWO-PHASE wiring: `reservePersonalization(config)` (eager, before an
   `appear` mark) → `boot(config)` with an alloy placement **+ a GA4 sink** (lazy) → `sendEvent` returns a `__view__`
   Target proposition → the pre-reserved box is **filled via `reserveSpace` (reserve mark < appear; geometry
   unchanged reserve→fill, no reflow)** → a `proposition_display` exposure is **captured by the GA4 sink**. (Promotes
   the 012-03 `rig/alloy-decisions` shape to the real eager/lazy split — NOT the harness's inline reserve.)

**DoD:** all ACs pass; **TDD red→green**; reviewed (compliance + craft + **arch** [`arch_review: true` — a new public
eager entrypoint + the host message contract + the config surface + the composite exposure routing] + **frame-critique**
[`frame_review: true`, re-verified after this reshape]); deviation log + reconciliation sweep; reconciliation review;
`docs/refinement-todo.md` alloy entry **FULLY CLOSED** (analytics [033-02] + personalization [033-03]) with the three
documented limitations parked as follow-ons (analytics-yes/pzn-no coarse consent; alloy-only exposure telemetry;
multi-scope personalization / `decisionScopes` request-wiring); board synced.

_Created 2026-09-04 as the personalization half of the 033-02 SPIDR-Path split; ACs fleshed + grounded, then reshaped
per the frame-critique (eager entrypoint, real consent behavior, scope plumbing, exposure sink) — 2026-09-04._

## Close-out

### Deviation log (implementation, 2026-09-04)

Implemented strict TDD (red→green). Full suite green (81 files, 1104 tests; baseline 80/1071), `node build.mjs` +
`node contracts/validate.mjs` + `npm run lint` clean, `rig/alloy-decisions.mjs` PASS (deps-gated — needs `@adobe/alloy`
installed in `probes/alloy-worker/`).

**Deviations from the grounded build plan (all deliberate, reviewed):**
1. **build.mjs blob:/data: scan scoping.** The plan said "the blob/data/ajv negative scans cover" the eager chunk, but
   the reserve module legitimately carries a `data:text/html` token (`core/sanitize-html.js`'s XSS URL-scheme denylist,
   via `dom.js`). The blob:/data: scan enforces the WORKER same-origin-file-URL invariant, and the eager module spawns
   no Worker — so including it there is a false positive. Instead the eager chunk is ajv-scanned + gets a NEW
   `createAirlock` lightweight-invariant scan AND (post-review nit #1) a `new Worker(` scan (self-defending the
   no-Worker premise that justifies the blob/data exclusion — seed-tested via a `reserveEntry` build param).
2. **Testbed config source.** The plan assumed 033-02 had added an alloy config path to `scripts.js`; it had not (still
   `bootEdsAnalytics`). Wired the two-phase as an OPT-IN `window.__airlockConfig` hook (eager `reservePersonalization` →
   lazy `boot(config, { reservedPlacements })`); absent it, the default GA4/RUM boot is byte-unchanged.
3. **`reservedPlacements` shape** = `{ "__view__": <handlePromise> }` (scope→promise), per the pinned implementation
   order (the plan offered `{selector, handlePromise}` as an alternative).
4. **Shared `adapters/eds/placements.js`** extracted (vs an inline parser) so the eager module and `index.js`'s
   validator share the placement/scope shape without either importing the other.
5. **Composite `push`/`pushCritical` return the fan-out count** (additive) so the exposure sink detects an alloy-only
   "nowhere to land" (count 0) and diagnoses it (AC4).
6. **`caps.decisions` gated on personalization being CONFIGURED** (`placements` present OR `reservedPlacements`
   non-empty) — post-review nit #2 (arch #3): an analytics-only alloy boot leaves it UNWIRED so the host ignores
   `{type:"decisions"}` (033-02 byte-parity), while the mis-wire case (placements configured, eager reserve skipped)
   still wires + drops+diagnoses so the adopter sees it (AC3).

**Post-review nits fixed (TDD red→green):** (#1) build.mjs `new Worker(` self-defense on the eager chunk; (#2)
`caps.decisions` gate above; (#3) runtime `minHeight` validation parity with the schema (a missing/non-numeric
`minHeight` now rejects loud instead of NaN-rejecting `reserveSpace` into a silent no-op).

**Reviewer-documented follow-ons (NOT fixed — backward-compatible, bounded; parked in `docs/refinement-todo.md`):**
(a) exposure routing couples to the mutable `window.airlock` global — a wired composite-emit hook would decouple it;
(b) the composite fan-out COUNT conflates "no connector accepted" with "no analytics sink" (correct only while GA4 is
the sole `["*"]` sink) — a scoped `composite.accepts(name)` would leave `push()` untouched; (c) the AC7 vitest uses a
hand-rolled composite stand-in (the real `createComposite` gate is covered by the AC4 count test + the browser rig).

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `core/wrapped-sdk-host.js` | `updated` | AC1 additive `{type:"decisions"}` branch → `caps.decisions.deliver` iff wired (guarded, no-throw; analytics-only/GA4 byte-unchanged). |
| `adapters/eds/index.js` | `updated` | `bootAlloy` wires `caps.decisions` (via `wireAlloyDecisions`) gated on personalization configured; the handed-off fill + `proposition_display` exposure via the composite; `createComposite.push`/`pushCritical` return the fan-out count; `boot(config,{reservedPlacements})` threading; `validateConnectorEntry` rejects non-`__view__` scope + bad `minHeight`. |
| `adapters/eds/reserve-personalization.js` | `updated` (NEW) | AC2 eager pre-paint entrypoint — imports only `createDomCapability` + `placements.js` (no `createAirlock`/connectors/web-vitals). |
| `adapters/eds/placements.js` | `updated` (NEW) | Shared pure `parseViewPlacement` + `VIEW_SCOPE`, imported by both the eager module and `index.js` (neither imports the other). |
| `build.mjs` | `updated` | AC2 2nd non-worker ESM dist entry (`reserve-personalization`) + a `reserveEntry` seed param; the eager chunk is ajv- + `createAirlock`- + `new Worker(`-scanned (self-defending the blob/data exclusion), NOT in the worker-URL blob/data scan (spawns no Worker). |
| `publish-dist.mjs` | `updated` | AC2 `DIST_ARTIFACTS` gains the eager module. |
| `contracts/instrumentation-config.schema.json` + `contracts/validate.mjs` + fixtures | `updated` | AC5 single-`__view__` `placements` subschema; golden gains a placement; `…-alloy-nonview-scope.negative.json` (NEW) wired. |
| `probes/eds-testbed/scripts/scripts.js` | `updated` | AC2 loader wiring — an OPT-IN `window.__airlockConfig` two-phase hook (eager reserve + lazy boot hand-off); absent → the default GA4/RUM boot is byte-unchanged. |
| `rig/alloy-decisions.mjs` + `rig/alloy-decisions-harness.html` | `updated` | AC7 promoted to the real two-phase (eager `reservePersonalization` → handed-off fill → composite exposure); `reserve<appear` + geometry-unchanged + GA4-captured/alloy-ignored assertions. |
| `test/eds-boot-alloy.test.js`, `test/reserve-personalization.test.js` (NEW), `test/wrapped-sdk-host.test.js`, `test/dist-build-publish.test.js` | `updated` | AC1–AC7 tests + the 3 post-review nit tests (build no-Worker seed; analytics-only no-diagnostic parity; `minHeight` rejection). |
| `docs/refinement-todo.md` | `updated` | alloy config-wiring entry **FULLY CLOSED** (analytics 033-02 + personalization 033-03); the 3 follow-ons parked (coarse consent; alloy-only exposure telemetry; multi-scope/`decisionScopes` + the exposure-hook + push→accepts refinements). |
| `docs/architecture.md` | `no-op` | the Contract-surfaces instrumentation-config note (032) is connector-agnostic; alloy personalization is covered by the same pre-1.0 surface — no per-connector enumeration to update. |
| `docs/specs/README.md` (board) | `deferred` | the 033-03 row flips IN_PROGRESS→**DONE** at the DONE transition (close-out). |
| `docs/specs/033-alloy-config-wiring/spec.md` | `no-op` | the SPIDR split + the 033-03 Slices entry were committed in `b2b5232`/`792bf8d`; the implementation did not touch it. |

### Definition of Done — verification
- [x] All 7 ACs pass; **TDD red→green**. `npm test`: **81 files, 1104 tests** (baseline 1071 → +33; +4 in the post-review nit round). Zero regressions.
- [x] `node build.mjs` OK (eager `reserve-personalization.js` emitted; `all_workers_are_same_origin_file_urls: true`); `node contracts/validate.mjs` all pass; `npm run lint` clean; **`rig/alloy-decisions.mjs` PASS** (real-browser two-phase: reserve<appear, geometry unchanged, GA4-captured/alloy-ignored exposure).
- [x] Reviewed: **compliance + craft + arch** (`arch_review: true`) + **frame-critique** (`frame_review: true`, 3 rounds) — all recorded pass; the 3 reviewer nits fixed, the deeper follow-ons documented.
- [x] Deviation log + Reconciliation sweep produced; reconciliation review passed.
- [x] `docs/refinement-todo.md` alloy entry **FULLY CLOSED** (analytics + personalization). Board synced.
