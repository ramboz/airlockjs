---
status: Accepted
dependencies: [adr-0001, adr-0014, adr-0016, adr-0031]
last_verified: 2026-09-18
frame_review: true
---

# ADR-0033: Proposition contract + placement registry: alloy's proposition shape as the internal model; aem-experimentation hosted as the local provider

## Status

Accepted (2026-09-18)

## Context

Airlock must serve three personalization providers through one runtime, and today it has no shared model for what a
decision *is* or where it may *land*. The alloy chamber delivers `Decision = { scope, content: <proposition> }`
(`connectors/alloy/decisions.js:42-51`), the EDS adapter renders only an `html-content-item` into a pre-sized box and drops
everything else (`adapters/eds/index.js:1503-1506`), placements are parsed only from the first alloy connector's config
(`adapters/eds/placements.js:47-67`), and aem-experimentation is a separate eager plugin whose exposure airlock merely
observes (spec 005: "the airlock reports, it does not decide").

The research in [R-012](../research/R-012-personalization-experimentation-runtime.md) §2–§4 shows the three providers are
closer than they look. Target (VEC and form-based), AJO (visual, code-based, in-app, content cards) and the Edge Server
API all emit **alloy's proposition shape** — `{id, scope, scopeDetails{decisionProvider, activity, experience,
characteristics{eventToken, analyticsToken}}, items[{id, schema, data}]}` — and alloy's own `applyPropositions` consumes it.
Where a *manual* item lands (form-based mbox, AJO `#fragment` surface) is already an author-owned map
`metadata[scope] = {selector, actionType}`; aem-martech PR #17 discovers that map from section metadata (`data-mbox`). And
aem-experimentation's inputs are worker-portable data (metadata, manifests, weighted random, date/consent gates) whose
output is "replace this element's inner HTML with that variant's" — an `html-content-item` with a selector.

## Decision Options Considered

### Option A: A bespoke airlock decision model, each provider mapped into it
- **Pros:** vendor-neutral by construction; airlock controls the vocabulary.
- **Cons:** a fourth shape nobody else speaks; every notification (display/interact/suppress) must be mapped **back** into
  alloy's shape with `scopeDetails` intact or A4T/AJO reporting breaks; invents where a documented contract exists.

### Option B (chosen): alloy's proposition shape is the internal contract; placements are an author-owned registry
- The internal `Proposition` **is** alloy's proposition, extended with one airlock field the vendor schema lacks:
  **`applyPhase: "source" | "dom"`**. `dom` items (Target/AJO `dom-action`, html/json offers) are DOM edits applied to
  the *decorated* DOM at a placement's boundary (ADR-0031). `source` items are **pre-decoration EDS source swaps** (a
  variant page's `main`/section markup replaced before `decorateMain`, which then decorates it) — aem-experimentation's
  model, and the ideal EDS path for local/inline decisions. The two phases share the schema, the placement registry and
  the exposure path; they are **two apply regimes, not one interpreter**, and the contract says so.
- Target/AJO/Server API normalize natively. aem-experimentation is normalized **after the fact** (see Sub-decision 1):
  its outcome becomes a proposition (`decisionProvider: "AEM-EXP"`, `applyPhase: "source"`, `html-content-item` for the
  served variant or `default-content-item` for control, `renderAttempted: true`) built from the `aem:experimentation`
  event detail and the body/section dataset it writes. Apply vocabulary for `dom` = alloy's `dom-action` types plus
  `setHtml` for html items.
