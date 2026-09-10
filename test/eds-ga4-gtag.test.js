// bootGa4Gtag — the EDS adapter's gtag wiring, spec 041-01 AC4. Mirrors
// test/eds-boot.test.js's own ctx-sourcing/consent-wiring pattern for
// bootEdsAnalytics/bootGa4Core, and test/eds-meta-pixel.test.js's own
// no-pushCritical-exposed precedent (bootMetaPixel's doc comment: a
// worker-mapped, GET-egress connector has no main-thread critical mapper, so
// exposing pushCritical would route through the UNCONDITIONALLY-constructed
// GA4-MP critical dispatcher — a mis-map, not a beacon; the SAME reasoning
// applies verbatim to gtag, which is equally worker-mapped/GET-egress).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootGa4Gtag } from "../adapters/eds/index.js";
import { GA4_GTAG_COLLECT_ENDPOINT, createGa4GtagConnector } from "../connectors/ga4/gtag.js";

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

const fakeDocument = (initialCookie = "") => {
  const writes = [];
  return {
    writes,
    get cookie() { return initialCookie; },
    set cookie(v) { writes.push(v); },
    visibilityState: "visible",
  };
};

const initMsg = () => FakeWorker.last.messages.find((m) => m.type === "init");

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
});
afterEach(() => vi.unstubAllGlobals());

describe("bootGa4Gtag (spec 041-01 AC4 — the boot-happy-path skeleton)", () => {
  it("boots the GA4-GTAG chamber, ceiled to the /g/collect endpoint (NOT the MP DEFAULT_ENDPOINTS)", async () => {
    const ctx = { clientId: "1.1", sessionId: "2" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    expect(FakeWorker.last.url.endsWith("ga4-gtag-chamber.worker.js")).toBe(true);
    const init = initMsg();
    expect(init.measurementId).toBe("G-XXXX");
    expect(init.endpoint).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(init.ctx).toEqual(ctx);
  });

  it("an explicit opts.ctx override skips cookie sourcing entirely (rig/test escape hatch, mirrors bootGa4Core)", async () => {
    // NO document stub: if boot touched document.cookie despite the override,
    // the bare `document` reference would throw and fail this test.
    const provided = { clientId: "9.9", sessionId: "8" };

    const handle = await bootGa4Gtag({ ctx: provided, measurementId: "G-XXXX" });

    expect(handle).toBeTruthy();
    expect(initMsg().ctx).toEqual(provided);
  });

  it("sources ctx from the REAL _ga/_ga_<stream> cookies when no override is given (mirrors bootGa4Core's own sourcing)", async () => {
    vi.stubGlobal(
      "document",
      fakeDocument("_ga=GA1.1.5555555555.1600000000; _ga_TEST9=GS1.1.1699999999.3.1.1700000050.60.0.0"),
    );

    await bootGa4Gtag({ measurementId: "G-XXXX" });

    expect(initMsg().ctx).toEqual({ clientId: "5555555555.1600000000", sessionId: "1699999999" });
  });

  it("a real page_view drives a GET to /g/collect carrying v/tid/cid/sid (event -> connector.handle -> seal -> dispatcher)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    // Simulate the chamber's real response: the SAME gtag connector maps the event —
    // mirrors test/pixel-seam.test.js's `metaReady` pattern (never a hand-built URL).
    const connector = createGa4GtagConnector({ measurementId: "G-XXXX", ctx, endpoint: GA4_GTAG_COLLECT_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage({ data: { ready: [req], dropped: [] } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(GA4_GTAG_COLLECT_ENDPOINT);
    expect(parsed.searchParams.get("v")).toBe("2");
    expect(parsed.searchParams.get("tid")).toBe("G-XXXX");
    expect(parsed.searchParams.get("cid")).toBe(ctx.clientId);
    expect(parsed.searchParams.get("sid")).toBe(String(ctx.sessionId));
  });

  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat, mirrors GA4/pixel's own gating)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1.1", sessionId: "2" };
    await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${GA4_GTAG_COLLECT_ENDPOINT}?tid=G-XXXX`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a wired `consent` vector with analytics_storage unresolved HOLDS a ready beacon (the gate engages once a host wires consent at all)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = { clientId: "1.1", sessionId: "2" };

    await bootGa4Gtag({ ctx, measurementId: "G-XXXX", consent: {} });
    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${GA4_GTAG_COLLECT_ENDPOINT}?tid=G-XXXX`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "consent", disposition: "held", purpose: "analytics_storage" }),
    );
    warnSpy.mockRestore();
  });

  it("handle.setConsent grants analytics_storage mid-session and flushes the held GET beacon", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const ctx = { clientId: "1.1", sessionId: "2" };
    const handle = await bootGa4Gtag({ ctx, measurementId: "G-XXXX", consent: {} });

    const url = `${GA4_GTAG_COLLECT_ENDPOINT}?tid=G-XXXX`;
    FakeWorker.last.onmessage({ data: { ready: [{ url, method: "GET" }], dropped: [] } });
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET" }));
  });

  it("a wired `payloadDenylist` strips the denied field before a pushed event crosses to the worker", async () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const ctx = { clientId: "1.1", sessionId: "2" };
    const handle = await bootGa4Gtag({ ctx, measurementId: "G-XXXX", payloadDenylist: ["email"] });

    handle.push({ event: "lead", value: 5, email: "a@b.c" });

    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events.batch[0].params.email).toBeUndefined();
    expect(events.batch[0].params.value).toBe(5);
  });

  it("returns a working dispose() and no pushCritical (a worker-mapped GET connector has no main-thread critical mapper, mirrors bootMetaPixel)", async () => {
    const ctx = { clientId: "1.1", sessionId: "2" };
    const handle = await bootGa4Gtag({ ctx, measurementId: "G-XXXX" });

    expect(handle.pushCritical).toBeUndefined();
    expect(() => handle.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1);
  });
});
