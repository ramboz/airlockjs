// Enforcement-decision inspector collector — spec 028-01 (MVP5 fixed core).
//
// The collector is a bounded READ-LAYER over the existing 009-02 diagnostic
// stream: one instance's `onDiagnostic` is wired as the sink on all THREE
// main-thread constructors (createAirlock / createWrappedSdkHost /
// createDomApplyCoordinator — the frame-critique's three-seam correction), and
// `query()` reads back the captured enforcement decisions. Tests: (1) the
// collector unit (query filters / bounded ring / returned copies / no PII
// amplification — AC2/AC3/AC6); (2) the three-seam integration proving records
// from ALL three hosts land in ONE shared collector, with `config-integrity`
// (which emits from wrapped-sdk-host ALONE) explicitly exercised so the
// createAirlock-only blind spot the frame-critique caught is closed (AC1); and
// (3) that a clean dispatch never touches the collector (off the hot path, AC4)
// and the console default still fires when no collector is injected (AC5).
//
// Reuses the SAME hermetic harnesses the existing per-host suites use (no real
// Worker / no jsdom / no network): the FakeWorker of test/pixel-seam.test.js, the
// fake chamber of test/wrapped-sdk-host.test.js, the fakeEl/fakeDoc of
// test/dom-apply-coordinator.test.js. Synthetic identifiers only.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInspectorCollector } from "../core/inspector/collector.js";
import { createAirlock } from "../core/airlock.js";
import { createWrappedSdkHost } from "../core/wrapped-sdk-host.js";
import { createDomApplyCoordinator } from "../adapters/eds/dom-apply.js";

// ---- shared hermetic harnesses (mirrors of the existing per-host suites) ----

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.onmessage = null;
    this.onerror = null;
    this.terminated = 0;
  }
  postMessage() {}
  terminate() { this.terminated += 1; }
}

function makeFakeChamber() {
  let handler = null;
  return {
    postMessage() {},
    onMessage(cb) { handler = cb; },
    emit(msg) { if (handler) handler(msg); },
  };
}

