// core/airlock.js's 026-04 advanced-matching main-thread seam — the worker→main
// identity CACHE, the `setIdentity` handle method, and the SYNCHRONOUS unload
// merge (spec 026-04 AC2/AC3/AC4/AC6 + the SECURITY invariant + back-compat).
//
// Reuses the SAME FakeWorker + listener-registry harness test/pixel-seam.test.js
// uses (no real Worker — hermetic). The worker→main `{type:"identity", ud}`
// message and the chamber's ud[...]-merged `ready` are SIMULATED here exactly as
// pixel-seam.test.js simulates `ready` — the REAL chamber that PRODUCES those
// messages is proven separately in test/pixel-advanced-matching-chamber.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import { createMetaPixelConfig, META_TR_ENDPOINT } from "../connectors/pixel/vendors/meta.js";

class FakeWorker {
  constructor(url, opts) {
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

function makeListenerRegistry() {
  const map = new Map();
  return {
    addEventListener: (type, fn) => { if (!map.has(type)) map.set(type, new Set()); map.get(type).add(fn); },
    removeEventListener: (type, fn) => { const s = map.get(type); if (s) s.delete(fn); },
    fire: (type, ev) => { for (const fn of [...(map.get(type) || [])]) fn(ev); },
    count: (type) => (map.has(type) ? map.get(type).size : 0),
  };
}

const metaConfig = createMetaPixelConfig();
const HEX_XID = "a".repeat(64);
const HEX_EM = "b".repeat(64);
const identityMsg = (ud) => ({ data: { type: "identity", ud } });

const makeMeta = (opts) =>
  createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [metaConfig.endpoint],
    ctx: {},
    unloadCritical: [],
    connector: "pixel",
    connectorConfig: metaConfig,
    egressPurposes: ["ad_storage"],
    ...opts,
  });

let registry;
beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  registry = makeListenerRegistry();
  vi.stubGlobal("addEventListener", registry.addEventListener);
  vi.stubGlobal("removeEventListener", registry.removeEventListener);
  vi.stubGlobal("requestIdleCallback", () => 1); // never auto-drain the ring
});
afterEach(() => vi.unstubAllGlobals());

describe("AC2 — setIdentity feeds raw PII to the worker on the DEDICATED channel (bypasses input governance)", () => {
  it("handle.setIdentity posts {type:'identity', raw} straight to the worker — NOT a push()/events batch", () => {
    const airlock = makeMeta();
    airlock.setIdentity({ em: "user@example.com", ph: "+1 (415) 555-0100" });

    const idMsg = FakeWorker.last.messages.find((m) => m.type === "identity");
    expect(idMsg).toEqual({ type: "identity", raw: { em: "user@example.com", ph: "+1 (415) 555-0100" } });
  });

  it("the raw identity is intact on the identity channel EVEN WITH a payloadDenylist covering em/ph — while a push() of the same field IS stripped", () => {
    const airlock = makeMeta({ payloadDenylist: ["email", "em", "ph"] });

    // (a) the identity channel bypasses governParams — raw crosses intact (only egresses hashed).
    airlock.setIdentity({ em: "user@example.com", ph: "4155550100" });
    const idMsg = FakeWorker.last.messages.find((m) => m.type === "identity");
    expect(idMsg.raw.em).toBe("user@example.com");
    expect(idMsg.raw.ph).toBe("4155550100");

    // (b) contrast: a push() of a denylisted field IS stripped BEFORE it crosses (existing governance).
    airlock.push({ event: "lead", email: "user@example.com", em: "user@example.com" });
    airlock.flushNow(); // drain the ring to the worker (requestIdleCallback is a no-op in this suite)
    const eventsMsg = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(eventsMsg.batch[0].params.email).toBeUndefined();
    expect(eventsMsg.batch[0].params.em).toBeUndefined();
  });
});

describe("AC3 — the unload beacon carries ud[...] from the cache, read SYNCHRONOUSLY", () => {
  it("a real visibilitychange->hidden after the cache is warm flushes a /tr GET carrying ud[external_id]=<hex>", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", { visibilityState: "hidden" });
    const airlock = makeMeta({ consent: { ad_storage: "granted" } });

    FakeWorker.last.onmessage(identityMsg({ external_id: HEX_XID })); // worker posts the resolved hash
    airlock.push({ event: "page_view" }); // ring-resident (requestIdleCallback is a no-op)
    registry.fire("visibilitychange"); // onVisibilityChange -> unloadFlush -> pixel requestMapper (sync)

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    expect(url.startsWith(META_TR_ENDPOINT)).toBe(true);
    expect(new URL(url).searchParams.get("ud[external_id]")).toBe(HEX_XID);
  });

  it("pagehide flushes ud[...] the SAME way (both unload listeners share the requestMapper merge)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta({ consent: { ad_storage: "granted" } });

    FakeWorker.last.onmessage(identityMsg({ external_id: HEX_XID, em: HEX_EM }));
    airlock.push({ event: "lead", value: 9, currency: "USD" });
    registry.fire("pagehide");

    const [url] = fetchMock.mock.calls[0];
    const sp = new URL(url).searchParams;
    expect(sp.get("ud[external_id]")).toBe(HEX_XID);
    expect(sp.get("ud[em]")).toBe(HEX_EM);
    expect(sp.get("cd[value]")).toBe("9"); // the base cd[...] custom data is untouched (AC5)
  });
});

