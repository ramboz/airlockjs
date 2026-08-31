// Spec 021-01 AC1 (OQ12 item 4) — createAirlock()'s returned handle gains
// dispose(): removeEventListener's the visibilitychange/pagehide listeners (by the
// SAME named references addEventListener registered — not anonymous inline fns,
// which could never be individually removed) and terminates the Worker. Idempotent
// (a second dispose() is a no-op) and null-safe (no addEventListener global / no
// worker.terminate -> skip, never throw).
//
// Same createAirlock-direct-construction seam as test/push-contract.test.js /
// test/endpoint-ceiling-seam.test.js. A fake global listener registry lets us prove
// a listener was ACTUALLY removed (not just bookkept as removed) — dispose() then
// unloadFlush-on-pagehide must genuinely stop firing, not merely record a call.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.terminated = 0;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() { this.terminated++; }
}

function makeListenerRegistry() {
  const map = new Map(); // type -> Set<fn>
  return {
    addEventListener: (type, fn) => {
      if (!map.has(type)) map.set(type, new Set());
      map.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      const set = map.get(type);
      if (set) set.delete(fn);
    },
    fire(type, ev) {
      for (const fn of map.get(type) || []) fn(ev);
    },
    count(type) {
      return map.has(type) ? map.get(type).size : 0;
    },
  };
}

const endpoints = ["https://t0.example/collect"];
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

const make = (opts) =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints, ctx, unloadCritical: [], ...opts });

describe("createAirlock().dispose() (spec 021-01 AC1)", () => {
  let registry;

  beforeEach(() => {
    FakeWorker.last = null;
    registry = makeListenerRegistry();
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("addEventListener", registry.addEventListener);
    vi.stubGlobal("removeEventListener", registry.removeEventListener);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("registers exactly one visibilitychange + one pagehide listener at construction", () => {
    make();
    expect(registry.count("visibilitychange")).toBe(1);
    expect(registry.count("pagehide")).toBe(1);
  });

  it("dispose() removes BOTH the visibilitychange and pagehide listeners", () => {
    const airlock = make();

    airlock.dispose();

    expect(registry.count("visibilitychange")).toBe(0);
    expect(registry.count("pagehide")).toBe(0);
  });

  it("dispose() terminates the Worker", () => {
    const airlock = make();

    airlock.dispose();

    expect(FakeWorker.last.terminated).toBe(1);
  });

  it("a pagehide fired AFTER dispose() no longer flushes — the listener is truly gone, not just bookkept", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // push() schedules a drain via requestIdleCallback — stub it (unused here; we
    // only need push() to enqueue into the ring without throwing).
    vi.stubGlobal("requestIdleCallback", () => 1);
    const airlock = make({ unloadCritical: ["click"] });
    airlock.push({ event: "click", link_url: "/x" }); // ring has a pending descriptor unloadFlush would map

    airlock.dispose();
    registry.fire("pagehide"); // simulate the browser firing the event anyway

    expect(fetchMock).not.toHaveBeenCalled(); // unloadFlush never ran — no double-dispatch of the tail either
  });

  it("is idempotent — a second dispose() is a no-op (no double-terminate, no throw)", () => {
    const airlock = make();

    airlock.dispose();
    expect(() => airlock.dispose()).not.toThrow();

    expect(FakeWorker.last.terminated).toBe(1); // not 2
  });

  it("is null-safe: no addEventListener/removeEventListener global (plain Node env) never throws", () => {
    vi.unstubAllGlobals();
    vi.stubGlobal("Worker", FakeWorker); // still need a Worker to construct at all
    // addEventListener/removeEventListener deliberately left undefined here.

    const airlock = createAirlock({ trackers: 1, workFactor: 0, endpoints, ctx, unloadCritical: [] });

    expect(() => airlock.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1); // the Worker.terminate() step still runs
  });

  it("is null-safe: a Worker stand-in with no .terminate() never throws", () => {
    class BareWorker {
      postMessage() {}
      // deliberately no terminate()
    }
    vi.stubGlobal("Worker", BareWorker);

    const airlock = createAirlock({ trackers: 1, workFactor: 0, endpoints, ctx, unloadCritical: [] });

    expect(() => airlock.dispose()).not.toThrow();
    expect(() => airlock.dispose()).not.toThrow(); // idempotent even with nothing to terminate
  });
});