function fakeEl() {
  const attrs = {};
  return {
    style: {},
    setAttribute(k, v) { attrs[k] = String(v); },
    getAttribute(k) { return k in attrs ? attrs[k] : null; },
    appendChild(c) { return c; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    set textContent(v) { this.__t = v; },
    get textContent() { return this.__t || ""; },
    set innerHTML(v) { this.__h = v; },
    get innerHTML() { return this.__h || ""; },
  };
}
const fakeDoc = { createElement: () => fakeEl(), createTextNode: () => fakeEl() };

const GA4_ENDPOINTS = ["https://t0.example/collect"];
const GA4_CTX = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
const readyMsg = (ready = [], dropped = []) => ({ data: { ready, dropped } });

// config-integrity fixture (synthetic datastreams — never live)
const CI_HOST = "https://adobedc.demdex.net/ee/v1/interact";
const HONEST_DS = "11111111-1111-1111-1111-111111111111";
const ATTACKER_DS = "99999999-9999-9999-9999-999999999999";
const CI_PIN = { pinnedHost: "adobedc.demdex.net", tenantKey: "configId", pinnedTenant: HONEST_DS, disposition: "hold" };

// ============================================================================
// (1) collector unit — AC2 (query) / AC3 (bounded) / AC6 (no amplification)
// ============================================================================
describe("createInspectorCollector — the read-layer unit (AC2/AC3/AC6)", () => {
  it("AC2 — query filters by kind / disposition / purpose (AND), else returns the full stream in emission order", () => {
    const c = createInspectorCollector();
    c.onDiagnostic({ level: "warn", kind: "consent", disposition: "held", purpose: "analytics_storage" });
    c.onDiagnostic({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: "https://evil.example/x" });
    c.onDiagnostic({ level: "warn", kind: "consent", disposition: "dropped", purpose: "ad_storage" });

    expect(c.query({ kind: "consent" }).map((r) => r.disposition)).toEqual(["held", "dropped"]); // emission order
    expect(c.query({ disposition: "held" }).map((r) => r.kind)).toEqual(["consent", "endpoint-ceiling"]);
    expect(c.query({ kind: "consent", disposition: "dropped" }).map((r) => r.purpose)).toEqual(["ad_storage"]); // AND
    expect(c.query({ purpose: "analytics_storage" })).toHaveLength(1);
    expect(c.query()).toHaveLength(3); // no filter -> all
    expect(c.query().map((r) => r.kind)).toEqual(["consent", "endpoint-ceiling", "consent"]); // emission order preserved
  });

  it("AC2 — results are COPIES: mutating a query result never corrupts the buffer", () => {
    const c = createInspectorCollector();
    c.onDiagnostic({ kind: "consent", disposition: "held", purpose: "analytics_storage" });
    const first = c.query()[0];
    first.disposition = "TAMPERED";
    first.injected = true;
    expect(c.query()[0].disposition).toBe("held"); // unchanged
    expect(c.query()[0].injected).toBeUndefined();
  });

  it("AC3 — the buffer is bounded (drop-oldest ring); the newest `capacity` survive", () => {
    const c = createInspectorCollector({ capacity: 3 });
    for (let i = 0; i < 10; i += 1) c.onDiagnostic({ kind: "dropped", disposition: "x", seq: i });
    expect(c.size()).toBe(3);
    expect(c.capacity).toBe(3);
    expect(c.query().map((r) => r.seq)).toEqual([7, 8, 9]); // oldest evicted, newest + emission order kept
  });

  it("AC3 — capacity defaults to 500 and rejects a non-positive/invalid override", () => {
    expect(createInspectorCollector().capacity).toBe(500);
    expect(createInspectorCollector({ capacity: 0 }).capacity).toBe(500);
    expect(createInspectorCollector({ capacity: -4 }).capacity).toBe(500);
    expect(createInspectorCollector({ capacity: 2.5 }).capacity).toBe(500);
    expect(createInspectorCollector({ capacity: 10 }).capacity).toBe(10);
  });

  it("AC6 — no PII amplification: the collector stores the redacted record as-is, adding no context", () => {
    const c = createInspectorCollector();
    // a payload-governance record carries the field NAME only (never the value) — per its existing shape.
    c.onDiagnostic({ level: "warn", kind: "payload-governance", disposition: "stripped", field: "email" });
    const [rec] = c.query({ kind: "payload-governance" });
    expect(rec).toEqual({ level: "warn", kind: "payload-governance", disposition: "stripped", field: "email" });
    expect(Object.keys(rec).sort()).toEqual(["disposition", "field", "kind", "level"]); // nothing widened
    expect("value" in rec).toBe(false);
  });

  it("is defensive — a non-object record is ignored, never thrown into the emit site", () => {
    const c = createInspectorCollector();
    expect(() => { c.onDiagnostic(null); c.onDiagnostic(undefined); c.onDiagnostic("nope"); c.onDiagnostic(42); }).not.toThrow();
    expect(c.size()).toBe(0);
  });
});

// ============================================================================
// (2) three-seam integration — AC1 (one shared collector, all three hosts)
// ============================================================================
describe("AC1 — ONE shared collector taps all THREE onDiagnostic seams (the frame-critique's three-seam fix)", () => {
  beforeEach(() => {
    FakeWorker.last = null;
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("createAirlock records land: endpoint-ceiling held, dropped, and consent held", () => {
    const c = createInspectorCollector();

    // (a) endpoint-ceiling: no egressPurposes (consent skipped) + an out-of-ceiling destination.
    createAirlock({ trackers: 1, workFactor: 0, endpoints: GA4_ENDPOINTS, ctx: GA4_CTX, unloadCritical: [], onDiagnostic: c.onDiagnostic });
    FakeWorker.last.onmessage(readyMsg([{ url: "https://evil.example/x", method: "POST", body: "b" }], [{ type: "page_view", reason: "malformed", index: 0 }]));

    // (b) consent held: a pending governing purpose holds the beacon at the async seal.
    createAirlock({ trackers: 1, workFactor: 0, endpoints: GA4_ENDPOINTS, ctx: GA4_CTX, unloadCritical: [], onDiagnostic: c.onDiagnostic, egressPurposes: ["analytics_storage"], consent: { analytics_storage: "pending" } });
    FakeWorker.last.onmessage(readyMsg([{ url: "https://t0.example/collect", method: "POST", body: "b" }]));

    expect(c.query({ kind: "endpoint-ceiling", disposition: "held" })).toHaveLength(1);
    expect(c.query({ kind: "dropped" })).toHaveLength(1);
    expect(c.query({ kind: "consent", disposition: "held" })).toHaveLength(1);
  });

  it("createAirlock payload-governance (stripped) lands via a REAL governParams strip (not a synthetic record)", () => {
    const c = createInspectorCollector();
    const handle = createAirlock({ trackers: 1, workFactor: 0, endpoints: GA4_ENDPOINTS, ctx: GA4_CTX, unloadCritical: [], onDiagnostic: c.onDiagnostic, payloadDenylist: ["email"] });
    // pushCritical maps synchronously on the main thread; governParams strips the denied field + emits.
    handle.pushCritical({ event: "page_view", email: "user@synthetic.example", page_location: "https://site.example/" });
    const rec = c.query({ kind: "payload-governance", disposition: "stripped" });
    expect(rec).toHaveLength(1);
    expect(rec[0].field).toBe("email"); // the field NAME only — never the value (no PII amplification)
    expect(c.query({ kind: "payload-governance" }).some((r) => JSON.stringify(r).includes("user@synthetic.example"))).toBe(false);
  });

  it("createWrappedSdkHost records land — INCLUDING config-integrity (which emits from NO other host — the blind spot closed)", () => {
    const c = createInspectorCollector();
    const chamber = makeFakeChamber();
    createWrappedSdkHost({ chamber, caps: { egress: { dispatch: async () => ({ status: 200, body: "{}" }) } }, configIntegrity: CI_PIN, onDiagnostic: c.onDiagnostic });

    // a compromised chamber re-points its datastream to an attacker tenant on the SAME host.
    chamber.emit({ type: "intercepted-fetch", id: "cf-1", url: `${CI_HOST}?configId=${ATTACKER_DS}&requestId=r`, method: "POST", body: "{}" });

    const held = c.query({ kind: "config-integrity" });
    expect(held).toHaveLength(1);
    expect(held[0].disposition).toBe("held");
    // A createAirlock-only collector would show ZERO config-integrity — this asserts the seam is genuinely wired.
    expect(c.query().some((r) => r.kind === "config-integrity")).toBe(true);
  });

  it("createDomApplyCoordinator records land: a dom-apply-* refusal", async () => {
    const c = createInspectorCollector();
    const coord = createDomApplyCoordinator(fakeDoc, { onDiagnostic: c.onDiagnostic });
    await coord.applyOps([{ op: "setText", id: "ghost-node", text: "hi" }]); // unknown id -> refused

    const rec = c.query({ kind: "dom-apply-unknown-id" });
    expect(rec).toHaveLength(1);
    expect(rec[0].op).toBe("setText");
  });

  it("all three seams into ONE collector — the full enforcement picture is queryable from a single instance", async () => {
    const c = createInspectorCollector();
    // airlock
    createAirlock({ trackers: 1, workFactor: 0, endpoints: GA4_ENDPOINTS, ctx: GA4_CTX, unloadCritical: [], onDiagnostic: c.onDiagnostic });
    FakeWorker.last.onmessage(readyMsg([{ url: "https://evil.example/x", method: "POST", body: "b" }]));
    // wrapped-sdk-host (config-integrity)
    const chamber = makeFakeChamber();
    createWrappedSdkHost({ chamber, caps: { egress: { dispatch: async () => ({ status: 200, body: "{}" }) } }, configIntegrity: CI_PIN, onDiagnostic: c.onDiagnostic });
    chamber.emit({ type: "intercepted-fetch", id: "cf-2", url: `${CI_HOST}?configId=${ATTACKER_DS}`, method: "POST", body: "{}" });
    // dom-apply
    const coord = createDomApplyCoordinator(fakeDoc, { onDiagnostic: c.onDiagnostic });
    await coord.applyOps([{ op: "setText", id: "ghost", text: "x" }]);

    const kinds = new Set(c.query().map((r) => r.kind));
    expect(kinds.has("endpoint-ceiling")).toBe(true); // airlock
    expect(kinds.has("config-integrity")).toBe(true); // wrapped-sdk-host ONLY
    expect(kinds.has("dom-apply-unknown-id")).toBe(true); // dom-apply
  });
});

// ============================================================================
// (3) AC4 (off the hot path) / AC5 (console default preserved)
// ============================================================================
describe("AC4 zero-interaction-path-cost + AC5 console default", () => {
  beforeEach(() => {
    FakeWorker.last = null;
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("AC4 — a CLEAN dispatch (no enforcement decision) never touches the collector", () => {
    const c = createInspectorCollector();
    createAirlock({ trackers: 1, workFactor: 0, endpoints: GA4_ENDPOINTS, ctx: GA4_CTX, unloadCritical: [], onDiagnostic: c.onDiagnostic });
    // a declared, un-gated destination -> passes the ceiling, no consent gate, real fetch, NO diagnose.
    FakeWorker.last.onmessage(readyMsg([{ url: "https://t0.example/collect", method: "POST", body: "b" }]));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // the beacon WAS dispatched
    expect(c.size()).toBe(0); // ...and the collector saw nothing — it is only reached by an enforcement decision

    // non-vacuous control: the SAME wired instance DOES capture when an enforcement decision fires,
    // so the size:0 above is "clean dispatch produced nothing", not "the collector is broken/unwired".
    FakeWorker.last.onmessage(readyMsg([{ url: "https://evil.example/x", method: "POST", body: "b" }]));
    expect(c.size()).toBe(1); // an out-of-ceiling destination -> exactly one endpoint-ceiling record
  });

  it("AC5 — with NO collector injected, the console default still fires (byte-identical 009-02 behaviour, additive)", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const chamber = makeFakeChamber();
    createWrappedSdkHost({ chamber, caps: { egress: { dispatch: async () => ({ status: 200, body: "{}" }) } }, configIntegrity: CI_PIN }); // no onDiagnostic
    expect(() => chamber.emit({ type: "intercepted-fetch", id: "cf-3", url: `${CI_HOST}?configId=${ATTACKER_DS}`, method: "POST", body: "{}" })).not.toThrow();
    expect(errSpy).toHaveBeenCalled(); // consoleDiagnostic default still emits the held config-integrity record
    errSpy.mockRestore();
  });
});
