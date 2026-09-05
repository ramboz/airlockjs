// reservePersonalization — spec 033-03 AC2 (the SYNCHRONOUS eager reserve
// entrypoint, the no-flicker fix) + spec 034-02 AC4 (N placements, one box per
// scope). A SEPARATE lightweight module — NOT exported from eds.js — so an eager
// `import()` BEFORE paint pulls only createDomCapability + a placement parser onto
// the critical path, never the full runtime (createAirlock + every connector +
// web-vitals). It parses the alloy connector's placements from the boot config and
// SYNCHRONOUSLY initiates the reserve of EACH box (reserveSpace sizes the box before
// its handle Promise resolves), handing the reserve HANDLE PROMISE(s) back as
// `{ reservedPlacements: { "<scope>": <p> } }` for the lazy
// `boot(config, { reservedPlacements })` to fill (AC3).
//
// No real DOM in node/vitest — a fake document (a `style` bag + setAttribute) drives
// the same reserveSpace sizing path; the real reserve<appear + geometry proof runs in
// the browser rig (rig/alloy-decisions.mjs).
import { describe, it, expect } from "vitest";
import { reservePersonalization } from "../adapters/eds/reserve-personalization.js";
import { parsePlacements, firstDuplicateScope, VIEW_SCOPE } from "../adapters/eds/placements.js";
import { RESERVED_ATTR } from "../adapters/eds/dom.js";

function makeEl() {
  return {
    style: {},
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
  };
}

function makeFakeDoc({ present = true } = {}) {
  const el = makeEl();
  return { el, querySelector: () => (present ? el : null) };
}

// A doc that maps selector -> element, so N placements reserve DISTINCT boxes.
function makeMultiDoc(present = { "#hero": true, "#recs": true }) {
  const els = {};
  for (const sel of Object.keys(present)) if (present[sel]) els[sel] = makeEl();
  return { els, querySelector: (sel) => els[sel] || null };
}

const alloyPlacementConfig = (placement = { scope: VIEW_SCOPE, selector: "#hero", minHeight: 300, prehide: true, timeout: 5000 }) => ({
  connectors: [{ type: "alloy", bundleUrl: "/x.js", datastreamId: "ds", placements: [placement] }],
});

const multiPlacementConfig = () => ({
  connectors: [{ type: "alloy", bundleUrl: "/x.js", datastreamId: "ds", placements: [
    { scope: VIEW_SCOPE, selector: "#hero", minHeight: 300, prehide: true },
    { scope: "products", selector: "#recs", minHeight: 200 },
  ] }],
});

describe("parsePlacements (spec 033-03 AC2 / 034-02 AC3)", () => {
  it("extracts a single __view__ placement into a reserveSpace spec (back-compat)", () => {
    const specs = parsePlacements(alloyPlacementConfig());
    expect(specs).toHaveLength(1);
    expect(specs[0]).toMatchObject({ scope: "__view__", selector: "#hero", minHeight: 300, prehide: true, timeout: 5000 });
  });

  it("parses N placements of ARBITRARY scopes (034-02), in order", () => {
    const specs = parsePlacements(multiPlacementConfig());
    expect(specs.map((s) => s.scope)).toEqual(["__view__", "products"]);
    expect(specs[1]).toMatchObject({ scope: "products", selector: "#recs", minHeight: 200 });
  });

  it("accepts a non-__view__ scope now — multi-scope is no longer deferred (034-02)", () => {
    const specs = parsePlacements(alloyPlacementConfig({ scope: "products", selector: "#x", minHeight: 10 }));
    expect(specs).toHaveLength(1);
    expect(specs[0].scope).toBe("products");
  });

  it("returns [] when the config has no alloy connector", () => {
    expect(parsePlacements({ connectors: [{ type: "ga4" }] })).toEqual([]);
  });

  it("returns [] when the alloy connector declares no placements", () => {
    expect(parsePlacements({ connectors: [{ type: "alloy", bundleUrl: "/x", datastreamId: "d" }] })).toEqual([]);
  });

  it("skips a placement with a missing/blank selector (the lazy boot validator rejects it loudly)", () => {
    const specs = parsePlacements(alloyPlacementConfig({ scope: "products", minHeight: 10 }));
    expect(specs).toEqual([]);
  });
});

describe("firstDuplicateScope (034-02 AC3 — the duplicate-scope guard)", () => {
  it("returns the first scope that appears more than once", () => {
    expect(firstDuplicateScope([{ scope: "__view__" }, { scope: "products" }, { scope: "__view__" }])).toBe("__view__");
  });

  it("returns null when every scope is distinct", () => {
    expect(firstDuplicateScope([{ scope: "__view__" }, { scope: "products" }])).toBeNull();
  });

  it("is null-safe on garbage / empty input", () => {
    expect(firstDuplicateScope(undefined)).toBeNull();
    expect(firstDuplicateScope([])).toBeNull();
    expect(firstDuplicateScope([null, {}, { scope: "x" }])).toBeNull();
  });
});

