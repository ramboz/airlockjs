---
status: IN_PROGRESS
dependencies: [033-02]
last_verified:
arch_review: true  # extends the wrapped-SDK host message contract + the decisions→reserveSpace delivery path.
frame_review: true  # rests on 033-02's config-boot design; the {type:"decisions"} path is genuinely un-built today.
claimed_by: claude/mvp6-e4550f
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
