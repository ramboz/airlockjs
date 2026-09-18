---
status: OPEN
topic: Personalization + experimentation runtime — Target VEC/form-based, AJO, aem-experimentation — eager hero landing without flicker, CWV-first
created: 2026-09-18
related:
  - R-005-eds-no-flicker-eager-swap.md
  - R-004-alloy-in-worker.md
  - ../specs/005-uc1-pzn-exposure/spec.md
  - ../specs/033-alloy-config-wiring/spec.md
  - ../specs/034-alloy-config-followups/spec.md
  - ../specs/025-worker-dom-mirror/spec.md
  - ../specs/018-reservespace-security/spec.md
  - ../decisions/adr-0014-worker-dom-compat-minimal-mirror.md
  - ../decisions/adr-0023-ad-pzn-egress-hold-until-consent.md
  - ../refinement-todo.md
---

# R-012: Personalization + experimentation runtime

> This is an **open investigation**, not a decision and not committed work.
> A decision belongs in an ADR (`docs/decisions/`); committed work belongs in
> a spec (`docs/specs/`). This note holds the question, sources, and
> pros/cons *before* either of those is warranted — see jig's ADR-0054
> (linked from [README.md](README.md)).

## Question

How does airlock support the personalization and experimentation use cases
EDS customers actually run — **Adobe Target VEC activities** (CSS-selector
`dom-action`s), **Target form-based activities** (mbox → html/json offer),
**Adobe Journey Optimizer** (web visual, code-based surfaces, in-app
messages, content cards) and **aem-experimentation** (metadata-driven
experiments/campaigns/audiences) — **OOTB**, with the decision **landing in
the eager window for hero personalization**, supporting **lazy-loaded blocks**
later in the page, and staying **CWV-first** — given that **visible content
flicker is a hard no-go** (the #1 customer complaint)?

Brainstorm captured 2026-09-18 (maintainer + Claude). Research grounded by
three parallel passes: the airlock repo at `2bccb2c`, `adobe/aem-experimentation`
v2.0.0 + `adobe-rnd/aem-martech` main + PR #17, and `adobe/alloy` main source +
Experience League docs. Pinned findings below; design direction after.

## Sources / findings

### 1. What airlock already ships (repo @ `2bccb2c`)

- **Eager surface = one verb.** `adapters/eds/reserve-personalization.js:51-75`
  parses `placements` (alloy-connector only, first connector only —
  `placements.js:47-67`), calls `dom.reserveSpace(spec)` per placement, returns
  `{ reservedPlacements: { [scope]: Promise<handle> } }`, never throws. The
  eager chunk is a **build-asserted separate dist entry** with no
  `createAirlock` and no `Worker` (`build.mjs:55-62`, `:262-281`).
- **`reserveSpace`** (`adapters/eds/dom.js:174-256`): spec
  `{selector, minHeight, prehide?, timeout?, grow?}`; sizes synchronously
  (`minHeight` + `maxHeight` + `overflow: clip` unless `grow`), prehides with
  `visibility: hidden` + 3000 ms reveal backstop; handle
  `{id, reservedAt, fill(html), release()}`. `fill` = sanitize-then-write via
  the memoized `airlock-sanitize` Trusted-Types policy (`dom.js:89-108`).
  **`insertAfterInteraction` is declared-not-built** — rejects unconditionally
  (`dom.js:258-261`) although `docs/product-vision.md` names it as a capability.
- **Post-paint fill** (`adapters/eds/index.js:1459-1512`, `wireAlloyDecisions`):
  matches decisions by `scope`, `htmlOfDecision` → `handle.fill(html)`, reports
  `proposition_display`. Anything that is not an
  `html-content-item` / `text/html` item — **JSON offers, redirects, Target VEC
  `dom-action` items — returns `null` and is dropped with a warning**
  (`:1503-1506`). No lazy re-reserve by design.
- **alloy chamber**: real adopter-supplied alloy bundle runs in a **classic
  Worker** (`index.js:1591-1595`; `connectors/alloy/alloy-chamber.worker.js`),
  `sendEvent` pinned `renderDecisions:false` (`connectors/alloy/connector.js:226`),
  `decisionScopes` wired, `extractDecisions(scope:null)` fans out all scopes,
  decisions posted to the host as data → `caps.decisions.deliver`. Pull-shaped
  `decisions.fetch` is loudly not-built. Rig `rig/alloy-decisions.mjs` runs the
  REAL alloy + REAL chamber against a **minted Edge response**
  (`rig/alloy-mint-stub.js`) — what is unproven is the live per-scope Edge
  response (creds-gated, 013 pattern).
- **Consent**: `personalization` is a first-class purpose; the trusted seam
  strips `events[].query.personalization` per interact when un-granted
  (`core/wrapped-sdk-host.js:337-360`). ADR-0023 `holdOnDenied` exists.
- **Worker DOM mirror (025, ADR-0014 Option C)**: worker-side records ops the
  main thread validates and applies; **no `querySelector*`**, sync layout reads
  return inert zeros; `apply-policy.js` allowlists tags/attrs and refuses
  URL-bearing attrs + `on*` by construction (`:18-22`); `dom-apply.js` chunks
  at 5 ms. Measured: `innerHTML`-heavy apply through the mirror was a **2×
  regression** (p75 24.1 vs 11.5 ms) → mirror stays for chunkable writes.
- **Spec 005 exposure**: body-dataset read + `aem:experimentation` listener →
  `experiment_impression`; **lazy, so a fast bounce loses it, and the loss is
  differential** (worse variant bounces faster → biased lift). Page-level only.
- **Eager budget** (R-005): everything before `body.appear` delays FCP/LCP
  1:1; ~11–19 ms local floor for the aem-experimentation swap; "eager
  decide-and-apply cannot round-trip through a worker without delaying
  `appear`".
- **Doc-vs-code gap found:** `docs/architecture.md` AD-9 says "egress is
  prerender-aware (held until activation)" and `refinement-todo.md:337` calls
  it "AD-9's existing prerender-aware held-until-activation model", but a grep
  for `prerender`/`prerendering`/`activation` over `core/`, `adapters/`,
  `connectors/`, `test/` at `2bccb2c` returns **nothing**. Treat AD-9's
  prerender hold as **declared, not implemented** until proven otherwise.
- **Greenfield:** `VEC`, `mbox`, `AJO`, `viewName`/SPA-personalization appear
  nowhere in the corpus; no ADR covers propositions, flicker or the eager
  phase.

### 2. aem-experimentation v2.0.0 (`adobe/aem-experimentation`)

- Exports `loadEager(document, options)` / `loadLazy(document, options)`;
  site calls them from `scripts.js` **before `decorateMain` / `appear`**.
  Eager = `serveAudience` → `runExperiment` → `runCampaign`, strictly
  sequential, each fully awaited. Lazy = simulation/preview UI only.
- One engine `applyAllModifications(...)` with three passes: **page**
  (`<meta name="experiment…">`, target `main`), **section** (`.section-metadata`
  rows, target the section `div`, from the already-chosen page variant),
  **fragment** (`<type>-manifest` JSON + `MutationObserver` on `body`,
  fetch+replace when `selector` appears, then `pluginOptions.decorateFunction(el)`).
- Swap `replaceInner`: `fetch` the **full variant page HTML**, `DOMParser`,
  take `main` or `main > div`, `el.innerHTML = newEl.innerHTML`. Control =
  current content. `resolution: redirect` → `location.replace`.
- Bucketing: `ued.evaluateDecisionPolicy` with `randomizationUnit:'DEVICE'` and
  context `{}` → effectively `Math.random()` weighted assignment, cached in
  `sessionStorage['unified-decisioning-experiments']` (30-day prune). The
  MurmurHash/ECID `VISITOR` path is dead code in practice.
- Reporting: `sampleRUM('experiment'|'audience', {source, target})` (campaigns
  report as `audience`), body/section classes + `dataset`, and
  `document.dispatchEvent(new CustomEvent('aem:experimentation', {detail}))`,
  the dataset/class writes and the event are **synchronous**; only the
  `sampleRUM` call is wrapped prerender-aware (`document.prerendering` →
  `prerenderingchange`). Campaigns reuse the `audience` dataset key (the
  `campaign-*` class disambiguates). No `onExperimentChosen` hook. README shows manual
  bridges to alloy `decisioning.propositionDisplay`, GTM, Tealium.
- Options: `audiences: {name: () => boolean|Promise}` (first truthy wins,
  `?audience=` forces), `decorateFunction`, `isProd`/`prodHost`, metadata/query
  prefixes. `experiment-requires-consent` gates on
  `localStorage['experimentation-consented']`.
- CWV posture: fully render-blocking eager, no timeout, no anti-flicker CSS
  needed because nothing paints before the swap.

### 3. aem-martech main + PR #17 (`adobe-rnd/aem-martech`)

- `initMartech(webSDKConfig, {personalization:true, performanceOptimized:true,
  personalizationTimeout:1000, decisionScopes:[], launchUrls:[], …})`. alloy
  (vendored 2.31.1) loads + configures in **eager** when `personalization`.
  No `prehidingStyle`, no AJO `surfaces`, no `propositionInteract`.
- `martechEager` (optimized path, **no hiding**): one
  `sendEvent({type:'decisioning.propositionFetch', renderDecisions:false,
  personalization:{sendDisplayEvent:false, decisionScopes}})`, keep only
  `dom-action` propositions, then `onDecoratedElement(run)`: apply via
  `alloy('applyPropositions',{propositions})` immediately if any
  `[data-block-status="loaded"],[data-section-status="loaded"]` exists, and on
  every MutationObserver tick where a target reaches `loaded`. Track
  `renderAttempted` → `renderedPropositionIds`; on page activation send **one**
  page-view/display event listing rendered dom-action ids + all non-dom ids;
  late renders get follow-up display events deduped by id. **1 s bail-out →
  `personalizationTimedOut` → abandon** (no late apply). Non-optimized path
  hides `body` (`visibility:hidden`) and uses `renderDecisions:true`.
- SPA: `getPersonalizationForView(viewName)` / `applyPersonalization(viewName)`,
  manual, no route detection.
- **PR #17** ("feat: support Form-Based activity propositions and non-visual
  selector guard", sagarsane, **open Draft**, +346/−20): form-based
  `html-content-item` offers carry no selector, so the author declares
  placement via section metadata `mbox | <scope>` (+ `mbox-action`) →
  `data-mbox`; `discoverPropositionScopes(root)` maps scope → synthetic class
  selector + actionType, merges into `decisionScopes` (always with `__view__`),
  and applies via `applyPropositions({propositions, metadata:{[scope]:{selector,
  actionType}}})`. **Open:** single-shot eager fetch (scopes discovered after
  it are "not personalized this load"), discovery only on the optimized path,
  no consumer config for scope→selector, no tests for new behavior, and per
  the author it stays draft "until we have a customer who needs this feature".
  ⇒ PR #17's `data-mbox` **is airlock's `placements` concept**, discovered from
  the DOM instead of config.

### 4. Web SDK (alloy) Target/AJO mechanics (source @ main, monorepo)

- **Request:** `sendEvent({renderDecisions, personalization:{decisionScopes,
  surfaces, sendDisplayEvent (default true), includeRenderedPropositions,
  defaultPersonalizationEnabled, decisionContext}})`. First `sendEvent` of a
  page auto-requests the page-wide scope `__view__`; `dom-action` schema is
  requested **only when `__view__` is in scopes**. Wire =
  `POST /ee/v2/interact?dataStreamId=…` with `events[].query.personalization
  {schemas, decisionScopes, surfaces}`, `meta.state.entries` carrying
  `kndctr_<ORG>_AdobeOrg_identity`/`_cluster` cookies, `query.identity.fetch:["ECID"]`.
  `adobe_authoring_enabled` in the URL disables personalization.
- **Response:** handle `personalization:decisions` → propositions
  `{id, scope, scopeDetails{decisionProvider:'TGT'|'AJO', activity, experience,
  strategies, characteristics{scopeType, eventToken, analyticsToken}}, items[{id,
  schema, data, meta}]}`. Schemas: `default-content-item`, `dom-action`,
  `html-content-item`, `json-content-item`, `redirect-item`, `ruleset-item`,
  `message/in-app`, `message/content-card`, `measurement`.
- **dom-action types** (`dom-actions/initDomActionsModules.js`): `setHtml`,
  `customCode` (→ prependHtml; **script-element injection, needs CSP nonce**,
  no eval), `setText`, `setAttribute`, `setImageSource`, `setStyle`, `move`,
  `resize`, `rearrange`, `remove`, `insertAfter`, `insertBefore`, `replaceHtml`,
  `prependHtml`, `appendHtml`, `collectInteractions`, plus `click` (stored
  selector → interact on click). Per action: `selector`, `prehidingSelector`,
  `content`, `format`. Selectors support `:eq(n)` (`selectNodesWithEq.js`) and
  `:shadow`. `awaitSelector` = immediate select, else `MutationObserver` on
  `document` with **5000 ms** timeout. Head offers remapped to `appendHtml` of
  `SCRIPT/LINK/STYLE`.
- **Scope-type routing:** `page` (`__view__` / fragment-less `web://` surface)
  and current `view` auto-render under `renderDecisions:true`; everything else
  (**Target form-based mboxes, AJO `#fragment` surfaces**) is `proposition`
  type → never auto-rendered → `applyPropositions({propositions, metadata:
  {[scope]:{selector, actionType}}})` (html items without metadata are
  dropped; docs allow `setHtml|replaceHtml|appendHtml`).
- **Notifications:** `decisioning.propositionDisplay|Interact|Trigger|Dismiss|
  SuppressDisplay` with `_experience.decisioning.propositions[{id, scope,
  scopeDetails, items[{id}]}]` + `propositionEventType{display:1}`;
  `propositionAction{label, tokens}` on interact; `SuppressDisplay` today only
  for a second in-app message (`propositionAction.reason:"Conflict"`).
  `sendDisplayEvent:false` defers into `renderedPropositions`, flushed by a
  later `includeRenderedPropositions:true` (top/bottom-of-page pattern).
- **Prehiding:** snippet injects `<style id="alloy-prehiding">` with a 3000 ms
  removal; `prehidingStyle` config does the same from inside the SDK; guidance
  is "hide containers, not body". Consent-pending → `createHandleConsentFlicker`
  reveals rather than holds.
- **AJO:** surfaces `web://<host><path>#<fragment>`; code-based = `#fragment`
  surfaces (manual apply); in-app messages render in a `blob:` iframe overlay;
  **RulesEngine** (`packages/core/src/components/RulesEngine/`) evaluates
  `ruleset-item`s client-side with `@adobe/aep-rules-engine` against a
  flattened context (page, browser, `window.{width,height,scrollX,scrollY}`,
  event history) — **DOM-free** except the injected window context;
  `personalizationStorageEnabled` gates localStorage event history;
  `subscribeRulesetItems` for content cards.
- **Target:** mbox = scope; `target-global-mbox` ⇄ `__view__`; A4T via
  `scopeDetails.characteristics.eventToken`/`analyticsToken`; **on-device and
  hybrid decisioning not supported on Web SDK**; `targetMigrationEnabled` →
  `meta.target.migration:true`; QA via `at_qa_mode`; VEC authoring relies on
  the Visual Editing Helper extension, alloy only honours `adobe_authoring_enabled`.
- **Worker / server precedents:** no Adobe guidance on Web SDK in a Worker;
  browser package hard-depends on `window`/`document` for render only.
  **`@adobe/alloy-node`** (alpha) ships "fetch-only Personalization" returning
  propositions "the same shape `applyPropositions` expects" — the closest
  precedent for a worker-side decision leg. **Hybrid pattern** (alloy-samples):
  server calls the Edge Server API `interact`, page calls
  `alloy('applyResponse', {responseHeaders, responseBody, renderDecisions,
  personalization:{sendDisplayEvent}})` which replays the full lifecycle,
  writes `state:store` cookies, renders page-wide `dom-action`s.
- **Not found in source (unverified/absent):** `qualifiedSelector`, a `track`
  actionType, `measurement` handling.

### 5. The physics (settled in the brainstorm)

- Everything before `body.appear` delays FCP/LCP 1:1 (R-005). A remote Edge
  round trip is an order of magnitude above the local eager floor.
- A **prehidden hero is not an LCP candidate**, and a **skeleton is not one
  either** (CSS gradients/backgrounds do not count). LCP keeps updating until
  first interaction, so when the hero is the largest element, LCP =
  "when the personalized hero actually painted" in **both** skeleton and
  blocking modes. Skeleton buys FCP and perceived responsiveness, not LCP.
- The only non-blocking option that protects LCP is **default-first** (paint
  control, swap a same-size variant later — a same-size swap does not move
  LCP). **Rejected as a default: visible swap = flicker = the #1 complaint.**
- ⇒ For remote decisions, "no flicker" and "no LCP cost" are only jointly
  achievable by **landing the decision before eager** (edge-injected, cached,
  prefetched, or a head-fetch that wins the race). Everything else is a
  bounded, measured LCP hold.

## Design direction (brainstorm output, not yet decided)

### Two structural invariants

1. **CLS-by-construction (exists):** reserve before `body.appear`; geometry
   unchanged reserve→fill (033-03/034 rig gates).
2. **Flicker-by-construction (new):** **airlock never mutates a placement
   after it is visible.** Content is written while hidden, or not at all. At
   a placement's visibility boundary: decision in hand → apply **atomically**
   (same microtask, never chunked across a paint); decision not in hand →
   reveal default + `decisioning.propositionSuppressDisplay`
   (`propositionAction.reason:"Timeout"`). **No late swap, ever.** Chunked
   (5 ms) apply is reserved for not-yet-visible content and bulk work.

### One proposition contract, one placement registry

- Internal model = alloy's proposition shape (Target, AJO, Server API and
  `applyPropositions` all already speak it). aem-experimentation variants →
  `html-content-item` with a `main`/section selector + `default-content-item`
  for control.
