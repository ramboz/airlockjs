// Config-driven boot — spec 032-01 (the `boot(config)` connector-dispatch +
// composite lifecycle). Behavioral tests over the SAME FakeWorker harness the
// per-function boot tests use (test/eds-boot.test.js / test/eds-meta-pixel.test.js),
// but tracking EVERY constructed worker (a multi-connector boot spins up one worker
// per connector), so a composite dispose/re-boot can be shown to tear down ALL of
// them (AC4's 021-01 no-leak invariant, now across the whole config).
//
// Byte-equivalence of the createAirlock INPUTS (AC2 pixel collapse; AC3 governance
// parity + the helix-rum carve-out) is proven separately in
// test/eds-boot-config-equivalence.test.js (which mocks createAirlock to capture
// its argument object) — this file proves the OBSERVABLE runtime behavior.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { boot, bootEdsAnalytics } from "../adapters/eds/index.js";
import { META_TR_ENDPOINT } from "../connectors/pixel/vendors/meta.js";
import { rumUrl, resolveWeight } from "../connectors/helix-rum/map.js";

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.instances.push(this);
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
    this.terminated = 0;
  }
  postMessage(m) { this.messages.push(m); }
  terminate() { this.terminated++; }
}
FakeWorker.instances = [];

// A GA4 chamber URL ends `/chamber.worker.js`; the pixel/helix chambers carry a
// vendor prefix (`pixel-chamber.worker.js`, `helix-rum-chamber.worker.js`), so the
// leading-slash match is unambiguous.
const ga4Worker = () => FakeWorker.instances.find((w) => w.url.endsWith("/chamber.worker.js"));
const pixelWorker = () => FakeWorker.instances.find((w) => w.url.includes("pixel-chamber.worker.js"));
const helixWorker = () => FakeWorker.instances.find((w) => w.url.includes("helix-rum-chamber.worker.js"));
const initOf = (w) => w.messages.find((m) => m.type === "init");
const eventsOf = (w) => w.messages.find((m) => m.type === "events");
// every event `type` that actually crossed to a worker (across all drained batches)
const crossedTypes = (w) => w.messages.filter((m) => m.type === "events").flatMap((m) => m.batch.map((d) => d.type));

const collectUrl = "https://www.google-analytics.com/mp/collect"; // DEFAULT_ENDPOINTS[0]
const gaCtx = { clientId: "1.1", sessionId: "2" }; // provided -> skips cookie sourcing (no document needed)
const readyGa = (body) => ({ data: { ready: [{ url: collectUrl, body }], dropped: [] } });
const metaUrl = `${META_TR_ENDPOINT}?id=x&ev=PageView`;
const readyMeta = () => ({ data: { ready: [{ url: metaUrl, method: "GET" }], dropped: [] } });

function stubWebVitals() {
  const cbs = {};
  return { onLCP: (cb) => { cbs.lcp = cb; }, onCLS: (cb) => { cbs.cls = cb; }, onINP: (cb) => { cbs.inp = cb; }, cbs };
}

// A registry that both records and can be counted/fired — used for the bare-global
// addEventListener/removeEventListener createAirlock wires (visibilitychange/pagehide).
function makeReg() {
  const m = {};
  return {
    add(t, f) { (m[t] ||= []).push(f); },
    remove(t, f) { if (m[t]) m[t] = m[t].filter((x) => x !== f); },
    count(t) { return (m[t] || []).length; },
    fire(t, e) { (m[t] || []).forEach((f) => f(e)); },
  };
}

beforeEach(() => {
  FakeWorker.instances = [];
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
  vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
});
afterEach(() => vi.unstubAllGlobals());