- **Placements** are the author-owned registry: `scope | surface → { selector, actionType, minHeight/aspect,
  prehideSelector, budget, cache }`, declared in `boot(config)` **or discovered at eager from section metadata**
  (PR #17's idea, vendor-neutral key). Discovery and config merge; duplicates are a diagnosed reject (existing 033 rule).
- **Pros:** the *proposition* crosses the vendor boundary untranslated (ids, `scope`, `scopeDetails`, items are alloy's
  bytes), so notifications can carry the original `scopeDetails`; marketers keep Target/AJO authoring, developers only
  declare where content may land; one schema, one registry and one exposure/notification path serve all three providers,
  with two apply regimes (`source`, `dom`).
- **What airlock does own:** the render itself and its bookkeeping. Airlock does **not** call alloy's
  `applyPropositions` (the worker alloy is `renderDecisions:false` and the mirror has no `querySelector`, ADR-0014); it
  applies on the main thread, tracks `renderAttempted` per item, and hands the rendered/suppressed sets back to the worker,
  which emits `propositionDisplay` / `SuppressDisplay` through alloy's documented **manual-render notification** flow
  (`sendEvent` with `_experience.decisioning.propositions[…]` + `propositionEventType`). Reporting exactness therefore
  rests on airlock's bookkeeping being faithful — a rig target (ids in == ids notified), not a property inherited from alloy.
- **Cons:** the internal contract tracks a vendor schema (mitigated: it is Adobe's public, versioned XDM decisioning
  schema, also emitted by the Server API); aem-experimentation's non-HTML outputs (redirect, audiences-only) need explicit
  item mappings.

### Option C: DOM-only discovery (PR #17 as-is), no config registry
- **Pros:** zero config; marketers/authors own it.
- **Cons:** single-shot scan; no reserve geometry, budget or cache policy per placement; nothing to hand the eager applier
  before the DOM is authored; no place for `prehideSelector`.

### Sub-decision 1 — aem-experimentation: host or subsume?
- **Host as the tier-1 local provider, unmodified (chosen).** The plugin has **no decide-without-apply hook** (R-012 §2:
  no `onExperimentChosen`; its only outputs are the post-swap body/section dataset and the `aem:experimentation` event),
  and its swap is a pre-decoration source swap. So airlock does **not** route its variants through the shared applier —
  that would require forking the plugin, i.e. subsuming its apply path. Instead the plugin keeps deciding and applying in
  eager exactly as today, and airlock's **eager module** (which runs in the same eager window, *after* the plugin's
  awaited passes complete) **reads the body and section datasets + class lists** the plugin wrote (`data-experiment`/`data-variant` for
  experiments; `data-audience` for *both* audiences and campaigns — the plugin reuses that key, so the `audience-*` vs
  `campaign-*` class distinguishes them — on `body` and on each section) as the primary mechanism, normalizes each outcome into
  a `source`-phase proposition, and queues the exposure for the worker to flush at lazy boot. An `aem:experimentation`
  listener is the **secondary** path, for the plugin's asynchronous fragment-level pass (MutationObserver-driven, so it
  can dispatch after the eager module ran). What this buys, without touching the plugin: **section-level exposure**
  (005 reads `body` only) and an exposure captured earlier than 005's lazy read. What it does **not** buy: closing spec
  005's fast-bounce / differential-bias hole — that hole is an *egress-timing* loss (nothing leaves the page before
  `createAirlock` runs in `loadLazy`; the ring, `unloadFlush` and the keepalive dispatcher all live behind the lazy boot,
  and the eager chunk is build-asserted not to reach them), and earlier *capture* does not move it. Closing it would
  need a main-thread egress before the airlock exists (an eager `pagehide` → keepalive fetch), which is in tension with
  "the main thread only captures + enqueues; all egress behind the airlock" and AD-8 — **deliberately not decided here**;
  tracked as an open decision in refinement-todo. Its authoring model, forcing params and simulation UI stay.
- **Subsume (fork the decision out of the plugin so the shared applier owns the swap):** rejected for now. Revisit only
  if a `source`-phase proposition must come from a *remote* provider (tier-0 inline variants) and the plugin's swap
  cannot be reused for it.

### Sub-decision 2 — `customCode` offers
- alloy executes `customCode` by **script-element injection** (needs the page nonce). That breaks the capability model
  (ADR-0001, spec 018). **Reject by default with a loud diagnostic; per-activity allowlist opt-in** carrying the activity
  id; state the at.js-parity gap plainly in adoption docs. Alternative (execute as alloy does) rejected.

## Recommended Decision

