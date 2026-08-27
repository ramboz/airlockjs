---
status: DONE
kind: feature
dependencies: [004-04]
last_verified: 2026-08-27
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
- [x] ACs 1–5 pass; unit tests cover discovery + WeakMap association (no DOM
      attribute written — setAttribute spy), the once-per-block IntersectionObserver
      gate (mocked observer, incl. the ratio-guard edge), and `view_block` conformance
      (schema + golden). 119/119 vitest (23 new); each new test red-first.
- [x] `npm run rig:uc3` drives the real testbed page and asserts, in order: no
      `view_block` before scroll; after scrolling the demo block into view exactly one
      conformant `view_block { block_name: "promo" }`; scroll away and back → still
      one; nothing for the never-in-view `teaser` control; nothing for header/footer
      chrome (`view_block_beacons_seen: ["promo"]`). Reproducible.
- [x] Reviewed by `reviewer` subagent: frame-critique FAIL→revise→PASS (caught the
      chrome-over-capture + unstageable-scroll flaws); compliance PASS; craft PASS;
      arch PASS. Evidence in `reviews/slice-01-*.md`.
- [x] Deviation log + reconciliation sweep (below); spec 006 Findings + Outcome
      filled; mvp1 release plan's UC-3 row updated.

### Deviation log

1. **Frame-critique FAIL→revise→PASS (two demo-breaking flaws caught pre-code):**
   (a) unscoped `data-block-status` discovery would instrument the always-present
   header/footer **chrome** blocks (fired on load, breaking the single-beacon oracle)
   — fixed by scoping discovery to `<main>` (load-bearing, with an assertable
   negative: a decorated `<header>` block gets no WeakMap entry / no event); (b) the
   sub-viewport testbed made the scroll-trigger unstageable — fixed by staging a
   below-the-fold demo block (`.promo`, ~1713px) + spacer height + a never-in-view
   control (`.teaser`, ~3872px). Both verified against `aem.js`/`scripts.js`.
2. **Review nits folded at reconciliation:**
   - **Explicit `intersectionRatio >= 0.5` guard** (craft): the view gate keyed only
     on `entry.isIntersecting`, which per the IntersectionObserver spec is geometric
     intersection, not a ratio threshold — the comment over-claimed. The ratio guard
     now enforces AC2's 50% floor exactly and self-documents it. A new test drives the
     real-IO edge (isIntersecting true at ratio 0.4 → no fire) via a decoupled mock;
     mutation-verified (removing the guard → red).
   - **`architecture.md` WeakMap-ownership clarified** (arch): the orchestrator's
     WeakMap holds projection / cross-airlock associations; an adapter may keep a
     transient module-local element→lookup WeakMap (e.g. `blocks.js` block_name) that
     deliberately does not enter vendor-neutral `core/` — the arch decision this slice
     made.
   - Deferred (deviation notes, tied to the parked once-per-page boot / OQ12 item 4):
     the module-global `metaMap` vs `wireExposure`'s per-boot `Set()` lifetime
     asymmetry, and `wireBlocks` setting its `__airlockBlocksWired` guard flag after
     (not before) the no-main early return — both harmless under once-per-page boot,
     to resolve together when that limit is lifted. The observer is never
     `disconnect`ed (observe-until-seen; consistent with the no-teardown posture). A
     minor `VIEW_BLOCK_EVENT` name-pin overlap between the behavioral + conformance
     tests is a defensible independent tripwire.

### Reconciliation sweep

| Artifact | Disposition | Rationale |
|----------|-------------|-----------|
| `docs/specs/006-uc3-block-decoration/spec.md` | `updated` | Findings + Outcome filled (spec 006 closes with this slice). |
| `docs/specs/README.md` | `deferred` | Generated board; regenerated by `workflow.py status-board` at the DONE landing (006-01 → DONE). |
| `docs/releases/mvp1.md` | `updated` | UC-3 row → demo landed (the MVP1 demo trio complete). |
| `docs/architecture.md` | `updated` | WeakMap-ownership clarification (arch review) — orchestrator vs adapter-local associations. |
| `contracts/validate.mjs` + `contracts/fixtures/` | `updated` | New `view_block` golden registered in `mustPass` (validate green); no schema change. |
| `adapters/eds/index.js` + `adapters/eds/blocks.js` | `updated` | The block instrumenter seam (`wireBlocks` + instrumenter); core/ + connectors/ga4/map.js untouched. |
| `test/eds-blocks.test.js` + `test/uc3-conformance.test.js` + `rig/uc3.mjs` | `updated` | New implementation deliverables (23 new unit tests + the real-page rig); not drift-prone doc surfaces. |
| `probes/eds-testbed/index.html` | `updated` | Staged demo `.promo` (below-fold) + `.teaser` (never-in-view) blocks + spacer height (frame-critique). |
| `docs/product-vision.md` | `no-op` | Realizes UC-3's "no data-track-* clutter, WeakMap associations" as the vision states; no scope drift. |
| `docs/refinement-todo.md` | `no-op` | No new deferred decision; the sibling-lifetime/guard notes ride the existing OQ12 item 4 (dispose guard). |
| Primer surfaces (`CLAUDE.md`) | `no-op` | Spec 006 not in the Active-specs list; board reflects closure. |
| `docs/inbox.md` / `docs/memory/**` / ADR index | `no-op` | Nothing to park; no new ADR (main-scoping is frame-critique rationale; mapping reuses ADR-0002/3/4). |
| `package.json` | `updated` | Added the `rig:uc3` script (`.gitignore` unchanged — `rig/out/` was already ignored by 005). |

**Anti-horizontal-phasing check:** after this slice, an EDS developer gets a decorated
block instrumented — a `view_block` GA4 beacon on view — **without touching markup**,
associations held in a WeakMap: the whole UC-3 loop, end to end.