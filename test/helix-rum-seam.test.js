// helix-rum's SEAM behavior (spec 022-01 AC2) — proves the "not-consent-gated
// RUM governance class" (spec 022 § Governance class, maintainer 2026-08-31)
// is FREE on core/airlock.js's EXISTING seam (frame-critique, 2026-08-31): an
// empty/absent `egressPurposes` skips the consent gate entirely (core/
// consent.js's egressVerdict is never even consulted — contrast the SAME seam
// gating a GA4/alloy-shaped beacon), while the endpoint ceiling (core/
// endpoint-ceiling.js) still confines the beacon to the declared ot.aem.live
// destination. Reuses the SAME FakeWorker harness test/endpoint-ceiling-seam.
// test.js and test/consent-seal.test.js already use (no real Worker — hermetic,
// avoids the stale-worktree hang risk named in this slice's brief).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import {
  createHelixRumConnector,
  DEFAULT_COLLECT_BASE_URL,
  DEFAULT_WEIGHT,
} from "../connectors/helix-rum/connector.js";

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

const RUM_ENDPOINT = `${DEFAULT_COLLECT_BASE_URL}/.rum/${DEFAULT_WEIGHT}`;
const ctx = { referer: "https://spike.example/" };
const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AC2 — a RUM beacon fires regardless of consent (contrast with GA4/alloy, which DO gate)", () => {
  it("the RUM connector's OWN ready request dispatches with NO egressPurposes wired, no consent vector, no setConsent call", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // force isSelected
    const connector = createHelixRumConnector({ ctx });
    const [rumReady] = connector.handle({ type: "top", ts: 99 });

    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    // NOTE: no `egressPurposes`, no `consent` opt at all — the RUM governance
    // class (spec 022 § Governance class) never wires either for this egress.
    createAirlock({
      trackers: 1, workFactor: 0,
      endpoints: connector.manifest.endpoints, ctx, unloadCritical: [],
      onDiagnostic,
    });

    FakeWorker.last.onmessage(readyMsg([rumReady]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      RUM_ENDPOINT,
      expect.objectContaining({ method: "POST", body: rumReady.body, keepalive: true }),
    );
    expect(onDiagnostic).not.toHaveBeenCalled(); // no consent hold, no ceiling hold
  });

  it("CONTRAST: an otherwise-identical beacon governed by a declared egress purpose (GA4/alloy's shape) IS held on the very consent state the RUM path sails through", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    createAirlock({
      trackers: 1, workFactor: 0,
      endpoints: [RUM_ENDPOINT], ctx, unloadCritical: [],
      egressPurposes: ["analytics_storage"], // GA4/alloy's shape — RUM never sets this
      onDiagnostic: vi.fn(),
    });

    FakeWorker.last.onmessage(readyMsg([{ url: RUM_ENDPOINT, body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled(); // held — pending, no signal yet
  });

  it("an explicit consent DENIAL wired elsewhere on the page does not touch the RUM path (no egressPurposes -> the gate is structurally OFF for RUM)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const connector = createHelixRumConnector({ ctx });
    const [rumReady] = connector.handle({ type: "top", ts: 1 });

    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // A consent vector IS wired (e.g. for a co-installed GA4 connector on the
    // same page) but this RUM airlock instance never names it in egressPurposes.
    createAirlock({
      trackers: 1, workFactor: 0,
      endpoints: connector.manifest.endpoints, ctx, unloadCritical: [],
      consent: { analytics_storage: "denied" },
      onDiagnostic: vi.fn(),
    });

    FakeWorker.last.onmessage(readyMsg([rumReady]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("022-02 AC1/AC3 — the `error` checkpoint rides the SAME governed path as `top`", () => {
  it("an error beacon dispatches with NO consent gate, identically to top — no egressPurposes, no consent vector", () => {
    vi.spyOn(Math, "random").mockReturnValue(0); // force isSelected
    const connector = createHelixRumConnector({ ctx });
    const [errReady] = connector.handle({
      type: "error", ts: 42, params: { source: "foo@https://example.com/a.js:1:2", target: "TypeError: boom" },
    });

    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    createAirlock({
      trackers: 1, workFactor: 0,
      endpoints: connector.manifest.endpoints, ctx, unloadCritical: [],
      onDiagnostic,
    });

    FakeWorker.last.onmessage(readyMsg([errReady]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      RUM_ENDPOINT,
      expect.objectContaining({ method: "POST", body: errReady.body, keepalive: true }),
    );
    expect(onDiagnostic).not.toHaveBeenCalled(); // no consent hold, no ceiling hold
  });

  it("a re-pointed error beacon (compromised destination) is HELD — zero fetch, redacted diagnostic, no beacon body leaked", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    // The HOST stays pinned to the real ot.aem.live URL — same ceiling that
    // governs `top`, applied identically regardless of checkpoint content.
    createAirlock({ trackers: 1, workFactor: 0, endpoints: [RUM_ENDPOINT], ctx, unloadCritical: [], onDiagnostic });

    const evilUrl = "https://evil.example/.rum/100";
    const evilBody = JSON.stringify({
      weight: 100, id: "synthetic-error-id-9", referer: ctx.referer, checkpoint: "error", t: 1,
      source: "synthetic-source@https://evil.example/a.js:1:1", target: "synthetic-target-error-string",
    });
    FakeWorker.last.onmessage(readyMsg([{ url: evilUrl, body: evilBody }]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const record = onDiagnostic.mock.calls[0][0];
    expect(record).toMatchObject({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: evilUrl });
    // The BEACON BODY (id/source/target) never rides in the diagnostic.
    expect(JSON.stringify(record)).not.toContain("synthetic-error-id-9");
    expect(JSON.stringify(record)).not.toContain("synthetic-target-error-string");
  });
});

describe("AC2 — the endpoint ceiling still confines RUM (fail-closed, exactly like GA4/alloy's own ceiling)", () => {
  it("the connector's OWN ready request, with a host-pinned declared endpoint matching the actual URL -> dispatches", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const connector = createHelixRumConnector({ ctx });
    const [rumReady] = connector.handle({ type: "top", ts: 1 });

    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    createAirlock({ trackers: 1, workFactor: 0, endpoints: [RUM_ENDPOINT], ctx, unloadCritical: [] });

    FakeWorker.last.onmessage(readyMsg([rumReady]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("re-pointed OFF ot.aem.live (a compromised/misconfigured destination) is HELD — zero fetch, a redacted diagnostic, no beacon", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    // The HOST stays pinned to the real ot.aem.live URL (ADR-0006: the host
    // allow-list is authoritative, not whatever a chamber requests).
    createAirlock({ trackers: 1, workFactor: 0, endpoints: [RUM_ENDPOINT], ctx, unloadCritical: [], onDiagnostic });

    const evilUrl = "https://evil.example/.rum/100";
    const evilBody = JSON.stringify({ weight: 100, id: "synthetic-id-9", referer: ctx.referer, checkpoint: "top", t: 1 });
    FakeWorker.last.onmessage(readyMsg([{ url: evilUrl, body: evilBody }]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const record = onDiagnostic.mock.calls[0][0];
    // The destination (origin+path, no query) DOES surface — that is the point
    // of the diagnostic (mirrors test/endpoint-ceiling-seam.test.js).
    expect(record).toMatchObject({ level: "error", kind: "endpoint-ceiling", disposition: "held", destination: evilUrl });
    // The BEACON BODY (the id/referer) never rides in the diagnostic, even
    // though it was held, not sent.
    expect(JSON.stringify(record)).not.toContain("synthetic-id-9");
  });

  it("a connector RE-CONFIGURED with a non-ot.aem.live collectBaseURL still gets HELD by a host pinned to the real endpoint", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const compromised = createHelixRumConnector({ ctx, collectBaseURL: "https://evil.example" });
    const [evilReady] = compromised.handle({ type: "top", ts: 1 });

    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    // Host declares ONLY the real ot.aem.live endpoint — ignoring whatever the
    // (compromised) connector's own advisory manifest says (ADR-0006).
    createAirlock({ trackers: 1, workFactor: 0, endpoints: [RUM_ENDPOINT], ctx, unloadCritical: [], onDiagnostic });

    FakeWorker.last.onmessage(readyMsg([evilReady]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
  });
});