describe("reservePersonalization — single __view__ (spec 033-03 AC2)", () => {
  it("SYNCHRONOUSLY sizes the reserved box (before the handle Promise resolves) — the pre-paint reserve", () => {
    const doc = makeFakeDoc();
    const out = reservePersonalization(alloyPlacementConfig(), { document: doc });
    expect(doc.el.style.minHeight).toBe("300px"); // sized SYNCHRONOUSLY
    expect(doc.el.getAttribute(RESERVED_ATTR)).toBeTruthy(); // stamped the mediated marker
    expect(out.reservedPlacements).toBeTruthy();
    expect(out.reservedPlacements[VIEW_SCOPE]).toBeInstanceOf(Promise);
  });

  it("hands off a handle promise that resolves to a fillable reserve handle", async () => {
    const doc = makeFakeDoc();
    const { reservedPlacements } = reservePersonalization(alloyPlacementConfig(), { document: doc });
    const handle = await reservedPlacements[VIEW_SCOPE];
    expect(typeof handle.fill).toBe("function");
    expect(typeof handle.release).toBe("function");
  });

  it("returns EMPTY reservedPlacements (no reserve) when the config declares no personalization", () => {
    const doc = makeFakeDoc();
    const { reservedPlacements } = reservePersonalization({ connectors: [{ type: "ga4" }] }, { document: doc });
    expect(reservedPlacements).toEqual({});
    expect(doc.el.style.minHeight).toBeUndefined(); // nothing reserved
  });

  it("does NOT throw synchronously when the selector matches nothing — the handle promise rejects instead (drop path)", async () => {
    const doc = makeFakeDoc({ present: false }); // querySelector returns null
    let out;
    expect(() => { out = reservePersonalization(alloyPlacementConfig(), { document: doc }); }).not.toThrow();
    await expect(out.reservedPlacements[VIEW_SCOPE]).rejects.toThrow(/matched nothing/i);
  });

  it("no-op (empty reservedPlacements) when there is no document at all (node/SSR)", () => {
    const { reservedPlacements } = reservePersonalization(alloyPlacementConfig(), { document: undefined });
    expect(reservedPlacements).toEqual({});
  });
});

describe("reservePersonalization — N placements (spec 034-02 AC4)", () => {
  it("reserves EACH placement box synchronously (pre-paint) → reservedPlacements keyed by scope, all N", () => {
    const doc = makeMultiDoc();
    const out = reservePersonalization(multiPlacementConfig(), { document: doc });
    expect(Object.keys(out.reservedPlacements).sort()).toEqual(["__view__", "products"]);
    // Each box is sized SYNCHRONOUSLY (pre-paint), each at its own minHeight.
    expect(doc.els["#hero"].style.minHeight).toBe("300px");
    expect(doc.els["#recs"].style.minHeight).toBe("200px");
    expect(doc.els["#hero"].getAttribute(RESERVED_ATTR)).toBeTruthy();
    expect(doc.els["#recs"].getAttribute(RESERVED_ATTR)).toBeTruthy();
  });

  it("hands off a fillable handle per scope", async () => {
    const doc = makeMultiDoc();
    const { reservedPlacements } = reservePersonalization(multiPlacementConfig(), { document: doc });
    const v = await reservedPlacements[VIEW_SCOPE];
    const p = await reservedPlacements.products;
    expect(typeof v.fill).toBe("function");
    expect(typeof p.fill).toBe("function");
  });

  it("a scope whose selector matches nothing rejects ONLY that handle — the OTHER box still reserves (drop path is per-scope)", async () => {
    const doc = makeMultiDoc({ "#hero": true, "#recs": false }); // #recs matches nothing
    const { reservedPlacements } = reservePersonalization(multiPlacementConfig(), { document: doc });
    await expect(reservedPlacements[VIEW_SCOPE]).resolves.toBeTruthy(); // #hero reserved
    await expect(reservedPlacements.products).rejects.toThrow(/matched nothing/i); // #recs dropped
  });

  it("DUPLICATE scopes → reserves NOTHING (defers to the loud boot rejection; never throws in the eager window)", () => {
    const doc = makeMultiDoc({ "#hero": true, "#other": true });
    const dupConfig = { connectors: [{ type: "alloy", bundleUrl: "/x", datastreamId: "d", placements: [
      { scope: VIEW_SCOPE, selector: "#hero", minHeight: 300 },
      { scope: VIEW_SCOPE, selector: "#other", minHeight: 100 },
    ] }] };
    let out;
    expect(() => { out = reservePersonalization(dupConfig, { document: doc }); }).not.toThrow();
    expect(out.reservedPlacements).toEqual({});
    expect(doc.els["#hero"].style.minHeight).toBeUndefined(); // nothing reserved — the boot rejects it
  });
});