- **Placements** = the author-owned registry: scope/surface → `selector`,
  `actionType`, reserve geometry (`minHeight`/aspect), **`prehideSelector`**
  (hide the smallest node that can change so an unchanged hero image can still
  be the LCP candidate), wait budget, timing class, cache policy. Declared in
  config **or discovered at eager from section metadata** (PR #17's `data-mbox`
  idea, vendor-neutral naming).

### Decision sources, tiered by latency, all feeding the same applier

| Tier | Source | Available | Cost / note |
|---|---|---|---|
| 0 | Edge-injected inline JSON (CDN worker → Server API `interact` → `<script type=application/json>`) | before parse | needs customer edge compute; the only zero-LCP path; applier accepts an inline source from day one |
| 1 | Local decision (aem-experimentation model) | eager, ms | variant fetch RTT only |
| 2 | **Head fetch**: inline `<head>` `fetch('/ee/v2/interact')`, cookies read first-party, response handed to the worker alloy via `applyResponse` | races paint | re-implements request shape + cookie read; ONE interact per page serves hero + below-fold + identity |
| 3 | Worker alloy chamber `sendEvent` (shipped) | lazy | zero re-implementation; never in time for eager |
| 4 | Per-URL decision cache + prefetch (speculation rules, hover/pointerdown, idle worker) | instant | staleness; profile side effects; server-call volume |

