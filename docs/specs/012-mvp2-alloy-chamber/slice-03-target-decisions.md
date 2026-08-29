---
status: DRAFT
dependencies: [012-01]
last_verified:
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
(out of the chamber, per [mvp2.md](../../releases/mvp2.md)). Serves **UC-1**
(above-the-fold personalization without flicker) for the wrapped-SDK archetype.

**DoR:**
- ✅ 012-01 DONE — alloy boots + `sendEvent` in the chamber; the intercepted-egress
  path exists.
- ✅ [`contracts/capability.d.ts`](../../../contracts/capability.d.ts) `decisions.fetch`
  is a **deferred sketch** ("finalized with the MVP2 wrapped-SDK connector") — this
  slice finalizes it **additively**.
- ✅ R-004: `renderDecisions: false` returns propositions the host applies (Target
  headless, decisions-as-data); `__view__` personalization scope present in the XDM.

**Acceptance Criteria:**

1. **Headless decisions fetched.** alloy is configured `renderDecisions: false` and its
   `sendEvent` (via the intercepted → orchestrator-dispatched egress) returns
   propositions from the (stub) Edge response. Observable: a decisions payload comes
   back for the `__view__` scope.
2. **Decisions cross the boundary as data.** The propositions are returned to the host
   through a finalized `GrantedCapabilities.decisions` return channel — **not** applied
   inside the worker (the chamber has no DOM). Observable: the worker performs no DOM
   mutation; the host receives the decisions as structured data.
3. **Host applies via the mediated CWV-safe path.** The host renders the decision only
   through the DOM-injection capability (`reserveSpace` / `insertAfterInteraction`), so
   the injection is layout-stable by construction. Observable: the applied change goes
   through the mediated helper, not a raw DOM write from a connector.
4. **Prehiding / anti-flicker stays main-thread.** The anti-flicker / prehiding snippet
   is main-thread and **out** of the chamber (mvp2.md). Observable: no prehiding logic
   runs in the worker.
5. **Exposure reported through the runtime** (UC-1's exposure half). Observable: applying
   a decision emits an exposure event through the runtime's capture path.
6. **No regressions.** GA4 + 012-01/02 paths stay green; existing pinned signatures
   byte-identical (the `decisions` surface is an **addition**).

**DoD:**
- [ ] ACs 1–6 pass; full suite green.
- [ ] Each new test shown to fail when its feature is removed.
- [ ] Reviewed by `reviewer`; **compliance + craft + arch** recorded (arch: finalizes the
      `decisions` capability surface + the host-apply wiring).
- [ ] Frame-critique recorded.
- [ ] Deviation log + reconciliation sweep; reconciliation review passed.
- [ ] `docs/refinement-todo.md` updated if any decision deferred.

**Anti-horizontal-phasing check:** after this slice, a Target personalization decision
flows alloy → chamber → host and is applied CWV-safely above the fold — UC-1 realized
for the wrapped-SDK archetype. Observable value: a rendered, exposure-reported
personalization, not an internal decisions plumbing.
