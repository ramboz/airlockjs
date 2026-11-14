// 067-12: the trusted write-back seam for chamber storage writes (core/wrapped-sdk-host.js).
// Mirrors the 067-05 cookie tests with a test vendor fixture set: a stock key flows by default,
// an out-of-set key is refused, a denied storage purpose drops a granted key, and a caller that
// declares nothing keeps today's behavior.
import { describe, it, expect } from "vitest";
import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";

const STOCK = { localStorage: ["vendor_", "vtld"], sessionStorage: ["vsid"] };
const PURPOSES = {
  localStorage: { vendor_: ["analytics_storage"], vtld: ["functional"] },
  sessionStorage: { vsid: ["analytics_storage"] },
};

function makeHost(opts) {
  let handler;
  const chamber = { postMessage() {}, onMessage(cb) { handler = cb; } };
  const writes = [];
  const diags = [];
  const caps = {
    egress: { dispatch: async () => ({ status: 200, body: "" }) },
    storage: { reconcile: (area, key, value) => writes.push([area, key, value]) },
  };
  const host = createWrappedSdkHost({ chamber, caps, onDiagnostic: (r) => diags.push(r), ...opts });
  return { emit: (m) => handler(m), writes, diags, host };
}
const wb = (area, key, value = "v") => ({ type: "storage-writeback", area, key, value });

describe("067-12 stock default path", () => {
  it("a stock key (exact and prefix) is written through, silently", () => {
    const { emit, writes, diags } = makeHost({ grantedStorage: STOCK });
    emit(wb("localStorage", "vtld", "t"));
    emit(wb("localStorage", "vendor_id", "1"));
    emit(wb("sessionStorage", "vsid", "s"));
    expect(writes).toEqual([["localStorage", "vtld", "t"], ["localStorage", "vendor_id", "1"], ["sessionStorage", "vsid", "s"]]);
    expect(diags.filter((d) => d.kind.startsWith("storage"))).toEqual([]);
  });

  it("a removal (null value) of a stock key is written through", () => {
    const { emit, writes } = makeHost({ grantedStorage: STOCK });
    emit(wb("localStorage", "vtld", null));
    expect(writes).toEqual([["localStorage", "vtld", null]]);
  });

  it("an out-of-set key, a key in the wrong area, an unknown area and a malformed message are refused with a name-only diagnostic", () => {
    const { emit, writes, diags, host } = makeHost({ grantedStorage: STOCK });
    emit(wb("localStorage", "secret", "TOPSECRET"));
    emit(wb("localStorage", "vsid"));
    emit(wb("cookies", "vtld"));
    emit({ type: "storage-writeback", area: "localStorage", key: 7, value: "v" });
    emit({ type: "storage-writeback", area: "localStorage", key: "vtld", value: { x: 1 } });
    expect(writes).toEqual([]);
    expect(host.getState().storageScopeHeld).toBe(5);
    const d = diags.filter((x) => x.kind === "storage-scope");
    expect(d.length).toBe(5);
    expect(JSON.stringify(d)).not.toContain("TOPSECRET");
    expect(d[0]).toMatchObject({ level: "error", disposition: "dropped", name: "secret", area: "localStorage" });
  });
});

describe("067-12 narrowed opt-in path", () => {
  it("a narrowed grant writes only the subset; a stock key outside it is refused", () => {
    const { emit, writes, host } = makeHost({ grantedStorage: STOCK, storageGrantNarrowing: { localStorage: ["vtld"] } });
    emit(wb("localStorage", "vtld"));
    emit(wb("localStorage", "vendor_id"));
    emit(wb("sessionStorage", "vsid"));
    expect(writes).toEqual([["localStorage", "vtld", "v"], ["sessionStorage", "vsid", "v"]]);
    expect(host.getState().storageScopeHeld).toBe(1);
  });

  it("a narrowing outside the stock set fails loud at construction", () => {
    expect(() => makeHost({ grantedStorage: STOCK, storageGrantNarrowing: { localStorage: ["other"] } })).toThrow(TypeError);
  });
});

describe("067-12 consent-driven write denial", () => {
  it("drops a granted key while its storage purpose is explicitly denied, keeps one whose purpose is granted or non-storage", () => {
    const { emit, writes, diags, host } = makeHost({
      grantedStorage: STOCK,
      storagePurposes: PURPOSES,
      consent: { analytics_storage: "denied", functional: "denied" },
    });
    emit(wb("localStorage", "vendor_id", "SECRETVAL"));
    emit(wb("sessionStorage", "vsid"));
    emit(wb("localStorage", "vtld", "t"));
    expect(writes).toEqual([["localStorage", "vtld", "t"]]);
    expect(host.getState().storageConsentHeld).toBe(2);
    const d = diags.filter((x) => x.kind === "storage-consent");
    expect(d[0]).toMatchObject({ level: "warn", disposition: "dropped", name: "vendor_id", area: "localStorage" });
    expect(JSON.stringify(d)).not.toContain("SECRETVAL");
  });

  it("a pending or granted purpose does not deny (pending is the seal hold's concern)", () => {
    const { emit, writes } = makeHost({ grantedStorage: STOCK, storagePurposes: PURPOSES, consent: { analytics_storage: "pending" } });
    emit(wb("localStorage", "vendor_id"));
    expect(writes.length).toBe(1);
  });

  it("the denial reads the live consent ref per write", () => {
    const consent = { analytics_storage: "granted" };
    const { emit, writes } = makeHost({ grantedStorage: STOCK, storagePurposes: PURPOSES, consent });
    emit(wb("localStorage", "vendor_id"));
    consent.analytics_storage = "denied";
    emit(wb("localStorage", "vendor_id"));
    expect(writes.length).toBe(1);
  });
});

describe("067-12 migration: a caller that declares nothing keeps today's behavior (spec 067 check 8)", () => {
  it("no stock set and no narrowing: write-backs are dropped (chamber storage stays in memory), as before", () => {
    const { emit, writes, host } = makeHost({});
    emit(wb("localStorage", "anything"));
    expect(writes).toEqual([]);
    expect(host.getState()).toMatchObject({ storageScopeHeld: 1 });
  });

  it("no caps.storage sink at all: a write-back is a silent no-op, as before", () => {
    let handler;
    createWrappedSdkHost({ chamber: { postMessage() {}, onMessage(cb) { handler = cb; } }, caps: { egress: { dispatch: async () => ({ status: 200, body: "" }) } } });
    expect(() => handler(wb("localStorage", "k"))).not.toThrow();
  });
});
