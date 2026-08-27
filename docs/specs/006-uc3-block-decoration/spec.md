---
status: IN_PROGRESS
skill:
use_cases: [UC-3]
---

# Spec 006: UC-3 — automatic EDS block-decoration instrumentation

> The third MVP1 demo item ([mvp1 release plan](../../releases/mvp1.md)). Builds on
> the UC-2 runtime (spec 004). **jig-supervised** — the decoration→event-mapping
> contract is pinned first, or the oracle is self-referential (release plan).

## Overview

**Goal:** on the [EDS testbed](../../../probes/eds-testbed/), an EDS developer gets
**automatic block instrumentation without touching markup** — no `data-track-*`
attributes. When a block is decorated, the airlock associates its metadata in a
**`WeakMap`** (element → `{ block_name, … }`, not the DOM) and reports a
**block-view** GA4 event when the block enters the viewport — MP-conformant, off-thread.

**What it builds** (on the UC-2 adapter + ADR-0004 egress):
- an `adapters/eds/` **block instrumenter** — discovers EDS-decorated **content**
  blocks **within `<main>`** (elements carrying `data-block-status`, the marker
  `aem.js#decorateBlock` sets), reads the block name from the element (EDS convention:
  the block's own class), and holds `{ block_name }` in a `WeakMap<Element, …>` — no
  `data-track-*` clutter, no ambient readability by other tags, GC-friendly.
  **Scoped to `main` deliberately (frame-critique 006-01):** `loadHeader`/`loadFooter`
  also run `decorateBlock` on the header/footer **chrome** (in `<body> > header/footer`,
  outside `main`) during the lazy phase, so an unscoped `data-block-status` sweep would
  instrument the always-present chrome and fire spurious `view_block` beacons for it;
- a **view trigger** — an `IntersectionObserver` fires a single `view_block` GA4 event
  the first time each instrumented block is meaningfully in view;
- the **pinned decoration→event contract** (below) so the oracle checks the block →
  event mapping, not itself;
- **testbed staging (frame-critique 006-01):** EDS has no named blocks by default and
  the page is shorter than a viewport, so the demo would fire on load (not scroll) and
  "never-in-view fires nothing" would be unstageable. This slice adds (a) a demo
  content block **below the fold** (with enough page height that it starts off-screen),
  and (b) a **never-in-view control** block — so the scroll-triggered and
  never-triggered behaviors are both actually demonstrable.

**The decoration→event-mapping contract (pinned here — release plan precondition).**
| EDS block signal | Airlock capture | GA4 event | Params |
|---|---|---|---|
| Block decorated (`data-block-status` present, **within `main`** — chrome excluded) | associate in `WeakMap` | *(none — association only)* | — |
| Block first meaningfully in view (IntersectionObserver ≥ 50%) | look up `WeakMap` | `view_block` | `block_name` (string) |
| *(future: block interaction / click)* | *(deferred)* | *(deferred)* | — |

Pinning this table BEFORE implementing is what stops the oracle from being
self-referential: the test asserts "a decorated block that enters view produces a
`view_block { block_name }` beacon", not "the code does what the code does".

**Out of scope:** block *interaction* events (deferred — the table's third row); the
event-payload governance denylist (OQ11); the live GA4 endpoint + `aem up` Lighthouse
(as UC-2 — rigs stub egress); consent gating (OQ13); UC-1.

**Oracle routing (jig-supervised).** `ga4_mp_conformance` is servo-able for the
`view_block` payload; the decoration→view→event *wiring* is jig-supervised (the
contract table is the reference the review checks against).

## Assumptions

- **EDS marks decorated blocks with `data-block-status`** (`aem.js#decorateBlock`
  sets `block.dataset.blockStatus` and `block.dataset.blockName = classList[0]`).
  The instrumenter discovers blocks by this marker **within `main` only**,
  independent of whether the block's JS module loads (a missing
  `blocks/<name>/<name>.js` 404s but the decorated element still exists).
  [Grounded in `probes/eds-testbed/scripts/aem.js` decorateBlock/loadBlock.]
- **The header/footer chrome blocks ALWAYS carry `data-block-status` too** —
  `loadHeader`/`loadFooter` (lazy phase) call `decorateBlock` on blocks living in
  `<body> > header/footer`, outside `main`; under `aem up` the proxied header has real
  height at the top of the page and would fire its own `view_block` on load. Scoping
  discovery to `main` is therefore load-bearing, not stylistic (frame-critique
  006-01). [Grounded in `scripts.js` loadHeader/loadFooter + `aem.js`.]
- **Main-content blocks are decorated in `loadEager` (before the lazy airlock boot),
  so boot-time discovery sees them** — `decorateMain` runs `decorateBlocks` in the
  eager window; the instrumenter still tolerates later-decorated content (the
  discovery runs at boot over what exists; dynamic post-boot blocks are the deferred
  third contract row's concern, not MVP1's). [Grounded in `scripts.js#loadEager`.]
- **A `WeakMap<Element, meta>` is the right association store** — element-keyed,
  GC-collected with the node, invisible to other tags and to the DOM (product-vision
  Design principles: "`WeakMap` for element associations, no DOM clutter"). [Grounded
  in product-vision + architecture Data model.]
- **`IntersectionObserver` is available and sufficient for the view trigger** — a
  standard browser API; the block-view event fires once per block on first
  ≥50%-visible intersection. [Standard API; the rig runs it in Chromium.]
- **The testbed needs a named block added AND staged below the fold** — EDS has "no
  auto blocks in the testbed" (`scripts.js#buildAutoBlocks`) and `index.html` is
  shorter than a viewport, so without staging the demo block would be ≥50% visible on
  load and `view_block` would fire trivially (never exercising the scroll trigger),
  and "never-in-view fires nothing" would be unstageable (frame-critique 006-01). The
  slice adds page height (spacer content) so the demo block starts off-screen, plus a
  second never-in-view control block; the blocks' JS-module 404s are tolerated noise,
  the decorated elements are what matter. [Grounded in the testbed README +
  index.html.]

## Decomposition

**SPIDR axis: single vertical slice.** The mechanism (WeakMap association +
IntersectionObserver view) is small and known, and the runtime foundation exists
(spec 004). UC-3's deliverable is one vertical: pin the contract → instrument a
decorated block → report its view event. A split (discovery vs view vs mapping) would
be horizontal phasing — each half delivers no observable value alone.

### Slices

1. **[006-01 — block instrumenter → view_block GA4](slice-01-instrument.md)** — pin
   the decoration→event contract, add a demo block, associate metadata in a WeakMap,
   fire `view_block` on first view, MP-conformant, on the real testbed page.

## Findings

- **Automatic block instrumentation, no markup, WeakMap-held.** On the real testbed,
  a decorated content block within `<main>` is discovered by its `data-block-status`
  marker, associated in a module-private `WeakMap<Element, { block_name }>` (no
  `data-track-*` written — setAttribute-spy tested), and reports a single MP-conformant
  `view_block { block_name }` on first ≥50% view (`npm run rig:uc3`): `.promo` (staged
  below the fold) fires exactly one `view_block` only after scrolling into view, does
  not re-fire on scroll-out/in, the never-in-view `.teaser` control fires nothing, and
  the header/footer **chrome** blocks — which ARE decorated (their JS 404s appear) —
  fire nothing, because discovery is scoped to `<main>` (`view_block_beacons_seen:
  ["promo"]`).
- **The connector generalized without change.** `view_block` (a brand-new custom
  event) required **zero** change to `connectors/ga4/map.js` — the generic
  `{ type, params }` → MP mapping absorbed it, golden-pinned in the
  `ga4_mp_conformance` oracle. `core/` untouched; the `block_name` association stays
  adapter-local (never enters the vendor-neutral projection or crosses the airlock).
- **The pinned decoration→event contract held exactly:** decoration = association
  only (no event); first view = one `view_block { block_name }`; interaction deferred.
  No event the table does not list was produced.

## Outcome

**UC-3 lands: automatic EDS block instrumentation without touching markup.** A
decorated block is instrumented via a WeakMap association (no `data-track-*` clutter,
invisible to other tags) and reports a `view_block` GA4 event on view — off-thread,
MP-conformant, `main`-scoped so the chrome is never mis-instrumented. With UC-1 and
UC-2 already landed, this **completes the MVP1 demo trio** on a real EDS page.

`Outcome: UC-3 graduated — automatic block-decoration instrumentation (WeakMap
association, no markup) reports a view_block GA4 event on ≥50% view, main-scoped
(chrome excluded), off-thread + MP-conformant; the GA4 connector absorbed the new
event with no change. ga4_mp_conformance green. Reproducible: npm run rig:uc3. MVP1
demo trio (UC-1/UC-2/UC-3) complete. Remaining MVP1: servo oracle wiring + CI
(drive-order steps 8–9); follow-ups OQ12 item 4 (dispose guard — now touches 3 boot
wirings), OQ13, live GA4 endpoint + aem-up Lighthouse.`
