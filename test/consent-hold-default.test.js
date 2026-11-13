// Spec 067-02 (ADR-0062 exception a, owner decisions D2/D4): every createAirlock
// track holds until consent is explicitly given, even with no consent input.
// `consentHold: false` is the per-connector opt-out.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { boot as bootConfig, bootEdsAnalytics, bootGa4Gtag, bootMetaPixel, bootHelixRum } from "../adapters/eds/index.js";
import { createAirlock } from "../core/airlock.js";

class FakeWorker {
  constructor() {
    FakeWorker.last = this;
    FakeWorker.all.push(this);
    this.messages = [];
    this.onmessage = null;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

const GA4 = "https://www.google-analytics.com/mp/collect";
const ready = (n = 1, url = GA4) => ({
  data: { ready: Array.from({ length: n }, (_, i) => ({ url, method: "POST", body: `{"i":${i}}` })), dropped: [] },
});
const stubWebVitals = () => ({ onLCP() {}, onCLS() {}, onINP() {} });

let fetchMock;
beforeEach(() => {
  FakeWorker.last = null;
  FakeWorker.all = [];
  fetchMock = vi.fn(() => Promise.resolve());
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("document", { cookie: "_ga=GA1.1.5555555555.1600000000", visibilityState: "visible", referrer: "" });
  vi.stubGlobal("requestIdleCallback", () => {});
});
afterEach(() => vi.unstubAllGlobals());

const boot = (opts = {}) => {
  const onDiagnostic = vi.fn();
  return bootEdsAnalytics({ ctx: { clientId: "1.1", sessionId: "2" }, onDiagnostic, ...opts }).then((handle) => ({ handle, onDiagnostic }));
};
const noInputWarnings = (d) =>
  d.mock.calls.map((c) => c[0]).filter((x) => x.kind === "consent" && /no consent input wired/.test(x.reason ?? ""));

describe("067-02 AC1 — no consent input: hold and warn once", () => {
  it("holds, sends nothing, and warns once per airlock (not per beacon)", async () => {
    const { onDiagnostic } = await boot();
    FakeWorker.last.onmessage(ready(3));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(noInputWarnings(onDiagnostic)).toHaveLength(1);
    expect(onDiagnostic.mock.calls.filter((c) => c[0].disposition === "held")).toHaveLength(4);
  });

  it("does not warn when setConsent was called before the first held beacon", async () => {
    const { handle, onDiagnostic } = await boot();
    handle.setConsent({ ad_storage: "pending" });
    FakeWorker.last.onmessage(ready());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(noInputWarnings(onDiagnostic)).toHaveLength(0);
  });

  it("does not warn when a consent vector is wired at boot", async () => {
    const { onDiagnostic } = await boot({ consent: {} });
    FakeWorker.last.onmessage(ready());

    expect(noInputWarnings(onDiagnostic)).toHaveLength(0);
  });

  it("holds the other tracks too (gtag and a pixel)", async () => {
    await bootGa4Gtag({ measurementId: "G-XXXX", onDiagnostic: vi.fn() });
    FakeWorker.last.onmessage({ data: { ready: [{ url: "https://www.google-analytics.com/g/collect?v=2", method: "GET" }], dropped: [] } });
    await bootMetaPixel({ onDiagnostic: vi.fn() });
    FakeWorker.last.onmessage({ data: { ready: [{ url: "https://www.facebook.com/tr?id=1", method: "GET" }], dropped: [] } });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("067-02 AC2 — helix-rum is not held without consent input", () => {
  it("sends with no consent input and raises no no-input warning", () => {
    const onDiagnostic = vi.fn();
    bootHelixRum({ weight: 100, forceSelect: true, onDiagnostic, ...stubWebVitals() });
    FakeWorker.last.onmessage({ data: { ready: [{ url: "https://ot.aem.live/.rum/100", method: "POST", body: "{}" }], dropped: [] } });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(noInputWarnings(onDiagnostic)).toHaveLength(0);
  });
});

describe("067-02 AC3 — a later grant flushes the held events", () => {
  it("flushes on grant", async () => {
    const { handle } = await boot();
    FakeWorker.last.onmessage(ready(2));
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("067-02 AC4 — the hold ring is capped", () => {
  it("drops the oldest past the cap with a diagnostic, and flushes the newest", async () => {
    const { handle, onDiagnostic } = await boot();
    FakeWorker.last.onmessage(ready(201));

    const dropped = onDiagnostic.mock.calls.map((c) => c[0]).filter((x) => x.disposition === "dropped");
    expect(dropped).toHaveLength(1);
    expect(dropped[0].reason).toMatch(/cap 200/);

    handle.setConsent({ analytics_storage: "granted" });
    expect(fetchMock).toHaveBeenCalledTimes(200);
    expect(fetchMock.mock.calls.some((c) => c[1].body === '{"i":0}')).toBe(false);
    expect(fetchMock.mock.calls.some((c) => c[1].body === '{"i":200}')).toBe(true);
  });
});

describe("067-02 AC5 — consentHold:false is a per-connector, strict-boolean opt-out", () => {
  it("sends as stock does and warns once at construction that the hold is off", async () => {
    const { onDiagnostic } = await boot({ consentHold: false });
    FakeWorker.last.onmessage(ready(2));

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const off = onDiagnostic.mock.calls.map((c) => c[0]).filter((x) => x.disposition === "hold-off");
    expect(off).toHaveLength(1);
    expect(off[0]).toMatchObject({ level: "warn", kind: "consent" });
  });

  it("only the exact value false turns it off: truthy non-booleans keep the hold on", async () => {
    for (const v of [true, "false", 0, "off", 1]) {
      FakeWorker.last = null;
      fetchMock.mockClear();
      await boot({ consentHold: v });
      FakeWorker.last.onmessage(ready());
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });

  it("the switch is per connector: turning it off on one leaves another held", async () => {
    await bootMetaPixel({ consentHold: false, onDiagnostic: vi.fn() });
    const meta = FakeWorker.last;
    await boot();
    FakeWorker.last.onmessage(ready());
    expect(fetchMock).not.toHaveBeenCalled();
    meta.onmessage({ data: { ready: [{ url: "https://www.facebook.com/tr?id=1", method: "GET" }], dropped: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("boot(config): a per-entry consentHold:false reaches the connector; a sibling entry stays held", async () => {
    await bootConfig({
      connectors: [
        { type: "ga4", ctx: { clientId: "1.1", sessionId: "2" }, consentHold: false },
        { type: "pixel", vendor: "meta", pixelId: "1234567890" },
      ],
    });
    const [ga4, meta] = FakeWorker.all;
    meta.onmessage({ data: { ready: [{ url: "https://www.facebook.com/tr?id=1", method: "GET" }], dropped: [] } });
    expect(fetchMock).not.toHaveBeenCalled();
    ga4.onmessage(ready());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("with the hold off but a consent vector wired, the seal still applies", async () => {
    await boot({ consentHold: false, consent: {} });
    FakeWorker.last.onmessage(ready());
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("067-02 AC6/AC7 — wired consent behaves as before", () => {
  it("pending holds, granted sends, denied (non-strict) sends", async () => {
    await boot({ consent: {} });
    FakeWorker.last.onmessage(ready());
    expect(fetchMock).not.toHaveBeenCalled();

    await boot({ consent: { analytics_storage: "granted" } });
    FakeWorker.last.onmessage(ready());
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await boot({ consent: { analytics_storage: "denied" } });
    FakeWorker.last.onmessage(ready());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("core createAirlock with no purposes declared is unaffected by the hold", () => {
    const a = createAirlock({ trackers: [], onDiagnostic: vi.fn() });
    expect(a).toBeTruthy();
  });
});
