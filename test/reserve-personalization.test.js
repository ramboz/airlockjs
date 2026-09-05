// reservePersonalization — spec 033-03 AC2: the SYNCHRONOUS eager reserve
// entrypoint (the no-flicker fix). A SEPARATE lightweight module — NOT exported
// from eds.js — so an eager `import()` BEFORE paint pulls only createDomCapability
// + a placement parser onto the critical path, never the full runtime
// (createAirlock + every connector + web-vitals). It parses the alloy connector's
// `__view__` placement from the boot config and SYNCHRONOUSLY initiates the
// reserve (reserveSpace sizes the box before its handle Promise resolves), handing
// the reserve HANDLE PROMISE(s) back as `{ reservedPlacements: { "__view__": <p> } }`
// for the lazy `boot(config, { reservedPlacements })` to fill (AC3).
//
// No real DOM in node/vitest — a fake document (a `style` bag + setAttribute) drives
// the same reserveSpace sizing path; the real reserve<appear + geometry proof runs in
// the browser rig (rig/alloy-decisions.mjs).
import { describe, it, expect } from "vitest";
import { reservePersonalization } from "../adapters/eds/reserve-personalization.js";
import { parseViewPlacement, VIEW_SCOPE } from "../adapters/eds/placements.js";
import { RESERVED_ATTR } from "../adapters/eds/dom.js";

function makeFakeDoc({ present = true } = {}) {
  const el = {
    style: {},
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = v; },
    getAttribute(k) { return k in this._attrs ? this._attrs[k] : null; },
  };
  return { el, querySelector: () => (present ? el : null) };
}

const alloyPlacementConfig = (placement = { scope: VIEW_SCOPE, selector: "#hero", minHeight: 300, prehide: true, timeout: 5000 }) => ({
  connectors: [{ type: "alloy", bundleUrl: "/x.js", datastreamId: "ds", placements: [placement] }],
});

describe("parseViewPlacement (spec 033-03 AC2)", () => {
  it("extracts the alloy __view__ placement into a reserveSpace spec", () => {
    const spec = parseViewPlacement(alloyPlacementConfig());
    expect(spec).toMatchObject({ scope: "__view__", selector: "#hero", minHeight: 300, prehide: true, timeout: 5000 });
  });

  it("returns null when the config has no alloy connector", () => {
    expect(parseViewPlacement({ connectors: [{ type: "ga4" }] })).toBeNull();
  });

  it("returns null when the alloy connector declares no placements", () => {
    expect(parseViewPlacement({ connectors: [{ type: "alloy", bundleUrl: "/x", datastreamId: "d" }] })).toBeNull();
  });

  it("returns null when there is no __view__ placement (only some other scope)", () => {
    expect(parseViewPlacement(alloyPlacementConfig({ scope: "not-view", selector: "#x", minHeight: 10 }))).toBeNull();
  });
});

describe("reservePersonalization (spec 033-03 AC2)", () => {
  it("SYNCHRONOUSLY sizes the reserved box (before the handle Promise resolves) — the pre-paint reserve", () => {
    const doc = makeFakeDoc();
    // Sizing must have happened by the time this synchronous call returns — i.e. before any await,
    // which in loadEager is before body.appear (the no-flicker invariant, AC2).
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