The **mode is a paint policy, not a fetch policy**: the request fires the same
way in every mode; the flag only changes what the user sees while waiting.

### Eager applier: two modes, one flag

| Mode | FCP | LCP | Variant users see |
|---|---|---|---|
| `skeleton` (= `async`; declared, not default — see Addendum) | fine | waits, bounded | placement-scoped hide, project CSS draws the skeleton off `data-airlock-pending` |
| `blocking` (opt-in) | waits | waits, bounded | nothing until decision; hold `body.appear` up to N ms |
| `default-first` | fine | protected | **control then swap — REJECTED as default (flicker)** |

- **Flag surface:** `<meta name="personalization" content="off|async|blocking">`
  page-level; section metadata `personalization | blocking` +
  `personalization-timeout | 1500` per placement; config hook
  `mode: (doc) => …` with the metadata resolver as default implementation.
  **`document.prerendering` forces `blocking`** (free when nobody is watching),
  falling back to the declared mode with the remaining budget on activation.
- **Integration = one line** in the customer's eager phase
  (`await airlockEager(doc)`): resolves immediately in async modes, waits
  bounded in blocking. Eager chunk stays build-asserted Worker-free.
- **Blocking yields to consent:** pending `personalization` purpose degrades
  blocking → skeleton for that pageview (alloy's consent-flicker behaviour).
- **Timeout = the invariant:** reveal default, abandon, `SuppressDisplay`.
  No `apply-late` for anything visible.
- **Decision cache policy per placement:** `off | fresh-only (default) |
  stale-ok(+TTL)`. Stale never swaps: a revalidated decision lands on the
  *next* view. `stale-ok` is the marketer's explicit acceptance that a
  just-ended activity may show once more.

### Lazy applier (dom-action interpreter)

- VEC vocabulary (`setHtml`, `setText`, `setAttribute`, `setStyle`,
  `insertBefore/After`, `append/prepend/replaceHtml`, `move`, `rearrange`,
  `remove`, `click`) on `adapters/eds/dom-apply.js` chunking +
  `core/sanitize-html.js` + the memoized TT policy + `apply-policy.js`
  allowlist; add `:eq()` / `:shadow` resolution; selector resolution and
  geometry stay main-thread (mirror has no `querySelector`).
- Pending propositions in a selector-keyed queue, drained by **one**
  `MutationObserver` on `data-block-status` / `data-section-status` (EDS
  sections are `display:none` until `loaded`; the MO callback is a microtask
  before that frame paints → flicker-free when the decision is in hand).
- Track `renderAttempted` per item → worker → display notifications with the
  exact `{id, scope, scopeDetails}`.

### Worker stays the brain

Decisioning, identity, cookies (`applyResponse`), `propositionDisplay`/
`Interact`/`SuppressDisplay`, AJO RulesEngine + content cards (DOM-free; feed
window context from main capture), click tracking (one delegated main-thread
listener → enqueue). **Eager exposure capture** into the ring buffer fixes
005's differential-bias hole. Exposure keeps routing to any `["*"]` sink
(vision differentiator vs aem-experimentation). In-app messages / overlays
render through a **built** `insertAfterInteraction`, never in eager.

### Speculation rules (new, not accounted for in airlock so far)

1. Prerender = free eager window → force `blocking` under `document.prerendering`.
2. **Prerender as a seal hold reason**: decision fetch flows; display/page
   view/exposure held until `prerenderingchange`, dropped on discard. Same
   shape as the pending-consent hold. (AD-9 claims this exists; code says no.)
3. Warm the per-URL decision cache from the document's own `speculationrules`.
4. Cross-browser "moderate eagerness" for decisions: `pointerover`/`pointerdown`
   on same-origin links (already captured) → worker prefetches that href's
   decisions (~one RTT of head start).
5. Personalization decides what to speculate: JSON offer → capped
   `speculationrules` apply op (same-origin, allowlisted, small N).
6. RUM/scoreboard must subtract `activationStart` (LCP, `lcp_hold_ms`); check
   helix-rum-js does too.

### Addendum 2026-09-18 — corrections from the ADR frame-critiques

The frame-critique passes on ADR-0031/0032/0033 corrected four points of the brainstorm text above; the ADRs are
authoritative where they differ:

- **"Visible" = user-visible, not rendered.** An off-screen `loaded` lazy block is still mutable; the boundary is first
  viewport intersection (IntersectionObserver with a `rootMargin` lookahead; IO callbacks run *after* paint, so the
  lookahead is what buys the pre-visibility window). The hero boundary is its **section reveal** (first-section `loaded`
  after `waitForFirstImage`, `aem.js:648-650`), not `body.appear`, which the boilerplate adds *before* the first section
  loads (ADR-0031/0032).
- **Never-arrived decisions cannot be suppressed** (no proposition ids); they are counted airlock-side
  (`pzn_decision_missing`). Suppression covers the late-arrival case only, so Option C narrows Option B's differential
  bias rather than eliminating it (ADR-0031).
- **No wait by default.** A declared placement is a registry entry, not a reason to wait; waiting is charged per pageview
  and there is no pre-response vendor signal for "activity live on this URL", so `off` is the default (no reserve, no
  prehide) and `async` (skeleton) / `blocking` are page-context declarations — authored content on EDS (page metadata or
  the bulk-metadata sheet), optionally sourced from a site-level activity manifest. A **per-browser memory must not
  decide exposure** (it would expose returning visitors only — an invalid experiment); a cache hit only removes a
  declared wait. The head fetch fires in every mode, but **under `off` an `initialViewport` placement (a
  device-independent per-placement registry attribute, default `true`; NOT a per-view geometry result, which would be a
  device-class confound) is never applied even when its decision is in hand early** — it is reported
  `SuppressDisplay(reason: "Undeclared")` regardless of arrival time, and zero-latency sources (cache, inline) are
  withheld too — the declaration, not latency, is the gate; `initialViewport: false` placements still apply
  opportunistically with measured skew. Suppression reasons: `Timeout` (declared wait missed), `Undeclared` (`off` page),
  `Consent` (declared wait degraded for pending/denied consent). Airlock never defaults an `initialViewport` placement into a network race the
  adopter did not opt into; `async` + a zero budget is the explicit opportunistic declaration. `airlockEager(doc)` sits **after
  `decorateMain`** (the upstream hero is an auto-block built there), reading `section.dataset.*` primary / raw
  `.section-metadata` fallback; the head fetch is a separate `<head>` snippet; `blocking` is applied inside the first
  section's load callback so block/image work overlaps the decision RTT.
  Variant-image preload at decision time keeps `blocking` from beating `async` on LCP for image-bearing variants
  (ADR-0032).
- **aem-experimentation is hosted unforked.** It has no decide-without-apply hook and swaps pre-decoration source, so
  airlock normalizes its *outcome* (from `aem:experimentation` + the dataset) into a `source`-phase proposition and
  captures exposure earlier (section-level included) from the body/section datasets (event listener secondary, for the
  async fragment pass); the contract gains `applyPhase: "source"|"dom"` — two apply regimes sharing one schema.
  **Correction to "fixes 005's differential-bias hole" above:** it does not — that hole is egress-timing (no egress path
  exists before the lazy boot), so eager *capture* leaves the loss window unchanged; an eager unload egress is a separate,
  principle-tensioned decision tracked in refinement-todo.
  Airlock owns render bookkeeping (`renderAttempted`) and feeds alloy's manual-render notification flow; ids-in ==
  ids-notified is a rig target (ADR-0033).

### Coverage

| Use case | Handled by |
|---|---|
| Target VEC on hero | placement + tier 0/2/4 + skeleton/blocking + dom-action interpreter |
| Target VEC on lazy block | pending queue drained on `loaded` (tier 2/3) |
| Target form-based mbox | placement `setHtml`; JSON offers via project hook |
| AJO web visual | as VEC, `decisionProvider: AJO` |
| AJO code-based `#fragment` surface | placement keyed by surface |
| AJO in-app / content card | RulesEngine in worker; render via `insertAfterInteraction` |
| aem-experimentation page/section/fragment | tier 1 swap-before-decorate; exposure shipped; add section-level |
| Redirect offers | eager only (as aem-experimentation `resolution: redirect`) |
| SPA view change | re-entrant placement lifecycle + tier 4; later slice |

### Evidence instead of argument

Emit per placement: `lcp_hold_ms` (skeleton/blocking), suppression rate
(`SuppressDisplay` with reason), decision-arrival-vs-eager delta, cache hit
tier. Customers move a page to `blocking` or shorten a budget on data.

## Options / pros & cons (ADR-grade questions)

1. **`customCode` offers.** alloy executes them by script-element injection
   (needs nonce). (a) Reject by default + diagnostic, per-activity allowlist
   opt-in — keeps the capability model, honest at.js-parity gap. (b) Execute
   as alloy does — parity, breaks the model. Lean: (a).
2. **Default remote-hero paint policy.** `skeleton` (FCP preserved, LCP
   bounded) vs `blocking` (blank until decision). Lean at brainstorm time:
   `skeleton` default, `blocking` via metadata flag. **Superseded by ADR-0032:**
   `off` (no wait) is the default; `async`/`blocking` are page-context
   declarations; both bounded; `default-first` never default.
3. **Tier 2 head fetch vs eager Worker boot.** Head fetch: fastest to first
   byte, re-implements the documented request shape + cookie read, handed to
   alloy via `applyResponse` (no identity re-implementation). Eager Worker:
   no re-implementation, but bundle download + parse before the request fires,
   and breaks the "eager chunk constructs no Worker" build invariant. Lean:
   head fetch, request shape pinned in a contract schema.
4. **Host vs subsume aem-experimentation.** Host it as the tier-1 provider
   behind the shared placement/exposure model first; absorb decisioning only
   if the shared engine needs it. Its authoring model (metadata/manifests)
   stays.
5. **`href`/`src` in `setAttribute`/`setImageSource`.** Reopens the surface
   018 + `apply-policy.js` deliberately closed; ship scheme checks with it.
6. **Prerender hold + decision prefetch side effects.** Speculative fetches
   hit the Target profile / AJO event pipeline (visit counts, "viewed page X",
   fetch-triggered journeys) even when never displayed; server-call volume
   under Target licensing. Default eagerness `moderate`/`conservative`;
   `immediate`/`eager` opt-in. Needs Target/AJO team confirmation.
7. **`SuppressDisplay` for timeouts.** alloy emits it only for in-app
   conflicts today; whether Target A4T reporting surfaces it or merely omits
   the impression is unverified (CJA: ordinary event type). Confirm before
   promising it in reports rather than in the data.

## Open questions

- Does a dedicated Worker run inside a Chrome prerendered page, do held
  beacons flush exactly once on activation and never on discard, and does
  LCP read ≈ 0 relative to `activationStart`? → **probe on the EDS testbed**
  (decides whether speculation ideas 1–2 are a slice or a wish).
- Real-CDN head-fetch race: how often does `/ee/v2/interact` beat eager on
  cold vs warm connections, mobile vs desktop? (Decides how often
  skeleton/blocking actually engages.)
- Is the `kndctr_*_identity` cookie readable/ridable from an inline head
  fetch under both third-party edge domain and first-party CNAME setups?
- Live per-scope Edge/Target response shape (creds-gated residual from 034).
- How to signal "this page has a hero activity" without a developer flipping
  metadata each time a marketer launches one (diagnostic when a `__view__`
  proposition targets the hero on an async page; optional per-URL memory).
- Marketer acceptance: is skeleton-then-content perceived as "flicker"?
- SPA/view-change: re-`reserveSpace` after route change contradicts the
  eager-reserve-only invariant; needs a re-entrant placement lifecycle.
- Section-level aem-experimentation exposure (005 is page-level only).
- Should `insertAfterInteraction` be built here (in-app messages, overlays)
  or the vision doc corrected?

## Conclusion

Open. Suggested slicing when this promotes to a spec:

1. **dom-action interpreter** on the lazy path with exact display semantics
   (`renderAttempted`, `{id, scope, scopeDetails}`) — testable against the
   existing minted-Edge rig; closes what PR #17 left open.
2. **Head fetch + `applyResponse` handoff** (tier 2) — without it "land the
   decision in eager" only holds for local decisions.
3. **Placements from section metadata + form-based/code-based apply**
   (`applyPropositions`-style metadata).
4. **Eager modes + flag + timeout/SuppressDisplay + eager exposure capture**;
   flicker-by-construction rig gate (placement mutated only while hidden).
5. **Decision cache + prefetch + prerender hold** (after the prerender probe).
6. **AJO RulesEngine + `insertAfterInteraction`** (in-app/content cards).
7. **SPA views.**

Doc corrections surfaced: vision names `insertAfterInteraction` as shipped
(it is not); AD-9 prerender hold is declared but not implemented; alloy
config README wording on `placements` is stale.

Promoted to: release plan [MVP10](../releases/mvp10.md) (candidate); [ADR-0031](../decisions/adr-0031-flicker-by-construction-invariant.md), [ADR-0032](../decisions/adr-0032-eager-paint-policy-and-flag.md), [ADR-0033](../decisions/adr-0033-proposition-contract-placement-registry.md) (decisions); [ADR-0034](../decisions/adr-0034-eager-decision-landing-head-fetch.md), [ADR-0035](../decisions/adr-0035-prerender-seal-hold-speculative-prefetch.md) (Proposed, probe-gated — the note stays OPEN until those probes land); open items → [refinement-todo § Personalization runtime](../refinement-todo.md).
