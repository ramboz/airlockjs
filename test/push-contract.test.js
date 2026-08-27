import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

// AC3: the public write surface is reconciled to the PINNED contract
// (contracts/push-api.md): `push({ event: "name", ...params })`. The spike shipped
// `{ type, params }`; this asserts the runtime now accepts the contract shape and
// normalizes internally (event-name key → type; every other key → params), keeping
// the golden `mapToMp` fed `{ type, params }` internally.
//
// createAirlock builds a module Worker and schedules drains via requestIdleCallback,
// neither of which exists in the node test env. We stub them: this unit-tests the
// SYNCHRONOUS push()/getState() contract surface (AC3 / AD-3), not the worker cycle
// (that is AC4's Playwright bundle-smoke). A fake Worker captures the drained batch
// so we can also assert the normalized {type, params} descriptor reaches the worker.

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

const endpoints = ["https://t0.example/collect"];
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

let fetchMock;
beforeEach(() => {
  FakeWorker.last = null;
  fetchMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal("Worker", FakeWorker);
  // Drain synchronously so we can inspect exactly what crosses to the worker.
  vi.stubGlobal("requestIdleCallback", (cb) => {
    cb({ didTimeout: false, timeRemaining: () => 0 });
    return 1;
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const make = () =>
  createAirlock({ trackers: 1, workFactor: 0, endpoints, ctx, unloadCritical: ["click"] });

describe("push() contract reconciliation (AC3 — contracts/push-api.md)", () => {
  it("push({ event, ...params }): event-name key → type, every other key → params", () => {
    const airlock = make();
    airlock.push({ event: "page_view", page_location: "/x" });

    const d = airlock.getState().page_view;
    expect(d).toBeTruthy();
    expect(d.type).toBe("page_view");
    expect(d.params).toEqual({ page_location: "/x" });
    // the reserved event-name key must NOT leak into params
    expect(d.params.event).toBeUndefined();

    // the same normalized { type, params } descriptor crosses to the worker
    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events).toBeTruthy();
    expect(events.batch[0]).toMatchObject({ type: "page_view", params: { page_location: "/x" } });
    expect(events.batch[0].params.event).toBeUndefined();
  });

  it("a synchronous getState() immediately after push reflects it (AD-3 read-after-push)", () => {
    const airlock = make();
    expect(airlock.getState().newsletter_signup).toBeUndefined();

    airlock.push({ event: "newsletter_signup", method: "footer", plan: "pro" });

    const d = airlock.getState().newsletter_signup;
    expect(d).toBeTruthy();
    expect(d.type).toBe("newsletter_signup");
    expect(d.params).toEqual({ method: "footer", plan: "pro" });
  });

  it("pushCritical accepts the same { event, ...params } shape and maps a conformant beacon", () => {
    const airlock = make();
    airlock.pushCritical({ event: "click", link_url: "/signup" });

    expect(fetchMock).toHaveBeenCalledTimes(1); // one keepalive POST per tracker
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({ method: "POST", keepalive: true });
    const body = JSON.parse(init.body);
    expect(body.events[0].name).toBe("click");
    expect(body.events[0].params.link_url).toBe("/signup");
  });
});

describe("getState() path-read (contracts/push-api.md: getState('a.b') is Supported)", () => {
  it("getState() with no argument returns the whole projection", () => {
    const airlock = make();
    airlock.push({ event: "page_view", page_location: "/x" });
    airlock.push({ event: "click", link_url: "/signup" });

    const whole = airlock.getState();
    expect(Object.keys(whole).sort()).toEqual(["click", "page_view"]);
  });

  it("getState('a.b.c') reads the dotted path into the projection", () => {
    const airlock = make();
    airlock.push({ event: "page_view", page_location: "/x" });

    expect(airlock.getState("page_view.type")).toBe("page_view");
    expect(airlock.getState("page_view.params.page_location")).toBe("/x");
    expect(airlock.getState("page_view.params")).toEqual({ page_location: "/x" });
  });

  it("a missing path returns undefined (never throws)", () => {
    const airlock = make();
    airlock.push({ event: "page_view", page_location: "/x" });

    expect(airlock.getState("nope")).toBeUndefined();
    expect(airlock.getState("nope.deep.deeper")).toBeUndefined();
    expect(airlock.getState("page_view.params.missing")).toBeUndefined();
    // walking THROUGH a non-object leaf must not throw either
    expect(airlock.getState("page_view.type.x.y")).toBeUndefined();
  });
});

describe("push()/pushCritical() guard: missing/empty event name (push-event.schema.json requires `event`, minLength 1)", () => {
  it("push without an event name drops the event, warns, and never throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const airlock = make();

    expect(() => airlock.push({ page_location: "/x" })).not.toThrow(); // no `event` key
    expect(() => airlock.push({ event: "", page_location: "/x" })).not.toThrow(); // empty
    expect(() => airlock.push({ event: 42, page_location: "/x" })).not.toThrow(); // non-string

    // nothing folded into the projection (no `undefined`/garbage keys)...
    expect(Object.keys(airlock.getState())).toEqual([]);
    // ...and nothing crossed to the worker
    expect(FakeWorker.last.messages.filter((m) => m.type === "events")).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it("pushCritical without an event name drops (no beacon), warns, and never throws", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const airlock = make();

    expect(() => airlock.pushCritical({ link_url: "/signup" })).not.toThrow();
    expect(() => airlock.pushCritical({ event: "" })).not.toThrow();

    expect(fetchMock).not.toHaveBeenCalled(); // no name:undefined beacon issued
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });
});

describe("projection robustness: pathological event names (craft/arch review nit)", () => {
  it('an event named "__proto__" lands as an own key and does not rewire the projection', () => {
    const airlock = make();
    airlock.push({ event: "__proto__", x: 1 });
    airlock.push({ event: "page_view", page_location: "/x" });

    const s = airlock.getState();
    // Own key, enumerable — on a plain {} projection this assignment would instead
    // hit the inherited [[Prototype]] setter and vanish from Object.keys().
    expect(Object.keys(s)).toContain("__proto__");
    // And it must not have polluted other entries with inherited descriptor fields.
    expect(s.page_view.type).toBe("page_view");
    expect(Object.getPrototypeOf(s)).toBe(null);
  });
});
