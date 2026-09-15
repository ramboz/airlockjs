// bootFloodlight — the EDS adapter's Floodlight (DC) wiring, spec 048-02 AC2/AC4. Mirrors
// test/eds-boot-google-ads.test.js's own ctx-sourcing/consent-wiring pattern (bootGoogleAds), and
// test/floodlight-seal.test.js's own denied-hold/granted-remap proof for BOTH DC forms — but driven
// through the REAL `bootFloodlight` boot adapter (a real createAirlock({connector:"floodlight"}) + a
// real chamber-shaped FakeWorker), closing that seal test's own named deferred edge ("real boot wiring
// in adapters/eds").
//
// AC2's endpoint-ceiling shape (048-02, frame-critique 2026-09-14): unlike bootGoogleAds' single-origin
// `endpoints:[ccm]`, bootFloodlight must pass a TWO-element ceiling `[ccm, activityCeilingPrefix]` when
// the activity form is configured (`src` set) — several tests below prove the activity beacon is NOT
// held by the endpoint ceiling, which is exactly what a naive single-element mirror would get wrong
// (the activity beacon would HOLD FOREVER, never dispatching, even under granted consent).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootFloodlight } from "../adapters/eds/index.js";
import {
  FLOODLIGHT_CCM_COLLECT_ENDPOINT,
  FLOODLIGHT_ACTIVITY_ENDPOINT,
  createFloodlightConnector,
} from "../connectors/floodlight/connector.js";

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

// A MUTABLE fake `document` (unlike a write-only stub): the cookie setter actually updates what a
// later getter read returns, so a test can prove a re-map re-SOURCES the cookie at flush time.
const fakeDocument = (initialCookie = "") => {
  const state = { cookie: initialCookie };
  const writes = [];
  return {
    writes,
    get cookie() { return state.cookie; },
    set cookie(v) { writes.push(v); state.cookie = v; },
    location: { href: "" },
    visibilityState: "visible",
  };
};

// floodlight's init message is NESTED under `connectorConfig` (048-02 deviation — see
// core/floodlight-chamber.worker.js's header), unlike google-ads' top-level spread.
const initConfig = () => {
  const m = FakeWorker.last.messages.find((m) => m.type === "init");
  return m && m.connectorConfig;
};
const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

const CONVERSION_ID = "DC-1234567890";
const DC_SRC = "1234567";
const DC_TYPE = "grptag00";
const DC_CAT = "acttag00";
const ACTIVITY_CEILING_ENDPOINT = `${FLOODLIGHT_ACTIVITY_ENDPOINT};src=${DC_SRC}`;
const DENIED_ALL = { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" };
const GRANTED_ALL = { ad_storage: "granted", analytics_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" };

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
});
afterEach(() => vi.unstubAllGlobals());

