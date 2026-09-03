// LinkedIn Insight adapter wiring — spec 026-02 AC1/AC5/AC6. Mirrors
// test/eds-meta-pixel.test.js's OWN pattern verbatim (the SAME FakeWorker
// harness, the SAME `consent ? … : []` back-compat gate proof, the SAME
// payloadDenylist input-side-strip proof) for `bootLinkedInInsight`, plus an
// endpoint-confinement proof (026-02 AC5's "endpoint-confined" bullet, mirrored
// from test/pixel-seam.test.js's AC7 pattern) that test/eds-meta-pixel.test.js
// itself does not carry (pixel-seam.test.js covers that for Meta instead).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootLinkedInInsight, LINKEDIN_EGRESS_PURPOSES } from "../adapters/eds/index.js";
import { LINKEDIN_COLLECT_ENDPOINT, SYNTHETIC_LINKEDIN_PARTNER_ID } from "../connectors/pixel/vendors/linkedin.js";

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

const initMsg = () => FakeWorker.last.messages.find((m) => m.type === "init");

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
});
afterEach(() => vi.unstubAllGlobals());

describe("bootLinkedInInsight (spec 026-02 AC1 — the adapter's LinkedIn wiring)", () => {
  it("declares LINKEDIN_EGRESS_PURPOSES as ad_storage — an ads/remarketing signal (ADR-0007)", () => {
    expect(LINKEDIN_EGRESS_PURPOSES).toEqual(["ad_storage"]);
  });

  it("boots the PIXEL chamber with a SYNTHETIC partner id by default — no live identifier", async () => {
    const handle = await bootLinkedInInsight();

    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(true);
    const init = initMsg();
    expect(init.endpoint).toBe(LINKEDIN_COLLECT_ENDPOINT);
    expect(init.paramMap.pid).toEqual({ from: "static", value: SYNTHETIC_LINKEDIN_PARTNER_ID });
    expect(handle).toBeTruthy();
  });

  it("an explicit partnerId override crosses into the connector config verbatim", async () => {
    await bootLinkedInInsight({ partnerId: "7654321" });

    expect(initMsg().paramMap.pid).toEqual({ from: "static", value: "7654321" });
  });

  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootLinkedInInsight();

    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${LINKEDIN_COLLECT_ENDPOINT}?pid=x&fmt=gif`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: "GET" }));
  });

  it("a wired `consent` vector with ad_storage unresolved HOLDS a ready beacon (the gate engages once a host wires consent at all)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootLinkedInInsight({ consent: {} });
    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${LINKEDIN_COLLECT_ENDPOINT}?pid=x&fmt=gif`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "consent", disposition: "held", purpose: "ad_storage" }),
    );
    warnSpy.mockRestore();
  });

  it("handle.setConsent grants ad_storage mid-session and flushes the held GET beacon", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const handle = await bootLinkedInInsight({ consent: {} });

    const url = `${LINKEDIN_COLLECT_ENDPOINT}?pid=x&fmt=gif&conversionId=y`;
    FakeWorker.last.onmessage({ data: { ready: [{ url, method: "GET" }], dropped: [] } });
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent({ ad_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET" }));
  });

  it("a wired `payloadDenylist` strips the denied field before a pushed event crosses to the worker — input-side PII strip", async () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const handle = await bootLinkedInInsight({ payloadDenylist: ["email"] });

    handle.push({ event: "lead", email: "a@b.c", conversionValue: 42 });

    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events.batch[0].params.email).toBeUndefined(); // denied -> stripped
    expect(events.batch[0].params.conversionValue).toBe(42); // non-denied -> SELECTIVE strip: survives
  });

  it("consent denied + strict (AC5's third state) -> DROPPED, not held — nothing left to later flush", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handle = await bootLinkedInInsight({ consentStrict: true, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${LINKEDIN_COLLECT_ENDPOINT}?pid=x&fmt=gif`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "consent", disposition: "dropped" }),
    );

    warnSpy.mockClear();
    handle.setConsent({ ad_storage: "granted" }); // nothing was held -> no-op, no flush
    expect(fetchMock).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("endpoint-confined (AC5) — a ready request naming an off-declared origin is HELD at the seal, never fetched", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // Simulates what a compromised/misconfigured chamber returning an
    // off-declared-origin `ready` request would produce — the host ceiling
    // (declared from THIS boot's own connectorConfig.endpoint) must hold it
    // regardless of what the worker message claims, mirroring
    // test/pixel-seam.test.js's AC7 second case for Meta. bootLinkedInInsight
    // has no onDiagnostic passthrough (mirrors bootMetaPixel), so assert via
    // the default console diagnostic sink instead (core/airlock.js routes an
    // endpoint-ceiling hold at `level: "error"` -> console.error).
    await bootLinkedInInsight({ consent: { ad_storage: "granted" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    FakeWorker.last.onmessage({
      data: { ready: [{ url: "https://evil.example/collect?pid=x&fmt=gif", method: "GET" }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "endpoint-ceiling", disposition: "held" }),
    );
    errorSpy.mockRestore();
  });

  it("returns a working dispose() (no pushCritical exposed — unload-critical GET dispatch for pixels is a later slice)", async () => {
    const handle = await bootLinkedInInsight();

    expect(handle.pushCritical).toBeUndefined();
    expect(() => handle.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1);
  });
});