describe("boot(config) — AC1: a ga4 config entry boots GA4 equivalently to bootEdsAnalytics()", () => {
  let reg;
  let doc;
  beforeEach(() => {
    reg = makeReg();
    vi.stubGlobal("addEventListener", reg.add);
    vi.stubGlobal("removeEventListener", reg.remove);
    vi.stubGlobal("window", {});
    vi.stubGlobal("location", { href: "http://localhost:3111/" });
    // A document with addEventListener (so wireInteractions/wireExposure wire), but
    // NO querySelector (wireBlocks no-ops) and NO body (wireExposure's body read
    // no-ops) — the minimal DOM that lets the UC-2 click path wire.
    const clicks = {};
    doc = {
      visibilityState: "visible",
      addEventListener(type, fn) { (clicks[type] ||= []).push(fn); },
      removeEventListener() {},
      __listeners: clicks,
      fireClick(target) { (clicks.click || []).forEach((fn) => fn({ target })); },
    };
    // wireInteractions reads global window for `win`; give it an addEventListener.
    window.addEventListener = () => {};
    vi.stubGlobal("document", doc);
  });

  const fakeEngageEl = (text) => {
    const el = { textContent: text };
    el.closest = (sel) => (sel === "#cta-engage" ? el : null);
    return el;
  };

  it("sets window.airlock to a composite over the public write surface, and wires the ctx through createAirlock", async () => {
    const handle = await boot({ connectors: [{ type: "ga4", ctx: gaCtx }] });

    expect(handle).toBe(window.airlock); // the composite owns the singleton slot (AC4)
    for (const m of ["push", "pushCritical", "setConsent", "getState", "flushNow", "stats", "dispose"]) {
      expect(typeof handle[m]).toBe("function");
    }
    // the ga4 chamber booted and the provided ctx crossed the airlock (the config
    // path reached the same createAirlock the async _ga sourcing / consent fold feeds)
    expect(ga4Worker()).toBeTruthy();
    expect(initOf(ga4Worker()).ctx).toEqual(gaCtx);
  });

  it("wires the UC-2 interaction path: a #cta-engage click flows to the ga4 chamber", async () => {
    await boot({ connectors: [{ type: "ga4", ctx: gaCtx }] });

    // capture wired: the delegated document click listener is present
    expect(document.__listeners.click).toHaveLength(1);

    document.fireClick(fakeEngageEl("See pricing")); // steady-state push -> ring -> drain
    const events = eventsOf(ga4Worker());
    expect(events).toBeTruthy();
    expect(events.batch.some((d) => d.type === "cta_engage")).toBe(true);
  });

  it("a beacon fires: the ga4 chamber's ready request egresses via fetch", async () => {
    await boot({ connectors: [{ type: "ga4", ctx: gaCtx }] });

    ga4Worker().onmessage(readyGa("{}"));
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(collectUrl, expect.objectContaining({ body: "{}" }));
  });
});

describe("boot(config) — AC4: the composite owns window.airlock with a unified no-leak lifecycle", () => {
  let reg;
  beforeEach(() => {
    reg = makeReg();
    vi.stubGlobal("addEventListener", reg.add);
    vi.stubGlobal("removeEventListener", reg.remove);
    vi.stubGlobal("window", {});
  });

  it("dispose() tears down EVERY booted connector's worker (both GA4 and the pixel)", async () => {
    await boot({ connectors: [{ type: "ga4", ctx: gaCtx }, { type: "pixel", vendor: "meta", pixelId: "999" }] });
    const ga = ga4Worker();
    const px = pixelWorker();
    expect(ga).toBeTruthy();
    expect(px).toBeTruthy();

    window.airlock.dispose();

    expect(ga.terminated).toBe(1);
    expect(px.terminated).toBe(1); // the pixel worker is torn down too — not GA4-only
  });

  // Seeded red->green regression (frame-critique's core fix): under the OLD
  // GA4-only `window.airlock` ownership, a re-boot would dispose only the GA4
  // instance and LEAK the prior pixel Worker. With the composite owning the slot,
  // a re-boot disposes the ENTIRE prior composite first — so the prior pixel worker
  // IS terminated (this assertion is what goes red if ownership regresses to GA4-only).
  it("re-boot disposes the ENTIRE prior composite first — the prior pixel Worker does not leak", async () => {
    const config = () => ({ connectors: [{ type: "ga4", ctx: gaCtx }, { type: "pixel", vendor: "meta", pixelId: "999" }] });
    const first = await boot(config());
    const priorGa = FakeWorker.instances[0];
    const priorPixel = FakeWorker.instances[1];
    expect(priorGa.url.endsWith("/chamber.worker.js")).toBe(true);
    expect(priorPixel.url.includes("pixel-chamber.worker.js")).toBe(true);

    const second = await boot(config());

    expect(second).not.toBe(first);
    expect(priorGa.terminated).toBe(1); // prior GA4 disposed
    expect(priorPixel.terminated).toBe(1); // prior PIXEL disposed too (the no-leak fix)
    // the live composite's workers are untouched
    expect(FakeWorker.instances[2].terminated).toBe(0);
    expect(FakeWorker.instances[3].terminated).toBe(0);
    expect(window.airlock).toBe(second);
  });

  it("setConsent(v) fans out to EVERY consent-governed connector — it reaches the pixel, not only GA4", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await boot({
      connectors: [{ type: "ga4", ctx: gaCtx }, { type: "pixel", vendor: "meta", pixelId: "999" }],
      consent: {}, // both GA4 (analytics_storage) and the pixel (ad_storage) hold until granted
    });

    ga4Worker().onmessage(readyGa('{"x":1}')); // held at the seal
    pixelWorker().onmessage(readyMeta()); // held at the seal
    expect(fetchMock).not.toHaveBeenCalled();

    window.airlock.setConsent({ analytics_storage: "granted", ad_storage: "granted" });

    // both held beacons flush -> the pixel URL among them proves setConsent reached the pixel
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(collectUrl);
    expect(urls).toContain(metaUrl);
    warnSpy.mockRestore();
  });
});