describe("bootFloodlight (spec 048-02 AC2 — the boot-happy-path skeleton)", () => {
  it("boots the FLOODLIGHT chamber, ceiled to ccm/collect ONLY when no activity identity is configured (src-less, mirrors 046-01)", async () => {
    const ctx = {};
    await bootFloodlight({ ctx, conversionId: CONVERSION_ID });

    expect(FakeWorker.last.url.endsWith("floodlight-chamber.worker.js")).toBe(true);
    const config = initConfig();
    expect(config.conversionId).toBe(CONVERSION_ID);
    expect(config.endpoint).toBe(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
  });

  it("an explicit opts.ctx override skips cookie/URL sourcing entirely (rig/test escape hatch, mirrors bootGoogleAds)", async () => {
    // NO document stub: if boot touched document.cookie/location despite the override, the bare
    // `document` reference would throw and fail this test.
    const provided = { auid: "9.9" };

    const handle = await bootFloodlight({ ctx: provided, conversionId: CONVERSION_ID });

    expect(handle).toBeTruthy();
    expect(initConfig().ctx).toEqual(provided);
  });

  it("sources ctx from the REAL _gcl_au cookie when ad_storage is granted and no override is given (REUSES sourceGoogleAdsCtx, §A4)", async () => {
    vi.stubGlobal("document", fakeDocument("_gcl_au=1.1.42.1700000000"));

    await bootFloodlight({ conversionId: CONVERSION_ID, consent: GRANTED_ALL });

    expect(initConfig().ctx.auid).toBe("42.1700000000");
  });

  it("ad_storage denied -> no _gcl_au read at all (no auid sourced, even with the cookie present)", async () => {
    vi.stubGlobal("document", fakeDocument("_gcl_au=1.1.42.1700000000"));

    await bootFloodlight({ conversionId: CONVERSION_ID, consent: DENIED_ALL });

    expect(initConfig().ctx.auid).toBeUndefined();
  });

  it("a real page_view drives a ccm/collect GET carrying tid/en/gcs/npa when NO activity identity is configured", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootFloodlight({ ctx: {}, conversionId: CONVERSION_ID, consent: GRANTED_ALL });

    const connector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: initConfig().ctx, endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT });
    const [req] = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg([req]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("GET");
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
    expect(parsed.searchParams.get("tid")).toBe(CONVERSION_ID);
    expect(parsed.searchParams.get("en")).toBe("page_view");
    expect(parsed.searchParams.get("gcs")).toBe("G111");
    expect(parsed.searchParams.get("npa")).toBe("0");
  });

  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootFloodlight({ ctx: {}, conversionId: CONVERSION_ID });

    FakeWorker.last.onmessage(readyMsg([{ url: `${FLOODLIGHT_CCM_COLLECT_ENDPOINT}?tid=${CONVERSION_ID}`, method: "GET" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns a working dispose(), and pushCritical IS exposed", async () => {
    const handle = await bootFloodlight({ ctx: {}, conversionId: CONVERSION_ID });

    expect(typeof handle.pushCritical).toBe("function");
    expect(() => handle.dispose()).not.toThrow();
    expect(FakeWorker.last.terminated).toBe(1);
  });
});

describe("bootFloodlight (spec 048-02 AC2 — the TWO-element endpoint ceiling, both DC forms)", () => {
  it("with `src` configured, init carries BOTH `src`/`type`/`cat` (as the connector's own `type` field, via the `activityType` boot opt) — BOTH beacons produced by the real connector", async () => {
    await bootFloodlight({ ctx: {}, conversionId: CONVERSION_ID, src: DC_SRC, activityType: DC_TYPE, cat: DC_CAT });

    const config = initConfig();
    expect(config.src).toBe(DC_SRC);
    expect(config.type).toBe(DC_TYPE); // translated from opts.activityType -> the connector's own `type` field
    expect(config.cat).toBe(DC_CAT);
  });

  it("a config-booted, `src`-configured floodlight instance dispatches BOTH the ccm/collect AND the ;-matrix activity GET — the activity beacon is NOT held by the endpoint ceiling", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const onDiagnostic = vi.fn();
    await bootFloodlight({
      ctx: {}, conversionId: CONVERSION_ID, src: DC_SRC, activityType: DC_TYPE, cat: DC_CAT,
      consent: GRANTED_ALL, onDiagnostic,
    });

    const connector = createFloodlightConnector({
      conversionId: CONVERSION_ID, src: DC_SRC, type: DC_TYPE, cat: DC_CAT, ctx: initConfig().ctx,
      endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT,
    });
    const requests = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg(requests));

    expect(fetchMock).toHaveBeenCalledTimes(2); // BOTH beacons — the ceiling admitted both
    expect(onDiagnostic).not.toHaveBeenCalledWith(expect.objectContaining({ kind: "endpoint-ceiling" }));
    const urls = fetchMock.mock.calls.map(([url]) => url);
    expect(urls.some((u) => u.startsWith(FLOODLIGHT_CCM_COLLECT_ENDPOINT))).toBe(true);
    expect(urls.some((u) => u.startsWith(ACTIVITY_CEILING_ENDPOINT))).toBe(true);
  });
});

