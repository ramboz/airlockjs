// bootHelixRum — the production RUM authority (spec 030-02). Boots airlock as the
// page's governed RUM authority (top/error/cwv, confined to ot.aem.live, NOT
// consent-gated); the main-thread-minted sampling drives the worker connector +
// the endpoint ceiling + the unload mapper. web-vitals subscribers are DI'd (stubs
// here). Synthetic identifiers only. Mirrors test/pixel-seam.test.js's FakeWorker.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootHelixRum } from "../adapters/eds/index.js";
import { rumUrl, resolveWeight } from "../connectors/helix-rum/map.js";

class FakeWorker {
  constructor(url) { FakeWorker.last = this; this.url = String(url); this.messages = []; this.onmessage = null; this.onerror = null; }
  postMessage(m) { this.messages.push(m); }
  terminate() {}
}

// the SAME `{ ready, dropped }` envelope a real helix-rum chamber posts back for a
// steady-state batch — drive it into the airlock's onmessage to exercise the seal/ceiling
// path (test/pixel-seam.test.js's readyMsg shape). `ready` is EgressRequest[] (`{ url, body }`).
const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

// a stub web-vitals/attribution — records the subscriber callbacks so a test can fire a metric.
function stubWebVitals() {
  const cbs = {};
  return { onLCP: (cb) => { cbs.lcp = cb; }, onCLS: (cb) => { cbs.cls = cb; }, onINP: (cb) => { cbs.inp = cb; }, cbs };
}

