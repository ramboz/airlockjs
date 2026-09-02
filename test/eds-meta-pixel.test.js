// Meta Pixel adapter wiring — spec 026-01 AC6 ("a matching `egressPurposes`
// wired for Meta in the adapter"). Mirrors adapters/eds/index.js's OWN GA4
// wiring pattern (DEFAULT_ENDPOINTS / GA4_EGRESS_PURPOSES / the `consent ?
// … : []` back-compat gate — see bootEdsAnalytics's doc comment) for Meta:
// bootMetaPixel() constructs a pixel-connector airlock instance from
// connectors/pixel/vendors/meta.js's config fixture, using the SAME
// FakeWorker harness test/eds-boot.test.js already uses.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootMetaPixel, META_EGRESS_PURPOSES } from "../adapters/eds/index.js";
import { META_TR_ENDPOINT, SYNTHETIC_META_PIXEL_ID } from "../connectors/pixel/vendors/meta.js";

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

describe("bootMetaPixel (spec 026-01 AC6 — the adapter's Meta wiring)", () => {
  it("declares META_EGRESS_PURPOSES as ad_storage — Meta's Consent Mode purpose (ADR-0007)", () => {
    expect(META_EGRESS_PURPOSES).toEqual(["ad_storage"]);
  });

  it("boots the PIXEL chamber with a SYNTHETIC pixel id by default — no live identifier", async () => {
    const handle = await bootMetaPixel();

    expect(FakeWorker.last.url.endsWith("pixel-chamber.worker.js")).toBe(true);
    const init = initMsg();
    expect(init.endpoint).toBe(META_TR_ENDPOINT);
    expect(init.paramMap.id).toEqual({ from: "static", value: SYNTHETIC_META_PIXEL_ID });
    expect(handle).toBeTruthy();
  });

  it("an explicit pixelId override crosses into the connector config verbatim", async () => {
    await bootMetaPixel({ pixelId: "999999999999999" });

    expect(initMsg().paramMap.id).toEqual({ from: "static", value: "999999999999999" });
  });

  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat, mirrors GA4's own gating)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootMetaPixel();

    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${META_TR_ENDPOINT}?id=x&ev=PageView`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ method: "GET" }));
  });

  it("a wired `consent` vector with ad_storage unresolved HOLDS a ready beacon (the gate engages once a host wires consent at all)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootMetaPixel({ consent: {} });
    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${META_TR_ENDPOINT}?id=x&ev=PageView`, method: "GET" }], dropped: [] },
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
    const handle = await bootMetaPixel({ consent: {} });

    const url = `${META_TR_ENDPOINT}?id=x&ev=Lead`;
    FakeWorker.last.onmessage({ data: { ready: [{ url, method: "GET" }], dropped: [] } });
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent({ ad_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method: "GET" }));
  });

  it("a wired `payloadDenylist` strips the denied field before a pushed event crosses to the worker", async () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const handle = await bootMetaPixel({ payloadDenylist: ["email"] });

    handle.push({ event: "lead", value: 5, email: "a@b.c" });

    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events.batch[0].params.email).toBeUndefined();
    expect(events.batch[0].params.value).toBe(5);
  });

  it("returns a working dispose() (no pushCritical exposed — unload-critical GET dispatch for pixels is a later slice)", async () => {
    const handle = await bootMetaPixel();

    expect(handle.pushCritical).toBeUndefined();
    expect(() => handle.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1);
  });
});