describe("boot(config) — AC5: an end-to-end multi-connector (GA4 + pixel) boot", () => {
  beforeEach(() => {
    vi.stubGlobal("addEventListener", () => {});
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("window", {});
  });

  it("boots each declared connector and each beacon path fires; push() fans out to both", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    await boot({ connectors: [{ type: "ga4", ctx: gaCtx }, { type: "pixel", vendor: "meta", pixelId: "999" }] });

    // both connectors booted (one worker each)
    expect(ga4Worker()).toBeTruthy();
    expect(pixelWorker()).toBeTruthy();

    // fan-out: one composite push reaches BOTH connectors (each mapper then decides)
    window.airlock.push({ event: "page_view" });
    expect(eventsOf(ga4Worker()).batch.some((d) => d.type === "page_view")).toBe(true);
    expect(eventsOf(pixelWorker()).batch.some((d) => d.type === "page_view")).toBe(true);

    // each beacon PATH fires: drive each chamber's ready request and see it egress
    ga4Worker().onmessage(readyGa("{}"));
    pixelWorker().onmessage(readyMeta());
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls).toContain(collectUrl);
    expect(urls).toContain(metaUrl);
  });

  it("getState delegates to the first booted connector (documented read semantics)", async () => {
    await boot({ connectors: [{ type: "ga4", ctx: gaCtx }, { type: "pixel", vendor: "meta", pixelId: "999" }] });
    window.airlock.push({ event: "page_view", page_location: "http://x/" });

    // the composite's projection read comes from connector[0] (GA4 here)
    expect(window.airlock.getState("page_view.params.page_location")).toBe("http://x/");
  });
});

describe("boot(config) — AC3: helix-rum keeps its spec-022 governance class (config does NOT gate it)", () => {
  let listeners;
  beforeEach(() => {
    listeners = {};
    vi.stubGlobal("addEventListener", (type, fn) => { (listeners[type] ||= []).push(fn); });
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { visibilityState: "hidden", referrer: "https://ref.example/" });
  });

  it("a helix-rum entry is NOT consent-gated even under top-level consent — its steady-state beacon egresses", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    // no-op idle so the boot-time `top` push stays in the ring and does not interfere
    vi.stubGlobal("requestIdleCallback", () => {});

    await boot({
      connectors: [{ type: "helix-rum", weight: 100, forceSelect: true, ...stubWebVitals() }],
      consent: {}, // a consent-governed connector would HOLD every beacon here
      payloadDenylist: ["email"], // and would strip — helix must ignore both
    });

    const ceiling = rumUrl("https://ot.aem.live", resolveWeight({ weight: 100 }));
    helixWorker().onmessage({ data: { ready: [{ url: ceiling, body: '{"checkpoint":"top"}' }], dropped: [] } });

    // egressed despite top-level consent:{} -> egressPurposes stayed [] (the carve-out)
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(ceiling);
  });
});

