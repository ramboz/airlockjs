import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

// Spec 017-03 — the seal's hold-pending + strict-drop (ADR-0007 point ③), the
// THIRD consent enforcement point after the mapper-reshape (017-01) and the
// cookie-capability deny (017-02). E2E against the REAL `core/airlock.js` seam
// (both dispatch sites: the async `worker.onmessage` -> `fetch` path AND the
// sync/unload `pushCritical` fast path), using the SAME FakeWorker pattern
// `test/chamber-observability.test.js` uses (no real Worker needed — a `ready`
// reply is simulated directly against `FakeWorker.last.onmessage`).
//
// Semantics under test (ADR-0007, core/consent.js's `egressVerdict`):
//   - pending (no signal)      -> HOLD at the async seal / DROP on sync-unload
//     (no "later" to flush to there).
//   - denied a STORAGE purpose (e.g. `analytics_storage`, non-strict) -> SEND
//     — a storage-purpose denial is 017-02's cookie concern; the beacon still
//     egresses. Do NOT hold/drop it here.
//   - granted -> SEND.
//   - STRICT regime + any un-granted purpose -> DROP (no beacon, no buffer).

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

const endpoints = ["https://t0.example/collect"];
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

/** GA4's single declared egress purpose (`connectors/ga4/connector.js`'s
 *  manifest, `adapters/eds/index.js`'s `GA4_EGRESS_PURPOSES`) — the default
 *  `egressPurposes` for every test here unless a test overrides it. */
const make = (opts) =>
  createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints,
    ctx,
    unloadCritical: [],
    egressPurposes: ["analytics_storage"],
    ...opts,
  });

const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

describe("AC1/AC6 — pending purpose HOLDS a ready beacon at the async seal", () => {
  it("zero egress + buffered + a consent/held diagnostic per beacon (no consent vector wired at all)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic }); // consent defaults null -> {} -> analytics_storage resolves "pending"

    FakeWorker.last.onmessage(
      readyMsg([
        { url: endpoints[0], body: '{"n":1}' },
        { url: endpoints[0], body: '{"n":2}' },
      ]),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(2); // one per held beacon
    for (const [record] of onDiagnostic.mock.calls) {
      expect(record).toMatchObject({
        level: "warn",
        kind: "consent",
        disposition: "held",
        purpose: "analytics_storage",
      });
    }
  });

  it("an explicit `{ analytics_storage: 'pending' }` vector holds identically to an absent vector", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ consent: { analytics_storage: "pending" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC2 — 017-03's own main-thread setConsent flushes held beacons on pending→granted", () => {
  it("setConsent granting the held purpose re-fetches every buffered { url, body } (pure main-thread re-dispatch)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic });

    FakeWorker.last.onmessage(
      readyMsg([
        { url: endpoints[0], body: '{"held":1}' },
        { url: endpoints[0], body: '{"held":2}' },
      ]),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    onDiagnostic.mockClear();

    airlock.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      endpoints[0],
      expect.objectContaining({ method: "POST", body: '{"held":1}', keepalive: true }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      endpoints[0],
      expect.objectContaining({ method: "POST", body: '{"held":2}', keepalive: true }),
    );
    expect(onDiagnostic).toHaveBeenCalledTimes(2); // one flushed record per beacon
    for (const [record] of onDiagnostic.mock.calls) {
      expect(record).toMatchObject({ level: "warn", kind: "consent", disposition: "flushed", purpose: "analytics_storage" });
    }
  });

  it("a grant for an UNRELATED purpose does not flush a still-pending analytics_storage hold", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make();

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));
    airlock.setConsent({ functional: "granted" }); // does not touch analytics_storage

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("setConsent is a no-op (no throw, no fetch) when nothing is held", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ consent: { analytics_storage: "granted" } });

    expect(() => airlock.setConsent({ analytics_storage: "granted" })).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("granted (normal) dispatch is unchanged", () => {
  it("granted from the start dispatches immediately — no held/dropped diagnostic", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic, consent: { analytics_storage: "granted" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});

describe("denied analytics_storage (non-strict) SENDS — a storage denial does not hold egress (017-02's cookie concern)", () => {
  it("a beacon with the purpose explicitly DENIED still dispatches, not held, not dropped", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic, consent: { analytics_storage: "denied" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});

describe("AC3/AC6 — strict regime DROPS an un-granted beacon (no hold, no buffer)", () => {
  it("strict + pending -> zero egress, a consent/dropped diagnostic, and NOTHING to later flush", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic, consentStrict: true });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      level: "warn",
      kind: "consent",
      disposition: "dropped",
      purpose: "analytics_storage",
      reason: expect.stringContaining("strict"),
    });

    // dropped, not held: a later grant has no buffer to flush (still zero egress).
    onDiagnostic.mockClear();
    airlock.setConsent({ analytics_storage: "granted" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).not.toHaveBeenCalled(); // no held beacon existed to flush
  });

  it("strict + DENIED also drops (fail-closed: any non-granted, not just pending)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ consentStrict: true, consent: { analytics_storage: "denied" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC4 — the sync/unload fast path (pushCritical) can only DROP, never hold", () => {
  it("a pending governing purpose on the sync path drops the beacon — no fetch, a dropped diagnostic naming the sync/unload reason", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic });

    airlock.pushCritical({ event: "outbound_click", link_url: "https://out.example/" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      level: "warn",
      kind: "consent",
      disposition: "dropped",
      purpose: "analytics_storage",
      reason: expect.stringContaining("sync/unload"),
    });
  });

  it("strict + denied on the sync path also drops (both-sites parity)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ consentStrict: true, consent: { analytics_storage: "denied" } });

    airlock.pushCritical({ event: "page_view", page_location: "https://x.example/" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a GRANTED governing purpose on the sync path dispatches unchanged", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ consent: { analytics_storage: "granted" } });

    airlock.pushCritical({ event: "outbound_click", link_url: "https://out.example/" });

    expect(fetchMock).toHaveBeenCalledTimes(1); // trackers:1 -> one keepalive POST
  });
});

describe("AC5 — the purpose->beacon binding is whatever `egressPurposes` the caller declares (vendor-neutral, not hardcoded)", () => {
  it("a beacon governed by MULTIPLE declared purposes is held if ANY is un-granted (fail-closed)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // analytics_storage granted, but ad_storage still pending -> the worst verdict (hold) wins.
    make({ egressPurposes: ["analytics_storage", "ad_storage"], consent: { analytics_storage: "granted" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("back-compat — no egressPurposes configured leaves the gate OFF entirely", () => {
  it("async path: dispatched normally, no consent diagnostics, even with a pending-shaped vector", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic, egressPurposes: [] });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });

  it("sync path: pushCritical dispatches normally too", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ egressPurposes: [] });

    airlock.pushCritical({ event: "outbound_click", link_url: "https://out.example/" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