**Option B with both sub-decisions.** The `Proposition` contract (alloy's schema + `applyPhase`) and the `Placement`
registry become pinned schemas (`contracts/`), versioned with the instrumentation config. The `dom`-phase interpreter is
main-thread (selectors and
geometry cannot resolve in the worker mirror — no `querySelector`, inert layout, ADR-0014), built on the existing
`dom-apply.js` op plumbing, `core/sanitize-html.js`, the memoized `airlock-sanitize` Trusted-Types policy and
`apply-policy.js`'s allowlist. URL-bearing attributes (`setAttribute("href")`, `setImageSource`) reopen a surface spec 018
closed on purpose and ship **only with scheme checks**. The worker alloy remains the decision/identity/notification brain;
every display, interact and suppress notification is emitted with the proposition's original `scopeDetails`.

## Consequences

**Becomes easier:**
- One schema, one registry, one exposure/notification path and one rig for Target, AJO and aem-experimentation; two
  apply regimes (`source` pre-decoration, `dom` post-decoration) that the contract names explicitly.
- Form-based and code-based experiences land via the same registry the eager reserve already reads.
- Future providers (edge-injected inline JSON, a cached decision) are just another source of the same shape.

**Becomes harder:**
- The registry is adopter-facing config surface — schema evolution is governed by ADR-0017 once it leaves the experimental
  carve-out.
- `customCode`-dependent Target activities do not run OOTB; adoption docs must say so.
- aem-experimentation upgrades must keep emitting the body/section dataset + `aem:experimentation` event airlock reads —
  the integration is event-shaped and unforked, so this is the only coupling.
- Airlock owns render bookkeeping (`renderAttempted`, suppressed sets) and must prove ids-in == ids-notified on the rig.

## Assumptions

- **A worker-side alloy will emit `decisioning.propositionDisplay` / `SuppressDisplay` with the original `scopeDetails`
  for propositions airlock rendered outside the SDK**, via the documented manual-render flow (`sendEvent` with
  `_experience.decisioning.propositions` + `propositionEventType`; Experience League "render manual propositions" +
  `mergeDecisionsMeta`, R-012 §4). **Load-bearing and not yet probed** — the minted-Edge rig (`rig/alloy-decisions.mjs`)
  can prove it before the first `dom`-phase slice ships.
- **The `metadata[scope].{selector, actionType}` shape is borrowed from alloy's `applyPropositions` for the placement
  registry; airlock does not call `applyPropositions`.** Source-read only (R-012 §4).
- **Target form-based offers and AJO `#fragment` surfaces arrive as `proposition`-type (never auto-rendered)** — from
  alloy's `getScopeType` routing (R-012 §4); consistent with the Experience League form-based tutorial.
- **aem-experimentation v2.0.0 writes the body/section datasets (and classes) synchronously inside its awaited eager
  passes, before `body.appear`**, so airlock's eager module — which the testbed loads *after* `runExperimentation`
  returns (`probes/eds-testbed/scripts/scripts.js:171-194`) — can read them as durable state; the `aem:experimentation`
  event dispatched during those passes fires **before** the eager module exists and is therefore *not* relied on for
  page/section experiments (only for the later fragment-level pass). Source-read (R-012 §2) and consistent with R-005's
  live trace (RUM exposure 78.0 ms → `appear` 79.5 ms); the dataset keys per type (`experiment`/`variant`; `audience`
  shared by audiences and campaigns, disambiguated by the `audience-*`/`campaign-*` class) and their presence on *section*
  elements must be asserted on the testbed (spec 005 grounded `body` only).

## Kill criteria

- Adobe changes the proposition schema incompatibly across Target and AJO — the contract would need a version seam.
- A customer segment cannot adopt without `customCode` — revisit the allowlist granularity, not the default.
- aem-experimentation moves its authoring model in a way that cannot be expressed as `source`-phase html/default items,
  or stops dispatching `aem:experimentation` — reopen host-vs-subsume.
- The worker alloy cannot be made to notify externally rendered propositions faithfully (rig fails) — the notification
  path moves to a direct Edge `sendEvent` shape owned by airlock, and this ADR's "notifications are alloy's" clause is
  superseded.
- The fast-bounce exposure loss proves material on a real site and an eager egress path is ruled out on principle —
  the value of hosting aem-experimentation through airlock shrinks to section-level exposure + Target/AJO routing; reopen
  whether that is worth the coupling.

## Open questions

- Vendor-neutral section-metadata key for discovered placements (PR #17 uses `mbox`; AJO users think in surfaces).
- Whether JSON offers (`json-content-item`) get a project hook or a first-class `applyJson` capability.
- Contract home: `contracts/proposition.schema.json` + `contracts/placement.schema.json`, or one file.
- **Eager exposure egress** (a `pagehide` keepalive before the airlock boots) — the only way to close spec 005's
  fast-bounce hole; tensioned with the capture-only main thread principle; decided elsewhere.
