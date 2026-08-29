// Egress confinement — spec 012-01, AC5 (allow-list posture: the mediated fetch
// is the chamber's SOLE network-capable surface).
//
// These pin the PURE hardening logic (applyEgressConfinement / denySendBeacon)
// against a fake worker-global scope: every withheld primitive must end up
// absent-or-throwing, the mediated `fetch` must be preserved, and a setter-less
// accessor (`caches`, as it is on a real WorkerGlobalScope prototype) must still
// be shadowable. The browser rig (rig/alloy-chamber.mjs) proves the same posture
// holds against the REAL chamber + stock alloy bundle, plus the disclosed
// dynamic-import() residual.
import { describe, it, expect } from "vitest";
import {
  applyEgressConfinement,
  denySendBeacon,
  WITHHELD_NETWORK_CONSTRUCTORS,
  CONFINEMENT_MESSAGE,
} from "../connectors/alloy/egress-confinement.js";

// A fake worker-global scope with the ambient network primitives PRESENT (the
// pre-confinement state), so a test that asserts they are withheld is red
// unless the hardening actually ran. `caches` is installed as a setter-less
// prototype accessor to mirror WorkerGlobalScope (exercises the defineProperty
// fallback in forceProp).
function makeFakeScope() {
  const realFetch = function fetch() { return Promise.resolve("real-response"); };
  let sendBeaconCalls = 0;
  const proto = {};
  const realCacheStorage = { open: () => Promise.resolve({ add: () => {}, addAll: () => {} }) };
  Object.defineProperty(proto, "caches", { get() { return realCacheStorage; }, configurable: true });
  const scope = Object.create(proto);
  scope.fetch = realFetch;
  scope.XMLHttpRequest = function XMLHttpRequest() { this.open = () => {}; this.send = () => {}; };
  scope.WebSocket = function WebSocket() { this.opened = true; };
  scope.EventSource = function EventSource() { this.opened = true; };
  scope.WebTransport = function WebTransport() { this.opened = true; };
  scope.Worker = function Worker() { this.spawned = true; };
  scope.navigator = { sendBeacon: () => { sendBeaconCalls += 1; return true; } };
  return { scope, realFetch, realCacheStorage, sendBeaconCalls: () => sendBeaconCalls };
}

describe("applyEgressConfinement (spec 012-01 AC5)", () => {
  it("withholds every ambient network constructor — each throws when used", () => {
    const { scope } = makeFakeScope();
    // Pre-condition: the primitives are live network paths (guards mutate->red).
    expect(() => new scope.XMLHttpRequest()).not.toThrow();

    applyEgressConfinement(scope);

    for (const name of WITHHELD_NETWORK_CONSTRUCTORS) {
      expect(typeof scope[name]).toBe("function");
      expect(() => new scope[name]("wss://egress.invalid/")).toThrow(CONFINEMENT_MESSAGE);
    }
  });

  it("withholds CacheStorage even though `caches` is a setter-less prototype accessor", () => {
    const { scope } = makeFakeScope();
    // Pre-condition: caches.open is a live path (returns a Cache -> add/addAll).
    expect(() => scope.caches.open("x")).not.toThrow();

    applyEgressConfinement(scope);

    // The prototype accessor is shadowed by an own throwing stub.
    expect(() => scope.caches.open("x")).toThrow(CONFINEMENT_MESSAGE);
    expect(() => scope.caches.add("https://egress.invalid/")).toThrow(CONFINEMENT_MESSAGE);
    expect(() => scope.caches.addAll(["https://egress.invalid/"])).toThrow(CONFINEMENT_MESSAGE);
  });

  it("neutralizes navigator.sendBeacon (a fire-and-forget egress path)", () => {
    const { scope, sendBeaconCalls } = makeFakeScope();
    expect(scope.navigator.sendBeacon("https://egress.invalid/", "x")).toBe(true);

    applyEgressConfinement(scope);

    expect(() => scope.navigator.sendBeacon("https://egress.invalid/", "x")).toThrow(CONFINEMENT_MESSAGE);
    // The real beacon body never fired after confinement (call count frozen).
    expect(sendBeaconCalls()).toBe(1);
  });

  it("PRESERVES the mediated fetch as the sole surviving network surface", () => {
    const { scope, realFetch } = makeFakeScope();
    const record = applyEgressConfinement(scope);
    // The allow-listed surface is byte-identical (same reference) and callable.
    expect(scope.fetch).toBe(realFetch);
    expect(typeof scope.fetch).toBe("function");
    expect(record.fetchPreserved).toBe(true);
  });

  it("reports fetchPreserved:false if the mediated fetch was clobbered (invariant guard)", () => {
    const { scope } = makeFakeScope();
    // Simulate an overreaching hardening that wrongly touched fetch.
    const record = applyEgressConfinement(scope);
    expect(record.fetchPreserved).toBe(true);
    // Now clobber and re-derive the invariant against the mutated scope.
    scope.fetch = undefined;
    const record2 = applyEgressConfinement(scope);
    expect(record2.fetchPreserved).toBe(false);
  });

  it("returns a record of what was withheld and how (surfaced for the AC5 assertions)", () => {
    const { scope } = makeFakeScope();
    const record = applyEgressConfinement(scope);
    for (const name of WITHHELD_NETWORK_CONSTRUCTORS) {
      expect(["assigned", "defined", "deleted"]).toContain(record.withheld[name]);
    }
    expect(["assigned", "defined", "deleted"]).toContain(record.caches);
    expect(["assigned", "defined", "deleted"]).toContain(record.sendBeacon);
    expect(record.message).toBe(CONFINEMENT_MESSAGE);
  });

  it("is idempotent — applying twice leaves everything withheld (no throw, still confined)", () => {
    const { scope } = makeFakeScope();
    applyEgressConfinement(scope);
    expect(() => applyEgressConfinement(scope)).not.toThrow();
    expect(() => new scope.XMLHttpRequest()).toThrow(CONFINEMENT_MESSAGE);
  });
});

describe("denySendBeacon (spec 012-01 AC5)", () => {
  it("replaces sendBeacon with a throwing stub on a page-shim navigator", () => {
    const nav = { sendBeacon: () => true };
    expect(denySendBeacon(nav)).toBe("assigned");
    expect(() => nav.sendBeacon("https://egress.invalid/", "x")).toThrow(CONFINEMENT_MESSAGE);
  });

  it("tolerates a scope with no navigator (returns 'no-navigator', never throws)", () => {
    expect(denySendBeacon(undefined)).toBe("no-navigator");
    expect(denySendBeacon(null)).toBe("no-navigator");
  });
});
