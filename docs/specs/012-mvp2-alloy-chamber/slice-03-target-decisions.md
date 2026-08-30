---
status: DONE
dependencies: [012-01]
last_verified: 2026-08-29
frame_review: true
arch_review: true
---

<!-- jig grounding (spec 064-02 / ADR-0020): ground factual claims about
     runnable surfaces by probe first (run it / read source) or a citation. -->

## Slice 012-03 — Target personalization, decisions-as-data (headless)

**Goal:** Run alloy **Target** personalization inside the chamber in **headless**
mode (`renderDecisions: false`, [R-004](../../research/R-004-alloy-in-worker.md)):
alloy fetches decisions from the Edge and returns them as **data** (propositions)
across the chamber boundary; the **host** applies them through the mediated,
CWV-safe DOM-injection capability, with prehiding / anti-flicker kept **main-thread**
(out of the chamber, per [mvp2.md](../../releases/mvp2.md)). **This slice also BUILDS
that capability** (owner decision 2026-08-29): the AD-5 CWV-safe DOM-injection path
(`reserveSpace`) is *declared* in `capability.d.ts` but **implemented nowhere** today —
012-03 implements **`reserveSpace`** (layout-stable by construction — content fills a box
reserved *before paint*, so nothing around it reflows) so the host applies the decision
without reflowing the page, plus the main-thread prehiding / anti-flicker.
(`insertAfterInteraction` stays declared-not-built — no consumer in this slice.) So 012-03 delivers **two** things: the **decisions-as-data channel**
(alloy-specific, the wrapped-SDK generalization) *and* the **CWV-safe injection
capability** (the general AD-5 path all host-applied content will use; alloy's decisions
are its first consumer). Serves **UC-1** (above-the-fold personalization without
flicker).

**DoR:**
- ✅ 012-01 DONE — alloy boots + `sendEvent` in the chamber; the intercepted-egress
  path exists.
- ✅ [`contracts/capability.d.ts`](../../../contracts/capability.d.ts) `decisions.fetch`
  is a **deferred sketch** ("finalized with the MVP2 wrapped-SDK connector") — this
  slice finalizes it **additively**.
- ✅ R-004: `renderDecisions: false` returns propositions the host applies (Target
  headless, decisions-as-data); `__view__` personalization scope present in the XDM.
- ✅ [`contracts/capability.d.ts`](../../../contracts/capability.d.ts) declares the AD-5
  DOM-injection surface (`reserveSpace(spec): Promise<DomHandle>` / `insertAfterInteraction`)
  + its `ReserveSpaceSpec` / `DomHandle` shapes — but **no implementation exists** (grep
  `adapters/` / `core/` / `connectors/` = 0 hits). This slice **builds** `reserveSpace`.