// AC1's byte-equivalence anchor: a ga4-only config yields the SAME public surface
// bootEdsAnalytics exposes (a superset check — the composite wraps a single GA4
// connector, so every method the standalone handle has is present on the composite).
describe("boot(config) — AC1: parity of the public surface with bootEdsAnalytics", () => {
  beforeEach(() => {
    vi.stubGlobal("addEventListener", () => {});
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("window", {});
  });

  it("exposes every method bootEdsAnalytics's handle exposes", async () => {
    const standalone = await bootEdsAnalytics({ ctx: gaCtx });
    const composite = await boot({ connectors: [{ type: "ga4", ctx: gaCtx }] });
    for (const key of Object.keys(standalone)) {
      expect(typeof composite[key]).toBe(typeof standalone[key]);
    }
  });
});

// Craft-review BLOCKER: the composite fan-out must be GATED by each connector's
// declared `manifest.events`. helix-rum's `mapToRum` turns ANY event.type into an
// `ot.aem.live` checkpoint, so an arbitrary site event fanned to it would LEAK to
// the RUM collector. The gate delivers a `push`/`pushCritical` to a connector only
// if its events is `["*"]` (GA4's analytics catch-all) OR includes `evt.event`.
describe("boot(config) — fan-out gate: composite.push honors each connector's manifest.events", () => {
  let listeners;
  beforeEach(() => {
    listeners = {};
    vi.stubGlobal("addEventListener", (type, fn) => { (listeners[type] ||= []).push(fn); });
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("window", {});
    vi.stubGlobal("document", { visibilityState: "visible", referrer: "https://ref.example/" });
  });

  it("an arbitrary site event fans to GA4 (catch-all) but NOT to helix-rum (its vocab is top/error/cwv only)", async () => {
    await boot({
      connectors: [
        { type: "ga4", ctx: gaCtx },
        { type: "helix-rum", weight: 100, forceSelect: true, ...stubWebVitals() },
      ],
    });

    window.airlock.push({ event: "newsletter_signup" }); // a site event that is NOT a RUM checkpoint

    // GA4 is the declared catch-all -> it receives the event
    expect(crossedTypes(ga4Worker())).toContain("newsletter_signup");
    // helix-rum's own capture still works (top crossed at boot), proving the gate is
    // on the COMPOSITE fan-out only, not helix's own handle...
    expect(crossedTypes(helixWorker())).toContain("top");
    // ...but the arbitrary site event NEVER reaches the RUM chamber (no leaked checkpoint)
    expect(crossedTypes(helixWorker())).not.toContain("newsletter_signup");
  });

  it("a checkpoint-vocab event (top) DOES fan to helix-rum (the gate accepts declared events)", async () => {
    await boot({
      connectors: [
        { type: "ga4", ctx: gaCtx },
        { type: "helix-rum", weight: 100, forceSelect: true, ...stubWebVitals() },
      ],
    });
    // isolate the composite-delivered "top" from helix's own boot-time "top": count them
    const before = crossedTypes(helixWorker()).filter((t) => t === "top").length;

    window.airlock.push({ event: "top" }); // in helix-rum's declared vocabulary

    expect(crossedTypes(helixWorker()).filter((t) => t === "top").length).toBe(before + 1);
    expect(crossedTypes(ga4Worker())).toContain("top"); // GA4 catch-all gets it too
  });
});

// Craft-review nit: a partial-boot throw must not orphan already-booted connectors'
// Workers (the 021-01 no-leak invariant AC4 establishes — it must hold on the error
// path too). boot() disposes what it already booted before rethrowing.
describe("boot(config) — partial-boot cleanup: a later entry's throw disposes earlier connectors", () => {
  beforeEach(() => {
    vi.stubGlobal("addEventListener", () => {});
    vi.stubGlobal("removeEventListener", () => {});
    vi.stubGlobal("window", {});
  });

  it("an unknown connector type rejects AND the already-booted GA4 Worker is disposed (no orphan)", async () => {
    await expect(
      boot({ connectors: [{ type: "ga4", ctx: gaCtx }, { type: "nonsense" }] }),
    ).rejects.toThrow(/unknown connector type/);

    // the ga4 connector booted first, then the nonsense entry threw — its Worker must
    // have been torn down in the cleanup, not left running
    expect(ga4Worker()).toBeTruthy();
    expect(ga4Worker().terminated).toBe(1);
    expect(typeof window.airlock).toBe("undefined"); // never installed a broken composite
  });
});
