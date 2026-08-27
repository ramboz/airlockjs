/**
 * EDS block-decoration instrumentation (spec 006-01) — the UC-3 mechanism.
 *
 * When EDS decorates a block, `aem.js#decorateBlock` marks the element with
 * `data-block-status` and `data-block-name`. This module DISCOVERS those decorated
 * blocks, ASSOCIATES each one's `{ block_name }` in a module-private
 * `WeakMap<Element, meta>` — NOT a `data-track-*` attribute — and reports a single
 * `view_block` GA4 event the first time the block is meaningfully in view
 * (IntersectionObserver, threshold 0.5), then unobserves it (once per block).
 *
 * WHY a WeakMap, not a DOM attribute (product-vision Design principles): the
 * association is element-keyed (GC-collected with the node), invisible to the DOM and
 * to other tags — no `data-track-*` clutter, no ambient readability. The instrumenter
 * writes NOTHING to the element.
 *
 * WHY scoped to `main` (frame-critique 006-01, load-bearing): `loadHeader`/`loadFooter`
 * also run `decorateBlock` on the header/footer CHROME, which lives in
 * `<body> > header/footer` OUTSIDE `main` and always carries `data-block-status`. An
 * unscoped sweep would instrument the always-present chrome and fire spurious
 * `view_block` beacons for it (the proxied header has real height at the top of the
 * page under `aem up`). Discovery therefore takes the `main` element and queries
 * WITHIN it — a decorated block in `<header>` is not a descendant of `main`, so it is
 * never discovered, never associated, and never fires.
 *
 * Everything here is DI'd (the IntersectionObserver is injected via `observerFactory`
 * so unit tests can drive it) and null-safe — a missing observer / missing `main`
 * is a no-op, never a throw (boot must never break the page).
 */

/** The custom GA4 event name for a block-view. No standard GA4 block-view event
 *  exists; GA4 accepts custom names by design (contracts/ga4-mp.md). Pinned in the
 *  decoration->event contract table (spec 006 Overview). */
export const VIEW_BLOCK_EVENT = "view_block";

/**
 * Module-private association store: decorated element -> `{ block_name }`.
 * Element-keyed so it is GC-collected with the node and invisible to the DOM and to
 * other tags (product-vision: "WeakMap for element associations, no DOM clutter").
 * NOT exported — the association is deliberately not readable from outside this module.
 */
const metaMap = new WeakMap();

/**
 * Discover the EDS-decorated blocks WITHIN `main` — the elements EDS marked with
 * `data-block-status`. Rooted at `main` (NOT `document`): that scoping is exactly how
 * the header/footer chrome is excluded (frame-critique 006-01). Independent of
 * whether the block's JS module loaded (a 404 still leaves the decorated element).
 *
 * @param {{ querySelectorAll?: (sel: string) => Iterable<Element> }} main the `<main>` element.
 * @returns {Element[]} the decorated block elements within `main` (empty + null-safe).
 */
export function discoverBlocks(main) {
  if (!main || typeof main.querySelectorAll !== "function") return [];
  return Array.from(main.querySelectorAll("[data-block-status]"));
}

/**
 * Resolve a block's name: EDS's `dataset.blockName` (set by `decorateBlock`), else the
 * block's own first class (`classList[0]`, the EDS convention). Pure + null-safe.
 *
 * @param {{ dataset?: Record<string,string>, classList?: ArrayLike<string> }} el
 * @returns {string|null} the resolved name, or `null` when none resolves.
 */
export function blockName(el) {
  if (!el) return null;
  const fromData = el.dataset && el.dataset.blockName;
  if (fromData) return fromData;
  const cls = el.classList && el.classList[0];
  return cls || null;
}

/**
 * Create a block instrumenter over the airlock write surface. `observerFactory(cb,
 * opts)` builds the IntersectionObserver (injected so unit tests can drive the
 * callback; the adapter passes `window.IntersectionObserver`).
 *
 * @param {{ push: Function }} handle the airlock write surface (steady-state `push` —
 *   a block view is analytics-lazy, so it takes the worker cycle, not the fast path).
 * @param {{ observerFactory?: (cb: Function, opts: object) => object }} [opts]
 * @returns {{ instrument(main: object): void }}
 */
export function createBlockInstrumenter(handle, { observerFactory } = {}) {
  // One shared callback for whichever observer(s) instrument() creates. The observer
  // passes itself as the 2nd arg, so we unobserve from the RIGHT instance.
  const onIntersect = (entries, observer) => {
    for (const entry of entries || []) {
      // AC2's ">=50% visible" floor is enforced by the intersectionRatio guard, NOT by
      // `isIntersecting` alone (which per the IntersectionObserver spec tracks geometric
      // intersection, not a ratio threshold — craft review 006-01). The observer is
      // created at threshold 0.5, so a callback only queues near that boundary; the
      // explicit ratio check makes the 50% contract self-documenting and exact.
      if (!entry || !entry.isIntersecting || entry.intersectionRatio < 0.5) continue;
      const target = entry.target;
      const meta = metaMap.get(target);
      if (!meta) continue; // not one of OUR blocks (e.g. chrome) — never fire
      handle.push({ event: VIEW_BLOCK_EVENT, block_name: meta.block_name });
      // Once per block: unobserve so a scroll-out/in does not re-fire (AC2b).
      if (observer && typeof observer.unobserve === "function") observer.unobserve(target);
    }
  };

  return {
    /**
     * Instrument the decorated blocks within `main`: associate each in the WeakMap
     * (no DOM write) and register it for a first-view report at threshold 0.5. A
     * no-op when there is no observer factory, no `main`, or no blocks.
     */
    instrument(main) {
      if (typeof observerFactory !== "function") return; // no IntersectionObserver -> no-op
      const blocks = discoverBlocks(main);
      if (blocks.length === 0) return;
      const observer = observerFactory(onIntersect, { threshold: 0.5 });
      if (!observer || typeof observer.observe !== "function") return;
      for (const block of blocks) {
        metaMap.set(block, { block_name: blockName(block) }); // association: WeakMap, not the DOM
        observer.observe(block);
      }
    },
  };
}