describe("AC4 — eager cache fill + the identification-then-immediate-navigate teardown race (per-field omit, never raw)", () => {
  it("eager: an identity message warms the cache WITHOUT any push() (the unload merge then finds it)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta({ consent: { ad_storage: "granted" } });

    FakeWorker.last.onmessage(identityMsg({ external_id: HEX_XID })); // cache warmed, no steady-state event yet
    airlock.pushCritical({ event: "page_view" }); // straight to the sync path

    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get("ud[external_id]")).toBe(HEX_XID);
  });

  it("RACE — em/ph set then navigate BEFORE the hash resolves: the GET omits those ud[...] and carries NO raw; an already-warm field still ships", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta({ consent: { ad_storage: "granted" } });

    // external_id already resolved; the visitor identifies (em/ph) then immediately navigates.
    FakeWorker.last.onmessage(identityMsg({ external_id: HEX_XID }));
    airlock.setIdentity({ em: "user@example.com", ph: "4155550100" }); // posts raw to worker; hash IN FLIGHT
    airlock.push({ event: "page_view" });
    registry.fire("pagehide"); // teardown BEFORE the worker posts back em/ph hashes

    const [url] = fetchMock.mock.calls[0];
    const sp = new URL(url).searchParams;
    expect(sp.get("ud[external_id]")).toBe(HEX_XID); // the warm field STILL ships
    expect(sp.has("ud[em]")).toBe(false); // the in-flight field is OMITTED (per-field)
    expect(sp.has("ud[ph]")).toBe(false);
    // SECURITY: no raw identity anywhere in the URL — the cache never held raw.
    expect(url).not.toContain("user@example.com");
    expect(url).not.toContain("4155550100");
  });

  it("cold cache (no identity ever resolved) — the unload GET carries NO ud[...] and NO raw, and still ships the base beacon", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta({ consent: { ad_storage: "granted" } });

    airlock.setIdentity({ em: "user@example.com" }); // raw to worker; never resolves back here
    airlock.push({ event: "page_view" });
    registry.fire("pagehide");

    const [url] = fetchMock.mock.calls[0];
    expect(url.toLowerCase()).not.toContain("ud%5b");
    expect(url).not.toContain("user@example.com");
    expect(new URL(url).searchParams.get("ev")).toBe("PageView"); // base beacon intact
  });
});

describe("AC6 — ud[...] rides the existing ad_storage seal (denied drops the WHOLE beacon, identity included)", () => {
  it("steady-state: a ready with ud[...] already merged is DROPPED when ad_storage is denied+strict", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeMeta({ onDiagnostic, consentStrict: true, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(identityMsg({ external_id: HEX_XID }));
    // the chamber's ready already carries ud[...] (merged worker-side); the seal still gates it.
    FakeWorker.last.onmessage({
      data: { ready: [{ url: `${META_TR_ENDPOINT}?id=x&ev=PageView&ud%5Bexternal_id%5D=${HEX_XID}`, method: "GET" }], dropped: [] },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledWith(expect.objectContaining({ kind: "consent", disposition: "dropped" }));
  });

  it("unload: a warm-cache pagehide is DROPPED when ad_storage is denied+strict (no ud[...] leaks past the seal)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta({ consentStrict: true, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(identityMsg({ external_id: HEX_XID }));
    airlock.push({ event: "page_view" });
    registry.fire("pagehide");

    expect(fetchMock).not.toHaveBeenCalled(); // the whole beacon (incl. identity) dropped at the seal
  });
});

describe("back-compat — no identity feed => byte-identical to a pre-026-04 pixel beacon", () => {
  it("a warm-free unload GET carries NO ud[...] (identity cache empty)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeMeta({ consent: { ad_storage: "granted" } });

    airlock.push({ event: "page_view" });
    registry.fire("pagehide");

    const [url] = fetchMock.mock.calls[0];
    expect(url.toLowerCase()).not.toContain("ud%5b");
  });

  it("an identity message carrying NO ready never triggers a dispatch (it only warms the cache)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeMeta({ consent: { ad_storage: "granted" } });

    FakeWorker.last.onmessage(identityMsg({ external_id: HEX_XID }));
    expect(fetchMock).not.toHaveBeenCalled(); // pure cache write, no beacon
  });

  it("REGRESSION — setIdentity on a GA4 (non-pixel) instance is a harmless no-op message the GA4 chamber ignores", () => {
    const ga4 = createAirlock({ trackers: 1, workFactor: 0, endpoints: ["https://t0.example/collect"], ctx: {}, unloadCritical: [] });
    expect(() => ga4.setIdentity({ em: "user@example.com" })).not.toThrow();
    // it posts the identity message (the GA4 chamber's onmessage simply never handles `type:"identity"`)
    expect(FakeWorker.last.messages.some((m) => m.type === "identity")).toBe(true);
  });
});