- ⚠️ **CWV-safety is gated by a structural invariant, not headless CLS numbers** (AC3):
  the repo's own UC-1 proof (`rig/uc1.mjs` + R-005) deliberately avoids quantitative
  headless layout/paint measurement as unreliable (it gates on a structural ordering
  invariant + human screenshot); `rig/cwv-budget.mjs`→`lh-eds.mjs` is only a whole-page,
  advisory, non-gating Lighthouse CLS *delta* (can't attribute to one injection);
  `observeLayoutShifts` is a vision primitive **not yet implemented** in-repo.

**Acceptance Criteria:**

1. **Headless decisions fetched.** alloy is configured `renderDecisions: false` and its
   `sendEvent` (via the intercepted → orchestrator-dispatched egress) returns
   propositions from the (stub) Edge response. Observable: a decisions payload comes
   back for the `__view__` scope.
2. **Decisions cross the boundary as data.** The propositions are returned to the host
   through a finalized `GrantedCapabilities.decisions` return channel — **not** applied
   inside the worker (the chamber has no DOM). Finalizing the deferred sketch **reconciles**
   the declared `decisions.fetch(scopes)` *pull* shape with alloy's actual
   *push-from-`sendEvent`-response* flow (the propositions arrive on the `interact`
   response, not a separate fetch) — in-scope for "finalize the sketch," and additive.
   Observable: the worker performs no DOM mutation; the host receives the decisions as
   structured data.
3. **Build + apply through the CWV-safe DOM-injection capability (`reserveSpace`).**
   Implement the AD-5 `reserveSpace(spec): Promise<DomHandle>` — it reserves the layout box
   **before paint**, and the decision content fills the **pre-reserved** box, so surrounding
   content never reflows. The host renders the decision **only** through this capability,
   never a raw DOM write. **Scope:** build **`reserveSpace`** (the above-the-fold path UC-1
   needs); `insertAfterInteraction` stays **declared-not-built** — it has no
   deferred-injection consumer in this slice (defer to a slice that has one; avoid
   speculative generality). Observable, **gated on a deterministic by-construction
   structural invariant** the harness can prove (the analog of `rig/uc1.mjs`'s
   applied-before-paint invariant — per R-005, quantitative headless CLS/paint numbers are
   unreliable, which is why the repo's UC-1 proof gates structurally + human screenshot,
   not on a CLS number; geometry via `getBoundingClientRect` **is** deterministic in
   headless, unlike paint *timestamps*). **The reserve _spec_ (selector + `minHeight`) is
   eager / config-sourced — decoupled from the lazy, async decision** (airlock boots lazy,
   AD-8; the Target decision arrives *after* first paint), so the box is reserved before
   paint and the decision merely *fills* it later. Three gated legs:
   - (a) the applied personalization goes through the mediated helper, never a raw DOM write;
   - (b) the reserved box's geometry **and the position of surrounding content** is
     **unchanged** between reserve-time and insert-time (the decision fills the reserved
     space → no reflow);
   - (c) **the box is reserved before `body:appear`** (the true `uc1.mjs`
     applied-before-paint leg) — so a *post-paint* reserve that shifts content at
     reserve-time (which would satisfy (a)+(b) yet flicker) is **caught**, not green-lit.

   Quantitative CLS (`rig/cwv-budget.mjs` whole-page delta) + a raw-un-reserved-inject
   control + a human screenshot are **advisory/corroborating** (OQ6), **not** the gate —
   honest that a headless raw inject may not itself score a measurable CLS.
4. **Prehiding / anti-flicker stays main-thread.** The anti-flicker / prehiding snippet
   is main-thread and **out** of the chamber (mvp2.md). Observable: no prehiding logic
   runs in the worker.
5. **Exposure reported through the runtime** (UC-1's exposure half) — via the **generic**
   `handle.push` → ring → beacon capture runtime, with a **new alloy-proposition → exposure
   mapping** (a `propositionDisplay`-style event; **additive**). Note: `adapters/eds/exposure.js`
   reads aem-experimentation's `body[data-experiment]`/`[data-variant]` + `aem:experimentation`,
   which an alloy Target **proposition** (`scope`/`content`) does **not** populate — so the
   generic capture runtime is reused, but a new proposition→exposure mapping is required
   (don't assume `exposure.js` fits). Observable: applying a decision emits an exposure
   event through the generic capture path.
6. **No regressions.** GA4 + 012-01/02 paths stay green; existing pinned signatures
   byte-identical (the `decisions` surface is an **addition**).

**DoD:**
- [x] ACs 1–6 pass; full suite green. *296 vitest + `rig:alloy-decisions` (AC1–5 + the
      three AC3 legs, chromium); `rig:alloy` + `rig:alloy-coalescing` still green.*
- [x] Each new test shown to fail when its feature is removed *(scope filter, prehide,
      exposure event-name, the AC3 gate — post-paint reserve → `pass:false`).*
- [x] Reviewed by `reviewer`; **compliance + craft + arch** recorded — all pass
      (`reviews/slice-03-{compliance,craft,arch}.md`). *Craft nit (querySelector
      error-contract) fixed; arch/craft follow-ups tracked.*
- [x] Frame-critique recorded (2 rounds + a re-scope + the leg-(c) tightening)
      (`reviews/slice-03-frame-critique.md`).
- [x] Deviation log + reconciliation sweep produced (below); reconciliation review
      recorded.
- [x] `docs/refinement-todo.md` updated — 012-03 tracked debt (f)–(k): `decisions.fetch`
      not-built-loud, overflow-clip hardening, eager-phase wiring, shared proposition
      accessor, DOM-writer invariant, and the `innerHTML` sanitizer/TT trust boundary.

**Anti-horizontal-phasing check:** after this slice, a Target personalization decision
flows alloy → chamber → host and is applied CWV-safely above the fold — UC-1 realized
for the wrapped-SDK archetype. Observable value: a rendered, exposure-reported
personalization, not an internal decisions plumbing.

### Deviation log (after reconciliation)

1. **Re-scoped before implementation (owner decision 2026-08-29):** the slice originally
   assumed the DOM-injection capability existed; it does **not** (declared in
   `capability.d.ts`, implemented nowhere). Owner chose to **build the full capability**
   here, not just the decisions channel. Re-scoped + frame-critiqued (2 rounds).
2. **CWV-safety gated by a structural invariant, not headless CLS** (frame-critique
   primary): `observeLayoutShifts` is unimplemented (prose-only), and headless
   quantitative CLS is unreliable (R-005); the gate is the deterministic
   `getBoundingClientRect` invariant (legs a/b/c, mirroring `rig/uc1.mjs`), with CLS +
   raw-inject control + screenshot advisory (OQ6).
3. **Scope trimmed to `reserveSpace`;** `insertAfterInteraction` left declared-not-built
   (rejects loudly) — no deferred-injection consumer in this slice (frame-critique).
4. **Exposure via the generic capture + a new proposition→exposure mapping**, not
   `adapters/eds/exposure.js` (whose aem-experimentation `body[data-experiment]` reader an
   alloy proposition doesn't populate).
5. **Craft nit fixed:** `reserveSpace`'s `querySelector` now wraps a malformed-selector
   `SyntaxError` into a `Promise.reject` (consistent error surface).
6. **Non-blocking follow-ups tracked** (refinement-todo (f)–(k)): `decisions.fetch`
   not-built-loudness + contract-stability pin; the over-tall-fill overflow-clip hardening
   (documented as the honest boundary in `dom.js`); production eager-phase `reserveSpace`
   wiring; a shared proposition accessor; the DOM-writer-invariant weight for the OQ13
   core migration; and the `innerHTML` sanitizer/TT **security trust boundary**.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `adapters/eds/dom.js` | `created` | The AD-5 `reserveSpace` CWV-safe DOM-injection capability (eager reserve + mediated `fill` + main-thread prehide); `insertAfterInteraction` declared-not-built. |
| `connectors/alloy/decisions.js` + `adapters/eds/decisions-exposure.js` | `created` | Decisions parse (pure) + the new proposition→`proposition_display` exposure mapping. |
| `rig/generic-capture.js`, `rig/alloy-decisions.*` | `created` | Generic capture helper + the two-phase (eager reserve → lazy fill) rig gating the AC3 structural invariant. |
| `test/**` (5 new) | `created` | Pure-piece coverage + the rig's falsifiable AC3 controls. |
| `connectors/alloy/{connector.js, alloy-chamber.worker.js}` | `updated` | Additive decisions delivery (`caps.decisions.deliver`); no-op when the cap isn't granted (GA4/012-01/02 unchanged). |
| `contracts/capability.d.ts` | `updated` | Finalized `decisions` surface (`+deliver`, reconciling the `fetch` pull sketch with alloy's push) + `DomHandle.fill?` — **additive**, MVP1 signatures byte-identical (contract-stability green). |
| `rig/alloy-mint-stub.js`, `package.json` | `updated` | Target-decisions Edge response + `rig:alloy-decisions` script. |
| `docs/refinement-todo.md` | `updated` | 012-03 tracked debt (f)–(k). |
| `core/**`, `connectors/ga4/` | `no-op` | Parallel-and-minimal — untouched + green (`rig:alloy`/`rig:alloy-coalescing`/GA4 pass). The DOM capability sits at the adapter layer (sibling to `cookies.js`); core migration is tracked (OQ13). |
| `docs/architecture.md` | `deferred` | The DOM-injection capability touches the "orchestrator is the only DOM-writer" invariant — tracked (debt j) for the core migration, not rewritten in a proof slice; no canon conflict. |
| `docs/specs/README.md` | `updated` | Status board regenerated. |
| Primer `CLAUDE.md` / `docs/memory/**` | `no-op` | Consistent with prior slices; result recorded in the slice + refinement-todo. |
