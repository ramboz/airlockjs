// Bing UET adapter wiring — spec 026-02 AC2/AC5/AC6. Mirrors
// test/eds-linkedin-pixel.test.js / test/eds-meta-pixel.test.js's OWN pattern
// verbatim (the SAME FakeWorker harness, the SAME `consent ? … : []`
// back-compat gate proof, the SAME payloadDenylist input-side-strip proof,
// the SAME endpoint-confinement proof) for `bootBingUet`.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootBingUet, BING_EGRESS_PURPOSES } from "../adapters/eds/index.js";
import { BING_UET_ENDPOINT, SYNTHETIC_BING_TAG_ID } from "../connectors/pixel/vendors/bing.js";

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

describe("bootBingUet (spec 026-02 AC2 — the adapter's Bing UET wiring)", () => {
  it("declares BING_EGRESS_PURPOSES as ad_storage — an ads/remarketing signal (ADR-0007)", () => {
    expect(BING_EGRESS_PURPOSES).toEqual(["ad_storage"]);
  });

  it("boots the PIXEL chamber with a SYNTHETIC tag id by default — no live identifier", async () => {
    const handle = await bootBingUet();

    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(true);
    const init = initMsg();
    expect(init.endpoint).toBe(BING_UET_ENDPOINT);
    expect(init.paramMap.ti).toEqual({ from: "static", value: SYNTHETIC_BING_TAG_ID });
    expect(handle).toBeTruthy();
  });

  it("an explicit tagId override crosses into the connector config verbatim", async () => {
    await bootBingUet({ tagId: "87654321" });

    expect(initMsg().paramMap.ti).toEqual({ from: "static", value: "87654321" });
  });

  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootBingUet();

    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${BING_UET_ENDPOINT}?ti=x&evt=pageLoad`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: "GET" }));
  });

  it("a wired `consent` vector with ad_storage unresolved HOLDS a ready beacon (the gate engages once a host wires consent at all)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootBingUet({ consent: {} });
    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${BING_UET_ENDPOINT}?ti=x&evt=pageLoad`, method: "GET" }], dropped: [] },
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
    const handle = await bootBingUet({ consent: {} });

    const url = `${BING_UET_ENDPOINT}?ti=x&evt=custom&gv=25`;
    FakeWorker.last.onmessage({ data: { ready: [{ url, method: "GET" }], dropped: [] } });
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent({ ad_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET" }));
  });

  it("a wired `payloadDenylist` strips the denied field before a pushed event crosses to the worker — input-side PII strip", async () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const handle = await bootBingUet({ payloadDenylist: ["email"] });

    handle.push({ event: "lead", value: 25, email: "a@b.c" });

    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events.batch[0].params.email).toBeUndefined();
    expect(events.batch[0].params.value).toBe(25);
  });

  it("consent denied + strict (AC5's third state) -> DROPPED, not held — nothing left to later flush", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const handle = await bootBingUet({ consentStrict: true, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${BING_UET_ENDPOINT}?ti=x&evt=pageLoad`, method: "GET" }], dropped: [] },
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
    // Mirrors test/eds-linkedin-pixel.test.js's own endpoint-confinement
    // proof: the host ceiling (declared from THIS boot's own
    // connectorConfig.endpoint) must hold an off-declared-origin `ready`
    // request regardless of what the worker message claims.
    await bootBingUet({ consent: { ad_storage: "granted" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    FakeWorker.last.onmessage({
      data: { ready: [{ url: "https://evil.example/action/0?ti=x&evt=pageLoad", method: "GET" }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "endpoint-ceiling", disposition: "held" }),
    );
    errorSpy.mockRestore();
  });

  it("returns a working dispose() (no pushCritical exposed — unload-critical GET dispatch for pixels is a later slice)", async () => {
    const handle = await bootBingUet();

    expect(handle.pushCritical).toBeUndefined();
    expect(() => handle.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1);
  });
});
