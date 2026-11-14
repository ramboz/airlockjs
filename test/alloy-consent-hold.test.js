import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootAlloy } from "../adapters/eds/index.js";
import { MAX_HELD_BEACONS } from "../core/airlock.js";
import { shapeAlloyBoot } from "../connectors/alloy/consent.js";

// Slice 067-03 (ADR-0062 exception a): Alloy holds with no consent input, holds on an empty
// `egressPurposes`, and flushes on a grant. The Worker below models the chamber's boot glue
// with the REAL `shapeAlloyBoot`: under a pending posture alloy's own queue keeps every event
// (no fetch), and a resolving `setConsent` flushes the queue through the intercepted fetch.
const INTERACT = "https://adobedc.demdex.net/ee/v1/interact";
const DS = "12345678-1234-1234-1234-123456789012";
const entry = (extra = {}) => ({ type: "alloy", bundleUrl: "https://airlock.example/alloy.js", datastreamId: DS, orgId: "ORG@AdobeOrg", ...extra });
const GRANTED = { analytics_storage: "granted", personalization: "granted" };

class AlloyWorker {
  constructor() { this.handlers = []; this.messages = []; this.queue = []; this.vector = null; this.n = 0; AlloyWorker.last = this; }
  addEventListener(t, fn) { if (t === "message") this.handlers.push(fn); }
  removeEventListener() {}
  terminate() {}
  emit(msg) { for (const h of this.handlers.slice()) h({ data: msg }); }
  fire(body) {
    this.n += 1;
    this.emit({ type: "intercepted-fetch", id: `f${this.n}`, url: `${INTERACT}?configId=${DS}`, method: "POST", headers: { "content-type": "application/json" }, body });
  }
  postMessage(m) {
    this.messages.push(m);
    if (m.type === "init") {
      this.vector = m.consent;
      setTimeout(() => { this.emit({ type: "phase", name: "install" }); this.emit({ type: "phase", name: "configured" }); }, 0);
    } else if (m.type === "event") {
      this.driven = (this.driven || 0) + 1;
      if (shapeAlloyBoot(this.vector).defaultConsent === "pending") this.queue.push(m.event);
      else setTimeout(() => this.fire("{}"), 0);
    } else if (m.type === "setConsent") {
      this.vector = { ...(this.vector || {}), ...m.consent };
      if (shapeAlloyBoot(this.vector).setConsentOptions?.consent[0].value.collect.val === "y") {
        for (const q of this.queue.splice(0)) setTimeout(() => this.fire(JSON.stringify({ queued: q.type })), 0);
      }
    } else if (m.type === "intercepted-fetch-response") {
      setTimeout(() => this.emit({ type: "result", summary: { booted: true }, ready: [] }), 0);
    }
  }
}

const tick = (ms = 30) => new Promise((r) => setTimeout(r, ms));
const view = { event: "page_view", page_location: "https://site/p" };
let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve({ status: 200, statusText: "OK", headers: { get: () => "application/json" }, text: async () => "{}" }));
  vi.stubGlobal("Worker", AlloyWorker);
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const boot = async (extra = {}) => {
  const diags = [];
  const handle = await bootAlloy(entry({ onDiagnostic: (d) => diags.push(d), ...extra }));
  return { handle, diags, worker: AlloyWorker.last };
};
const noInputWarnings = (diags) => diags.filter((d) => d.kind === "consent" && /no consent input wired/.test(d.reason ?? ""));

describe("067-03 AC1 — no consent input: alloy holds and warns once", () => {
  it("boots alloy pending, sends nothing, and warns once (not per event)", async () => {
    const { handle, diags, worker } = await boot();
    expect(shapeAlloyBoot(worker.messages.find((m) => m.type === "init").consent).defaultConsent).toBe("pending");

    handle.push(view);
    await tick();
    handle.push(view);
    await tick();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(worker.queue).toHaveLength(1); // the first event waits in alloy's queue, the rest wait in the adapter
    expect(noInputWarnings(diags)).toHaveLength(1);
  });

  it("does not warn when setConsent was called before the first event", async () => {
    const { handle, diags } = await boot();
    handle.setConsent({ analytics_storage: "pending" });
    handle.push(view);
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(noInputWarnings(diags)).toHaveLength(0);
  });

  it("consentHold:false sends as stock does, with one hold-off warning at boot", async () => {
    const { handle, diags } = await boot({ consentHold: false });
    expect(diags.filter((d) => d.disposition === "hold-off")).toHaveLength(1);
    handle.push(view);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(noInputWarnings(diags)).toHaveLength(0);
  });

  it("a consent vector wins over consentHold:false (the seal applies)", async () => {
    const { handle } = await boot({ consentHold: false, consent: { analytics_storage: "pending" } });
    handle.push(view);
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("067-03 AC3/AC4 — pending holds, a grant flushes the queued sendEvent", () => {
  it("flushes every held event on grant, through the seam as granted, then keeps flowing", async () => {
    const { handle, worker } = await boot();
    handle.push(view);
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent(GRANTED);
    await tick(80);
    expect(worker.messages.some((m) => m.type === "setConsent")).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ queued: "page_view" });
    expect(handle.getState().consentHeld).toBe(0);

    handle.push(view);
    await tick(80);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("a still-pending update keeps holding, a denial sends nothing", async () => {
    const { handle } = await boot();
    handle.push(view);
    handle.setConsent({ personalization: "granted" });
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    handle.setConsent({ analytics_storage: "denied" });
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the seam drop is a backstop only: an interact alloy did NOT queue is still held, and the held count shows it", async () => {
    const { handle, worker } = await boot();
    worker.fire("{}"); // what a compromised chamber (or alloy on a stale consent cookie) would send
    await tick();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(handle.getState().consentHeld).toBe(1);
  });

  it("bounds the waiting events at MAX_HELD_BEACONS while consent is not granted, dropping the oldest with a diagnostic", async () => {
    const { handle, diags } = await boot();
    for (let i = 0; i < MAX_HELD_BEACONS + 5; i++) handle.push(view);
    await tick();
    const dropped = diags.filter((d) => d.kind === "consent" && d.disposition === "dropped");
    expect(dropped.length).toBeGreaterThanOrEqual(4);
    expect(dropped[0].reason).toMatch(new RegExp(`cap ${MAX_HELD_BEACONS}`));
  });
});

describe("067-03 AC6 — stock-default path: consent granted is unchanged", () => {
  it("sends the interact at once with no hold, no warning, no held count", async () => {
    const { handle, diags } = await boot({ consent: GRANTED });
    handle.push(view);
    await tick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(handle.getState().consentHeld).toBe(0);
    expect(diags.filter((d) => d.kind === "consent")).toEqual([]);
  });

  it("is never capped while granted", async () => {
    const { handle, diags } = await boot({ consent: GRANTED });
    for (let i = 0; i < MAX_HELD_BEACONS + 20; i++) handle.push(view);
    await tick(600);
    expect(diags.filter((d) => d.disposition === "dropped")).toEqual([]);
  });
});