describe("bootHelixRum — the production RUM authority (030-02)", () => {
  let listeners;
  beforeEach(() => {
    FakeWorker.last = null;
    listeners = {};
    vi.stubGlobal("Worker", FakeWorker);
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));
    vi.stubGlobal("addEventListener", (type, fn) => { (listeners[type] ||= []).push(fn); });
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("document", { visibilityState: "hidden", referrer: "https://ref.example/" });
    vi.stubGlobal("requestIdleCallback", () => {}); // no-op -> pushed events stay in the ring (undrained)
  });
  afterEach(() => vi.unstubAllGlobals());

  it("AC1/AC2 — boots the helix-rum chamber with egressPurposes:[] + the main-thread-minted sampling in the init", () => {
    const wv = stubWebVitals();
    const h = bootHelixRum({ weight: 100, forceSelect: true, ...wv });
    expect(h.sampled).toBe(true);
    expect(FakeWorker.last.url).toContain("helix-rum-chamber.worker.js"); // the RUM chamber, not GA4/pixel/dom
    const init = FakeWorker.last.messages[0];
    expect(init.type).toBe("init");
    expect(init.weight).toBe(100);
    expect(init.isSelected).toBe(true); // main-thread selection passed to the worker
    expect(init.sampling).toMatchObject({ weight: 100 }); // drives the main-thread unload mapper
    expect(typeof init.id).toBe("string"); // the per-page id, minted main-side
    expect(init.id).toBe(init.sampling.id); // main↔worker agree on the SAME id
  });

  it("AC3 — top on load + cwv wired via the web-vitals subscribers; the page-hide INP egresses a RUM beacon", () => {
    const wv = stubWebVitals();
    bootHelixRum({ weight: 100, forceSelect: true, referer: "https://site.example/p", ...wv });
    expect(wv.cbs.inp).toBeTypeOf("function"); // startCwvCapture wired onINP
    wv.cbs.inp({ name: "INP", value: 8 }); // a finalized INP metric -> push({event:"cwv"}) -> ring

    listeners.visibilitychange[0](); // fire the REAL unload path -> unloadFlush -> mapToRum (030-01)
    // among the flushed beacons (top + cwv), find the RUM cwv beacon to ot.aem.live
    const calls = globalThis.fetch.mock.calls;
    const rum = calls.map(([url, init]) => ({ url: String(url), body: JSON.parse(init.body) }));
    expect(rum.length).toBeGreaterThan(0);
    expect(rum.every((r) => r.url.includes("ot.aem.live"))).toBe(true); // confined
    const cwv = rum.find((r) => r.body.checkpoint === "cwv");
    expect(cwv).toBeTruthy();
    expect(cwv.body).not.toHaveProperty("client_id"); // RUM shape (mapToRum), NOT a GA4 mis-map
    expect(cwv.body.t).toBeGreaterThan(0); // 030-01's ts fix — not t:0
    const top = rum.find((r) => r.body.checkpoint === "top");
    expect(top).toBeTruthy(); // top-on-load also egressed
  });

  it("AC2 — endpoint-ceiling coupling: the connector's OWN resolved endpoint (rumUrl(base,weight)) is ADMITTED by the host ceiling — no self-inflicted hold", () => {
    bootHelixRum({ weight: 100, forceSelect: true, ...stubWebVitals() });
    // what the REAL worker connector hands back for a steady-state beacon: url == rumUrl(collectBaseURL, weight),
    // the same value bootHelixRum passed as the host `endpoints` ceiling. Main↔worker agree by construction;
    // this asserts they ACTUALLY match (a divergence would be ceiling-HELD -> zero beacons, the 022 footgun).
    const ceiling = rumUrl("https://ot.aem.live", resolveWeight({ weight: 100 })); // https://ot.aem.live/.rum/100
    FakeWorker.last.onmessage(readyMsg([{ url: ceiling, body: '{"checkpoint":"top","weight":100}' }]));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1); // admitted (coupling holds) — AND with NO setConsent, proving egressPurposes:[]
    expect(String(globalThis.fetch.mock.calls[0][0])).toBe(ceiling);
  });

  it("AC2/AC4 — confinement: a steady-state beacon re-pointed OFF the ceiling is HELD, even though the worker asked to send it", () => {
    bootHelixRum({ weight: 100, forceSelect: true, ...stubWebVitals() });
    // a compromised/misconfigured chamber cannot widen egress: the host ceiling is ot.aem.live/.rum/100 only.
    FakeWorker.last.onmessage(readyMsg([{ url: "https://evil.example/.rum/100", body: "{}" }]));
    expect(globalThis.fetch).not.toHaveBeenCalled(); // held at the seal — the connector cannot self-widen the ceiling
  });

  it("AC4 — NOT consent-gated: the beacon egressed above with NO consent wired (egressPurposes:[])", () => {
    // The AC3 boot passed no `consent` and no `egressPurposes`, yet the unload beacon fired —
    // the RUM governance class (confined, not-consent-gated). Re-assert the property directly:
    const wv = stubWebVitals();
    bootHelixRum({ weight: 100, forceSelect: true, ...wv });
    wv.cbs.inp({ name: "INP", value: 8 });
    listeners.visibilitychange[0]();
    expect(globalThis.fetch).toHaveBeenCalled(); // fired despite no consent (would be HELD if consent-gated)
  });

  it("an UNSELECTED page-load emits NOTHING (sampleRUM parity) and constructs no airlock", () => {
    const h = bootHelixRum({ weight: 100, forceSelect: false, ...stubWebVitals() });
    expect(h.sampled).toBe(false);
    expect(FakeWorker.last).toBeNull(); // no createAirlock at all
    h.push({ event: "top" }); // inert
    listeners.visibilitychange = listeners.visibilitychange || [];
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("AC5 — no live identifiers: the per-page id is a synthetic crypto.randomUUID slice; the endpoint is ot.aem.live", () => {
    const h = bootHelixRum({ weight: 100, forceSelect: true, ...stubWebVitals() });
    const init = FakeWorker.last.messages[0];
    expect(init.id).toMatch(/^[0-9a-f-]{9}$/i); // ephemeral, not a live/persistent identifier
    expect(init.collectBaseURL).toBe("https://ot.aem.live");
    expect(h.sampled).toBe(true);
  });
});
