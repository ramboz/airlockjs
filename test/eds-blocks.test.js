import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  discoverBlocks,
  blockName,
  createBlockInstrumenter,
  VIEW_BLOCK_EVENT,
} from "../adapters/eds/blocks.js";
import { wireBlocks } from "../adapters/eds/index.js";

// Slice 006-01 AC1+AC2+AC5: the EDS block instrumenter discovers decorated blocks
// WITHIN <main> (by the `data-block-status` marker), associates each block's
// `{ block_name }` in a MODULE-PRIVATE WeakMap — never a `data-track-*` attribute —
// and fires exactly ONE `view_block` push the first time a block is >=50% in view
// (IntersectionObserver, threshold 0.5), then unobserves it (no scroll-out/in re-fire).
//
// Unit-tested over tiny fakes (the real-page proof is rig/uc3.mjs): a fake `main`
// whose querySelectorAll models DOM scoping, fake block elements, and a mock
// IntersectionObserver factory the test drives directly. No Worker, no network —
// this asserts DISCOVERY + ASSOCIATION + the once-per-block view GATE, not the cycle.

/** A fake decorated block element. `setAttribute` is a spy so a test can prove the
 *  instrumenter writes NOTHING to the DOM (association lives only in the WeakMap). */
function makeBlock({ name, classes = [], status = "loaded" } = {}) {
  const dataset = {};
  if (name !== undefined) dataset.blockName = name;
  if (status !== undefined) dataset.blockStatus = status;
  return { dataset, classList: classes, setAttribute: vi.fn() };
}

/** A fake <main>: its querySelectorAll models the real DOM contract that
 *  `main.querySelectorAll('[data-block-status]')` returns exactly main's decorated
 *  descendants — a block living in <header> (chrome) is NOT a descendant of main, so
 *  it can never be yielded here. That IS the frame-critique scoping. */
function makeMain(blocks) {
  return {
    querySelectorAll: vi.fn(() => blocks.filter((b) => b.dataset && "blockStatus" in b.dataset)),
  };
}

/** A mock IntersectionObserver factory the test drives. Its `fire` helper models a
 *  REAL observer: it will NOT invoke the callback for a target already unobserved
 *  (so a re-fire test genuinely proves UNOBSERVE is the once-per-block mechanism),
 *  and it derives `isIntersecting` from ratio vs the 0.5 threshold. */
function makeObserverFactory() {
  const created = [];
  const factory = vi.fn((cb, opts) => {
    const obs = {
      opts,
      observed: [],
      unobserved: [],
      observe(el) { this.observed.push(el); },
      unobserve(el) { this.unobserved.push(el); },
      disconnect() {},
      fire(el, ratio, isIntersecting = ratio >= (opts.threshold ?? 0)) {
        if (this.unobserved.includes(el)) return; // a real IO won't call back post-unobserve
        // isIntersecting defaults to ratio>=threshold, but is overridable so a test can
        // model the REAL-IO edge (isIntersecting true at a sub-0.5 ratio — the ratio
        // guard, not isIntersecting, enforces the 50% floor). craft review 006-01.
        cb([{ target: el, isIntersecting, intersectionRatio: ratio }], this);
      },
    };
    created.push(obs);
    return obs;
  });
  factory.created = created;
  return factory;
}

describe("discoverBlocks — decorated blocks WITHIN main, by data-block-status (AC1)", () => {
  it("returns exactly the elements with a data-block-status attribute, rooted at main", () => {
    const promo = makeBlock({ name: "promo" });
    const teaser = makeBlock({ name: "teaser" });
    const main = makeMain([promo, teaser]);

    expect(discoverBlocks(main)).toEqual([promo, teaser]);
    // scoping is inherent: the query is rooted at MAIN (not document) by the marker.
    expect(main.querySelectorAll).toHaveBeenCalledWith("[data-block-status]");
  });

  it("is null-safe: no main / a main without querySelectorAll -> [], never throws", () => {
    expect(discoverBlocks(null)).toEqual([]);
    expect(discoverBlocks(undefined)).toEqual([]);
    expect(discoverBlocks({})).toEqual([]);
    expect(() => discoverBlocks(null)).not.toThrow();
  });
});

describe("blockName — resolves dataset.blockName else classList[0] (AC1)", () => {
  it("prefers dataset.blockName when present (EDS decorateBlock sets it)", () => {
    expect(blockName({ dataset: { blockName: "promo" }, classList: ["bar", "block"] })).toBe("promo");
  });

  it("falls back to classList[0] when dataset.blockName is absent", () => {
    expect(blockName({ dataset: {}, classList: ["teaser", "block"] })).toBe("teaser");
  });

  it("null-safe: no element / no name resolvable -> null, never throws", () => {
    expect(blockName(null)).toBeNull();
    expect(blockName({ dataset: {}, classList: [] })).toBeNull();
    expect(() => blockName(undefined)).not.toThrow();
  });
});

