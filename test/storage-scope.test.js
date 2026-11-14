// 067-12 (ADR-0062 point 7): the default localStorage/sessionStorage grant is the stock set.
// Pure pieces: resolveStorageGrant, scopeSeedStorage (core/storage-scope.js) and the chamber's
// synchronous storage shim (connectors/alloy/sync-storage.js). The test vendor fixture below
// stands in for a real vendor set (real sets arrive with 064/065/066).
import { describe, it, expect } from "vitest";
import { resolveStorageGrant, scopeSeedStorage } from "../core/storage-scope.js";
import { createSyncStorage } from "../connectors/alloy/sync-storage.js";

const STOCK = { localStorage: ["vendor_", "vtld"], sessionStorage: ["vsid"] };

function fakeStorage(obj) {
  const m = new Map(Object.entries(obj));
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i] ?? null, getItem: (k) => (m.has(k) ? m.get(k) : null) };
}

describe("resolveStorageGrant", () => {
  it("stock default: the grant is the stock set per area, not narrowed", () => {
    const g = resolveStorageGrant(STOCK, undefined);
    expect(g).toEqual({ areas: STOCK, narrowed: false, active: true });
  });

  it("an undeclared stock leaves every area ungated and inactive (today's behavior, check 8)", () => {
    for (const stock of [null, undefined]) {
      expect(resolveStorageGrant(stock, undefined)).toEqual({ areas: { localStorage: null, sessionStorage: null }, narrowed: false, active: false });
    }
  });

  it("a declared stock that omits an area grants nothing there (fail closed)", () => {
    expect(resolveStorageGrant({ localStorage: ["vtld"] }, undefined).areas).toEqual({ localStorage: ["vtld"], sessionStorage: [] });
  });

  it("narrowed opt-in: a subset replaces the area; unmentioned areas keep the stock", () => {
    const g = resolveStorageGrant(STOCK, { localStorage: ["vendor_a", "vtld"] });
    expect(g.areas).toEqual({ localStorage: ["vendor_a", "vtld"], sessionStorage: ["vsid"] });
    expect(g.narrowed).toBe(true);
  });

  it("an out-of-stock narrowing entry throws (never widens)", () => {
    expect(() => resolveStorageGrant(STOCK, { localStorage: ["other"] })).toThrow(TypeError);
    expect(() => resolveStorageGrant(STOCK, { sessionStorage: ["vendor_x"] })).toThrow(TypeError);
  });

  it("a malformed narrowing throws", () => {
    for (const bad of [["vtld"], "vtld", null, { cookies: ["a"] }, { localStorage: "vtld" }, { localStorage: [1] }]) {
      expect(() => resolveStorageGrant(STOCK, bad)).toThrow(TypeError);
    }
  });

  it("with no stock declared, a non-empty narrowing throws (it can't widen) and an empty one is inactive", () => {
    expect(() => resolveStorageGrant(null, { localStorage: ["only"] })).toThrow(/storageGrantNarrowing/);
    expect(resolveStorageGrant(null, { localStorage: [] }).active).toBe(false);
  });
});

describe("scopeSeedStorage", () => {
  const pages = () => ({
    localStorage: fakeStorage({ vendor_id: "1", vtld: "t", secret: "x" }),
    sessionStorage: fakeStorage({ vsid: "s", other: "y" }),
  });

  it("seeds only granted keys per area (exact + prefix)", () => {
    expect(scopeSeedStorage(pages(), STOCK)).toEqual({ localStorage: { vendor_id: "1", vtld: "t" }, sessionStorage: { vsid: "s" } });
  });

  it("an ungated (null) area seeds nothing: no grant means no seed", () => {
    expect(scopeSeedStorage(pages(), { localStorage: null, sessionStorage: ["vsid"] })).toEqual({ localStorage: {}, sessionStorage: { vsid: "s" } });
  });

  it("an unavailable or throwing storage seeds nothing instead of throwing", () => {
    const throwing = { get length() { throw new Error("SecurityError"); } };
    expect(scopeSeedStorage({ localStorage: throwing, sessionStorage: undefined }, STOCK)).toEqual({ localStorage: {}, sessionStorage: {} });
  });
});

describe("createSyncStorage (chamber shim)", () => {
  it("serves the seed synchronously and reports writes and removals", () => {
    const writes = [];
    const s = createSyncStorage({ vtld: "t" }, (k, v) => writes.push([k, v]));
    expect(s.getItem("vtld")).toBe("t");
    s.setItem("vendor_a", 5);
    s.vendor_b = "b";
    s.removeItem("vtld");
    s.removeItem("absent");
    expect(s.getItem("vendor_a")).toBe("5");
    expect(s.length).toBe(2);
    expect(writes).toEqual([["vendor_a", "5"], ["vendor_b", "b"], ["vtld", null]]);
  });

  it("clear reports a removal per key", () => {
    const writes = [];
    const s = createSyncStorage({ a: "1", b: "2" }, (k, v) => writes.push([k, v]));
    s.clear();
    expect(writes).toEqual([["a", null], ["b", null]]);
    expect(s.length).toBe(0);
  });

  it("without a write hook it is the old in-memory shim and reports nothing", () => {
    const s = createSyncStorage();
    s.setItem("k", "v");
    expect(s.getItem("k")).toBe("v");
    expect(s.key(0)).toBe("k");
  });
});
