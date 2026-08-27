---
status: READY_FOR_IMPLEMENTATION
kind: feature
dependencies: [004-04]
last_verified:
arch_review: true
frame_review: true
---

## Slice 006-01 — block instrumenter → `view_block` GA4

**Goal:** on the testbed, a decorated EDS block is instrumented **without markup
changes** (metadata in a `WeakMap`, no `data-track-*`) and reports a single
MP-conformant `view_block` GA4 event when it enters the viewport — closing the UC-3
demo against the pinned decoration→event contract (spec Overview).

**DoR:**
- ✅ 004-04 done (runtime + `push()` + GA4 mapping on the real testbed).
- ✅ The decoration→event contract table is pinned in the spec Overview.

**Acceptance Criteria:**

1. **Block discovery by marker, scoped to `main`, metadata in a `WeakMap`.** The
   instrumenter finds decorated blocks by `data-block-status` **within `<main>`
   only** — the header/footer chrome blocks (decorated by `loadHeader`/`loadFooter`
   outside `main`) are **never** instrumented (assert: a decorated block in
   `<header>` gets no WeakMap entry and fires no event — frame-critique 006-01).
   `block_name` resolved from the element; `{ block_name }` stored in a
   `WeakMap<Element, meta>` — **no `data-track-*` attribute is written** (assert the
   element gains no tracking attribute), and the association is not readable from the
   DOM. Independent of whether the block's JS module loaded (404 tolerated).
2. **`view_block` on first view — scroll-triggered, once, and never for off-screen.**
   An `IntersectionObserver` fires **once** per block on first ≥50% visibility →
   `push({ event: "view_block", block_name })`. Three behaviors, each observable:
   (a) a below-the-fold block fires **only after scrolling into view** (NOT at load);
   (b) scrolled out and back in → no re-fire (once-per-block);
   (c) the never-in-view control block fires **nothing**.
3. **MP-conformant payload.** The `view_block` body validates against
   `contracts/ga4-mp-request.schema.json` with `block_name` a string param (golden
   fixture pins name + params). Hermetic (`ga4_mp_conformance`).
4. **Staged demo on the real page.** The testbed gains a below-the-fold demo block
   (+ page height so it starts off-screen) and a never-in-view control block; the
   full path — decorate → WeakMap-associate → **scroll** into view → `view_block`
   beacon — runs on the real `index.html` under the boilerplate CSP (rig, egress
   stubbed), asserting: no `view_block` before scroll, exactly one after, none for
   the control, none for header/footer chrome.
5. **Contract fidelity.** The implemented mapping matches the pinned table exactly:
   decoration = association only (no event); first view = one `view_block { block_name }`;
   interaction is NOT emitted (deferred row). No event the table does not list.

**DoD:**
- [ ] ACs 1–5 pass; unit tests cover discovery + WeakMap association (no DOM
      attribute written), the once-per-block IntersectionObserver gate (mocked
      observer), and `view_block` conformance (schema + golden). Each new test shown
      capable of failing.
- [ ] A rig (`npm run rig:uc3`) drives the real testbed page and asserts, in order:
      no `view_block` before scroll; after scrolling the demo block into view exactly
      one conformant `view_block` with the right `block_name`; scroll away and back →
      still one; nothing for the never-in-view control; nothing for header/footer
      chrome. Reproducible.
- [ ] Reviewed by `reviewer` subagent (frame-critique + compliance + craft + arch);
      implementation review passed.
- [ ] Deviation log + reconciliation sweep; spec 006 Findings + Outcome filled; mvp1
      release plan's UC-3 row updated.

**Anti-horizontal-phasing check:** after this slice, an EDS developer gets a decorated
block instrumented — a `view_block` GA4 beacon on view — **without touching markup**,
associations held in a WeakMap: the whole UC-3 loop, end to end.