describe("createBlockInstrumenter — WeakMap association, no DOM write (AC1)", () => {
  let handle;
  beforeEach(() => {
    handle = { push: vi.fn() };
  });

  it("associates each discovered block but writes NOTHING to the element (no data-track-*)", () => {
    const promo = makeBlock({ name: "promo" });
    const main = makeMain([promo]);
    const factory = makeObserverFactory();

    createBlockInstrumenter(handle, { observerFactory: factory }).instrument(main);

    // Association is invisible to the DOM: no attribute set, no dataset key added.
    expect(promo.setAttribute).not.toHaveBeenCalled();
    expect(Object.keys(promo.dataset).sort()).toEqual(["blockName", "blockStatus"]);
    // And it registered the block for viewing at the pinned 0.5 threshold.
    expect(factory).toHaveBeenCalledTimes(1);
    expect(factory.created[0].opts).toEqual({ threshold: 0.5 });
    expect(factory.created[0].observed).toEqual([promo]);
  });
});

describe("createBlockInstrumenter — view_block on first >=50% view, once (AC2)", () => {
  let handle;
  beforeEach(() => {
    handle = { push: vi.fn() };
  });

  it("fires ONE view_block with the resolved block_name on first >=50% intersection", () => {
    const promo = makeBlock({ name: "promo" });
    const main = makeMain([promo]);
    const factory = makeObserverFactory();
    createBlockInstrumenter(handle, { observerFactory: factory }).instrument(main);
    const obs = factory.created[0];

    obs.fire(promo, 0.6); // scrolled past 50%

    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({ event: VIEW_BLOCK_EVENT, block_name: "promo" });
    expect(VIEW_BLOCK_EVENT).toBe("view_block");
  });

  it("does NOT fire below the 50% threshold (isIntersecting false)", () => {
    const promo = makeBlock({ name: "promo" });
    const main = makeMain([promo]);
    const factory = makeObserverFactory();
    createBlockInstrumenter(handle, { observerFactory: factory }).instrument(main);

    factory.created[0].fire(promo, 0.3); // only 30% visible

    expect(handle.push).not.toHaveBeenCalled();
  });

  it("does NOT fire when isIntersecting is true but ratio < 0.5 (ratio guard, not isIntersecting — craft review 006-01)", () => {
    const promo = makeBlock({ name: "promo" });
    const main = makeMain([promo]);
    const factory = makeObserverFactory();
    createBlockInstrumenter(handle, { observerFactory: factory }).instrument(main);

    // The real-IO edge: geometrically intersecting (isIntersecting true) at 40% — the
    // explicit intersectionRatio>=0.5 guard, not isIntersecting, must keep this silent.
    factory.created[0].fire(promo, 0.4, true);

    expect(handle.push).not.toHaveBeenCalled();
    // and it stays observed (not unobserved), so a real 50% view later still fires:
    factory.created[0].fire(promo, 0.6);
    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("unobserves on first view -> scroll-out/in does NOT re-fire (once-per-block, AC2b)", () => {
    const promo = makeBlock({ name: "promo" });
    const main = makeMain([promo]);
    const factory = makeObserverFactory();
    createBlockInstrumenter(handle, { observerFactory: factory }).instrument(main);
    const obs = factory.created[0];

    obs.fire(promo, 0.9); // first view -> fire + unobserve
    expect(obs.unobserved).toContain(promo);
    obs.fire(promo, 0.9); // scrolled away and back: a real IO is silent post-unobserve

    expect(handle.push).toHaveBeenCalledTimes(1);
  });

  it("a block that NEVER intersects fires nothing (AC2c control)", () => {
    const promo = makeBlock({ name: "promo" });
    const teaser = makeBlock({ name: "teaser" });
    const main = makeMain([promo, teaser]);
    const factory = makeObserverFactory();
    createBlockInstrumenter(handle, { observerFactory: factory }).instrument(main);

    factory.created[0].fire(promo, 0.9); // only promo enters view

    expect(handle.push).toHaveBeenCalledTimes(1);
    expect(handle.push).toHaveBeenCalledWith({ event: VIEW_BLOCK_EVENT, block_name: "promo" });
  });
});

describe("createBlockInstrumenter — chrome (outside main) is NEVER instrumented (AC1, frame-critique)", () => {
  it("a decorated header block gets no WeakMap entry and fires no event even on a stray intersection", () => {
    const handle = { push: vi.fn() };
    const promo = makeBlock({ name: "promo" });
    // The header chrome block IS decorated (loadHeader runs decorateBlock) but lives in
    // <header>, outside <main> — so main.querySelectorAll never yields it.
    const chrome = makeBlock({ name: "header" });
    const main = makeMain([promo]); // discovery scoped to main: chrome is not a descendant
    const factory = makeObserverFactory();
    createBlockInstrumenter(handle, { observerFactory: factory }).instrument(main);
    const obs = factory.created[0];

    // It was never registered for viewing...
    expect(obs.observed).toEqual([promo]);
    expect(obs.observed).not.toContain(chrome);
    // ...and even if a stray intersection entry named it, there is no WeakMap meta -> no push.
    obs.fire(chrome, 0.99);
    expect(handle.push).not.toHaveBeenCalledWith(
      expect.objectContaining({ block_name: "header" }),
    );
  });
});

describe("createBlockInstrumenter — never throws; no observer / no main -> no-op (AC1)", () => {
  it("no observerFactory -> no-op (no IntersectionObserver available)", () => {
    const handle = { push: vi.fn() };
    const main = makeMain([makeBlock({ name: "promo" })]);
    expect(() => createBlockInstrumenter(handle, {}).instrument(main)).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
  });

  it("no main -> no-op, never throws", () => {
    const handle = { push: vi.fn() };
    const inst = createBlockInstrumenter(handle, { observerFactory: makeObserverFactory() });
    expect(() => inst.instrument(null)).not.toThrow();
    expect(() => inst.instrument(undefined)).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// wireBlocks — adapter boot wiring (deliverable 2): discover within
// document.querySelector('main'), default observerFactory = window.IntersectionObserver,
// double-wire-guarded via doc.__airlockBlocksWired, no-op off a real page / no <main>.
// ---------------------------------------------------------------------------

/** A fake IntersectionObserver constructor for the adapter seam. */
function makeFakeIO() {
  const instances = [];
  function FakeIO(cb, opts) {
    this.cb = cb;
    this.opts = opts;
    this.observed = [];
    this.unobserved = [];
    instances.push(this);
  }
  FakeIO.prototype.observe = function observe(el) { this.observed.push(el); };
  FakeIO.prototype.unobserve = function unobserve(el) { this.unobserved.push(el); };
  FakeIO.prototype.disconnect = function disconnect() {};
  FakeIO.instances = instances;
  return FakeIO;
}

/** A fake document whose querySelector('main') returns a fake main with the blocks. */
function makeBlocksDoc(blocks) {
  const main = makeMain(blocks);
  const doc = {
    querySelector: vi.fn((sel) => (sel === "main" ? main : null)),
  };
  return { doc, main };
}

describe("wireBlocks — adapter boot wiring (DI'd doc + IntersectionObserver seam)", () => {
  let handle;
  beforeEach(() => {
    handle = { push: vi.fn() };
  });

  it("instruments blocks discovered within <main> and fires view_block on a real IO intersection", () => {
    const promo = makeBlock({ name: "promo" });
    const { doc } = makeBlocksDoc([promo]);
    const FakeIO = makeFakeIO();

    wireBlocks(handle, { doc, win: { IntersectionObserver: FakeIO } });

    expect(doc.querySelector).toHaveBeenCalledWith("main");
    expect(FakeIO.instances).toHaveLength(1);
    expect(FakeIO.instances[0].observed).toEqual([promo]);
    expect(FakeIO.instances[0].opts).toEqual({ threshold: 0.5 });

    // Drive the observer callback as the browser would at >=50% visibility.
    FakeIO.instances[0].cb(
      [{ target: promo, isIntersecting: true, intersectionRatio: 0.7 }],
      FakeIO.instances[0],
    );
    expect(handle.push).toHaveBeenCalledWith({ event: VIEW_BLOCK_EVENT, block_name: "promo" });
  });

  it("is double-wire-guarded: a second wireBlocks does NOT re-instrument (doc.__airlockBlocksWired)", () => {
    const promo = makeBlock({ name: "promo" });
    const { doc } = makeBlocksDoc([promo]);
    const FakeIO = makeFakeIO();

    wireBlocks(handle, { doc, win: { IntersectionObserver: FakeIO } });
    wireBlocks(handle, { doc, win: { IntersectionObserver: FakeIO } }); // second boot: no-op

    expect(FakeIO.instances).toHaveLength(1); // not a second observer
    expect(FakeIO.instances[0].observed).toEqual([promo]); // not re-observed
  });

  it("no <main> -> no-op, never throws (chrome-only page)", () => {
    const doc = { querySelector: vi.fn(() => null) };
    const FakeIO = makeFakeIO();
    expect(() => wireBlocks(handle, { doc, win: { IntersectionObserver: FakeIO } })).not.toThrow();
    expect(FakeIO.instances).toHaveLength(0);
    expect(handle.push).not.toHaveBeenCalled();
  });

  it("no IntersectionObserver available -> no-op, never throws", () => {
    const { doc } = makeBlocksDoc([makeBlock({ name: "promo" })]);
    expect(() => wireBlocks(handle, { doc, win: {} })).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
  });

  it("no DOM (node/SSR) -> no-op, never throws", () => {
    expect(() => wireBlocks(handle, {})).not.toThrow();
    expect(handle.push).not.toHaveBeenCalled();
  });
});