describe("bootFloodlight (spec 048-02 AC4 — consent enforced END-TO-END through the boot, against the REAL seal, for BOTH DC forms)", () => {
  it("ad_storage denied at boot HOLDS BOTH beacons (no fetch), with 2 held diagnostics naming 'denied'", async () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    await bootFloodlight({
      ctx: {}, conversionId: CONVERSION_ID, src: DC_SRC, activityType: DC_TYPE, cat: DC_CAT,
      consent: DENIED_ALL, onDiagnostic,
    });

    const connector = createFloodlightConnector({
      conversionId: CONVERSION_ID, src: DC_SRC, type: DC_TYPE, cat: DC_CAT, ctx: initConfig().ctx,
      endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT,
    });
    const requests = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/pricing" } });
    FakeWorker.last.onmessage(readyMsg(requests));

    expect(fetchMock).not.toHaveBeenCalled();
    const held = onDiagnostic.mock.calls.filter(([r]) => r.disposition === "held");
    expect(held).toHaveLength(2);
    for (const [record] of held) {
      expect(record).toMatchObject({ level: "warn", kind: "consent", purpose: "ad_storage", reason: expect.stringContaining("denied") });
    }
  });

  it("handle.setConsent grants ad_storage mid-session: RE-MAPS both beacons via createFloodlightRemap (fresh gcs/npa + auid/auiddc re-sourced AT FLUSH TIME) and flushes exactly 2 — not a stale re-send", async () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // No cookie yet at boot (denied — sourceGoogleAdsCtx never reads it under denial, §A5).
    vi.stubGlobal("document", fakeDocument(""));
    const handle = await bootFloodlight({
      conversionId: CONVERSION_ID, src: DC_SRC, activityType: DC_TYPE, cat: DC_CAT,
      consent: DENIED_ALL, onDiagnostic,
    });

    const connector = createFloodlightConnector({
      conversionId: CONVERSION_ID, src: DC_SRC, type: DC_TYPE, cat: DC_CAT, ctx: initConfig().ctx,
      endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT,
    });
    const requests = connector.handle({ type: "page_view", params: { page_location: "https://spike.example/pricing" } });
    FakeWorker.last.onmessage(readyMsg(requests));
    expect(fetchMock).not.toHaveBeenCalled();
    onDiagnostic.mockClear();

    // A synthetic _gcl_au NOW present — the remap re-sources it fresh at flush time.
    document.cookie = "_gcl_au=1.1.55555.1700000000";

    handle.setConsent(GRANTED_ALL);

    expect(fetchMock).toHaveBeenCalledTimes(2); // exactly TWO fresh fetches — a RE-MAP, not a re-send
    const urls = fetchMock.mock.calls.map(([url]) => url);
    const ccmUrl = urls.find((u) => u.startsWith(FLOODLIGHT_CCM_COLLECT_ENDPOINT));
    const activityUrl = urls.find((u) => u.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT));
    expect(ccmUrl).toBeTruthy();
    expect(activityUrl).toBeTruthy();

    const ccmParams = new URL(ccmUrl).searchParams;
    expect(ccmParams.get("gcs")).toBe("G111");
    expect(ccmParams.get("npa")).toBe("0");
    expect(ccmParams.get("auid")).toBe("55555.1700000000"); // re-sourced from the cookie AT FLUSH TIME

    expect(activityUrl).toContain("auiddc=55555.1700000000");
    expect(activityUrl).toContain("gcs=G111");
    expect(activityUrl).toContain("npa=0");

    const flushed = onDiagnostic.mock.calls.filter(([r]) => r.disposition === "flushed");
    expect(flushed).toHaveLength(2);
  });

  it("gcd PARITY: a held->granted-flushed beacon (either form) encodes the SAME gcd as a steady-state granted beacon, given the SAME declared consentDefault (mirrors 048-01's fix-round regression)", async () => {
    const CUSTOM_DEFAULT = {
      ad_storage: "denied",
      analytics_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "granted",
    };

    const steadyFetch = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", steadyFetch);
    await bootFloodlight({ ctx: {}, conversionId: CONVERSION_ID, consent: GRANTED_ALL, consentDefault: CUSTOM_DEFAULT });
    const steadyConnector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: initConfig().ctx, endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT });
    const [steadyReq] = steadyConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg([steadyReq]));
    expect(steadyFetch).toHaveBeenCalledTimes(1);
    const steadyGcd = new URL(steadyFetch.mock.calls[0][0]).searchParams.get("gcd");

    const flushFetch = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", flushFetch);
    const handle = await bootFloodlight({ ctx: {}, conversionId: CONVERSION_ID, consent: DENIED_ALL, consentDefault: CUSTOM_DEFAULT });
    const heldConnector = createFloodlightConnector({ conversionId: CONVERSION_ID, ctx: initConfig().ctx, endpoint: FLOODLIGHT_CCM_COLLECT_ENDPOINT });
    const [heldReq] = heldConnector.handle({ type: "page_view", params: { page_location: "https://spike.example/" } });
    FakeWorker.last.onmessage(readyMsg([heldReq]));
    expect(flushFetch).not.toHaveBeenCalled();

    handle.setConsent(GRANTED_ALL);
    expect(flushFetch).toHaveBeenCalledTimes(1);
    const flushedGcd = new URL(flushFetch.mock.calls[0][0]).searchParams.get("gcd");

    expect(flushedGcd).toBe(steadyGcd);
  });
});
