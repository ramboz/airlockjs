// Floodlight (DC) denied-consent seal-hold, BOTH beacon forms — spec 046-03 (ADR-0023 Option E / spec
// 045-01's `holdOnDenied` mechanism + spec 045-03/ADR-0024's fan-out `remapKey`). DC OPTS IN to the
// core seal's `holdOnDenied` mode for BOTH its ccm/collect (046-01) and `;`-delimited activity (046-02)
// beacons: grounded on R-009 §(b) (the 2026-09-11 Playwright OneTrust.RejectAll() re-capture — the DC
// family fired NOTHING, "none — fully held", 23->2 collapse), so the parity-correct denied behavior
// for BOTH DC beacon forms is HOLD (buffer, flush on grant) — not a cookieless DC send, and not a
// stale verbatim re-send of the under-denial payload on grant.
//
// Unlike g-ads (044-02, a 1:1 connector, test/google-ads-seal.test.js), DC's `handle()` fans ONE
// page_view out to TWO held beacons (ccm + activity) — this is the FIRST real consumer of the
// 045-03/ADR-0024 fan-out `remapKey` mechanism: `createFloodlightRemap` dispatches on the seal's third
// `remap` argument to rebuild the correct wire form per beacon, so a grant-flush re-maps EACH beacon to
// its OWN correct form rather than a 1:1 seal's single-shape rebuild.
//
// Proven end-to-end through a REAL `createAirlock({ holdOnDenied, remap })` + the REAL Floodlight
// connector's `handle` output, via the SAME FakeWorker seal harness `test/google-ads-seal.test.js`
// (044-02) / `test/consent-seal.test.js` (045-01) use — no real Worker needed.
//
// AC1: handle() attaches a DISTINCT remapKey ("ccm"/"activity") to each beacon (distinct by
//      construction); createFloodlightRemap dispatches on it to rebuild the correct form for BOTH.
// AC2: denied/pending ad_storage HOLD both beacons; a later grant RE-MAPS + flushes both, each keyed
//      to its OWN form (not swapped, not duplicated) — re-sourced linker id + granted consent-mode,
//      NOT the stale under-denial payload; granted-from-start fires both unchanged.
// AC3: no cookieless DC fallback — under denial nothing egresses, of any shape.
// Robustness (045-03 fan-out guard): createFloodlightRemap is non-throwing per form — a rebuild
//      failure on one key drops just that beacon (terminal `dropped`); the sibling still flushes.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";
import {
  createFloodlightConnector,
  createFloodlightRemap,
  FLOODLIGHT_CCM_COLLECT_ENDPOINT,
  FLOODLIGHT_ACTIVITY_ENDPOINT,
} from "../connectors/floodlight/connector.js";

// The SAME FakeWorker pattern test/google-ads-seal.test.js and test/consent-seal.test.js use — no real
// Worker needed; a `ready` reply is simulated directly against `FakeWorker.last.onmessage`.
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

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

const CONVERSION_ID = "DC-1234567890";
// The Floodlight-native activity identity (046-02) — required to get handle() to emit the 2nd (activity) beacon.
const DC_SRC = "1234567";
const DC_TYPE = "grptag00";
const DC_CAT = "acttag00";
// The DECLARED ;-matrix ceiling PREFIX (046-02 AC4) — origin + /activity + the ;src=<id> identity
// segment, exactly what createFloodlightConnector's own manifest declares for this src.
const ACTIVITY_CEILING_ENDPOINT = `${FLOODLIGHT_ACTIVITY_ENDPOINT};src=${DC_SRC}`;

// A "reject-all" vector (R-009 §(b)'s captured OneTrust state) and its "accept-all" grant flip — both
// full 4-purpose vectors so gcs/gcd/npa resolve JOINTLY rather than omitting on a pending sibling
// purpose (connectors/consent-mode.js's own joint-string discipline).
const DENIED_ALL = {
  ad_storage: "denied",
  analytics_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
};
const GRANTED_ALL = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

// AC1: the DC airlock instance opts into holdOnDenied AND declares BOTH beacons' endpoints (the fixed
// ccm/collect + the ;-matrix activity CEILING PREFIX) — wired at the connector-config + seal level
// (real boot wiring in adapters/eds is the deferred edge, mirroring 044-02/§A2).
const makeAirlock = (opts) =>
  createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints: [FLOODLIGHT_CCM_COLLECT_ENDPOINT, ACTIVITY_CEILING_ENDPOINT],
    unloadCritical: [],
    egressPurposes: ["ad_storage"],
    holdOnDenied: true, // DC opts in — grounded on R-009 §(b): the container held the WHOLE family under reject-all
    ...opts,
  });

/** Build BOTH DC beacons (ccm at [0], activity at [1]) for one page_view, under the given ctx. */
function bothBeacons(ctx) {
  const connector = createFloodlightConnector({
    conversionId: CONVERSION_ID,
    src: DC_SRC,
    type: DC_TYPE,
    cat: DC_CAT,
    ctx,
  });
  const event = { type: "page_view", params: { page_location: "https://spike.example/pricing" } };
  return { event, requests: connector.handle(event) };
}

describe("createFloodlightRemap — key-aware dispatch + purity (no `document`/global; the cookie string is injected)", () => {
  it("runs correctly in Node/vitest (where `document` is undefined), and dispatches on remapKey: 'ccm' -> auid query form, 'activity' -> auiddc ;-matrix form", () => {
    expect(typeof document).toBe("undefined"); // grounds the premise (mirrors test/google-ads-seal.test.js)

    const readCookieString = vi.fn(() => "_gcl_au=1.1.42.1700000000");
    const remap = createFloodlightRemap({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: DC_CAT,
      readCookieString,
    });
    const event = { type: "page_view", params: {} };

    let ccmReq, activityReq;
    expect(() => {
      ccmReq = remap(event, GRANTED_ALL, "ccm");
      activityReq = remap(event, GRANTED_ALL, "activity");
    }).not.toThrow();

    expect(new URL(ccmReq.url).origin + new URL(ccmReq.url).pathname).toBe(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
    expect(new URL(ccmReq.url).searchParams.get("auid")).toBe("42.1700000000");

    expect(activityReq.url.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT)).toBe(true);
    expect(activityReq.url).toContain("auiddc=42.1700000000"); // the ;-matrix form's own field name
    expect(new URL(activityReq.url).searchParams.has("auid")).toBe(false); // no query at all (matrix URI)

    expect(readCookieString).toHaveBeenCalledTimes(2); // the injected seam re-read fresh, once per call
  });

  it("an absent/unrecognized remapKey defaults to the ccm/collect form (mirrors a 1:1 remap's own two-arg call shape)", () => {
    const remap = createFloodlightRemap({ conversionId: CONVERSION_ID, readCookieString: () => "" });
    const req = remap({ type: "page_view", params: {} }, GRANTED_ALL);
    expect(new URL(req.url).origin + new URL(req.url).pathname).toBe(FLOODLIGHT_CCM_COLLECT_ENDPOINT);
  });
});

describe("AC1 — handle() attaches a DISTINCT remapKey per beacon (ccm/activity)", () => {
  it("requests[0] (ccm) carries remapKey: 'ccm', requests[1] (activity) carries remapKey: 'activity' — distinct by construction", () => {
    const { requests } = bothBeacons({ consent: GRANTED_ALL });
    expect(requests).toHaveLength(2);
    expect(requests[0].remapKey).toBe("ccm");
    expect(requests[1].remapKey).toBe("activity");
    expect(requests[0].remapKey).not.toBe(requests[1].remapKey);
  });
});

describe("AC2 — granted-from-start dispatches BOTH beacons unchanged (holdOnDenied wired but not engaged)", () => {
  it("ad_storage granted at construction fires BOTH beacons immediately — no hold, no diagnostic", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const { requests } = bothBeacons({ consent: GRANTED_ALL, auid: "1234567890.1700000000" });

    makeAirlock({
      onDiagnostic,
      remap: createFloodlightRemap({
        conversionId: CONVERSION_ID,
        src: DC_SRC,
        type: DC_TYPE,
        cat: DC_CAT,
        readCookieString: () => "",
      }),
      consent: GRANTED_ALL,
    });
    FakeWorker.last.onmessage(readyMsg(requests));

    expect(fetchMock).toHaveBeenCalledTimes(2); // both — sent immediately, no hold
    const firedUrls = fetchMock.mock.calls.map(([url]) => url);
    expect(firedUrls.some((u) => u.startsWith(FLOODLIGHT_CCM_COLLECT_ENDPOINT))).toBe(true);
    expect(firedUrls.some((u) => u.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT))).toBe(true);
    expect(onDiagnostic.mock.calls.some(([r]) => r.kind === "consent")).toBe(false); // no held/flushed noise
  });
});

describe("AC2/AC3 — denied/pending ad_storage HOLDS BOTH DC beacons at the seal (no cookieless fallback)", () => {
  it("denied ad_storage HOLDS both beacons — zero egress, 2 held diagnostics naming 'denied' (R-009 §(b): 'none — fully held')", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const { requests } = bothBeacons({ consent: DENIED_ALL });
    const remap = createFloodlightRemap({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: DC_CAT,
      readCookieString: () => "",
    });
    makeAirlock({ onDiagnostic, remap, consent: DENIED_ALL });

    FakeWorker.last.onmessage(readyMsg(requests));

    expect(fetchMock).not.toHaveBeenCalled(); // held, NOT sent — not a cookieless DC send either
    const held = onDiagnostic.mock.calls.filter(([r]) => r.disposition === "held");
    expect(held).toHaveLength(2); // BOTH beacons held, independently
    for (const [record] of held) {
      expect(record).toMatchObject({
        level: "warn",
        kind: "consent",
        disposition: "held",
        purpose: "ad_storage",
        reason: expect.stringContaining("denied"),
      });
    }
  });

  it("pending ad_storage also HOLDS both beacons (no signal yet, distinct reason from denied)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const { requests } = bothBeacons({ consent: { ad_storage: "pending" } });
    const remap = createFloodlightRemap({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: DC_CAT,
      readCookieString: () => "",
    });
    makeAirlock({ onDiagnostic, remap, consent: { ad_storage: "pending" } });

    FakeWorker.last.onmessage(readyMsg(requests));

    expect(fetchMock).not.toHaveBeenCalled();
    const held = onDiagnostic.mock.calls.filter(([r]) => r.disposition === "held");
    expect(held).toHaveLength(2);
    for (const [record] of held) {
      expect(record.reason).toEqual(expect.stringContaining("pending"));
    }
  });
});

describe("AC3 — no cookieless DC fallback (parity, R-009 §(b): the container HELD, it did not cookieless-send ads)", () => {
  it("under denial, no beacon of ANY shape egresses — not a cookieless ccm/collect, not a cookieless activity ping", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const { requests } = bothBeacons({ consent: DENIED_ALL });
    const remap = createFloodlightRemap({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: DC_CAT,
      readCookieString: () => "",
    });
    makeAirlock({ remap, consent: DENIED_ALL });

    FakeWorker.last.onmessage(readyMsg(requests));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("handle() never produces a THIRD, denial-shaped beacon — always exactly the same two forms regardless of consent", () => {
    const granted = bothBeacons({ consent: GRANTED_ALL }).requests;
    const denied = bothBeacons({ consent: DENIED_ALL }).requests;
    expect(granted).toHaveLength(2);
    expect(denied).toHaveLength(2); // consent flips FIELD VALUES only, never adds/removes a beacon shape
  });
});

describe("AC2 — grant RE-MAPS + flushes BOTH beacons, each keyed to its OWN correct form (not swapped, not duplicated), re-sourced not stale", () => {
  // A synthetic, real-shaped `_gcl_au` — NEVER a live identifier (security constraint), mirroring
  // test/google-ads-seal.test.js's own synthetic-cookie proof.
  const SYNTHETIC_GCL_AU_COOKIE = "_gcl_au=1.1.1234567890.1700000000";
  const EXPECTED_AUID = "1234567890.1700000000";

  it("the boot-time (denied) beacons themselves carry NO auid/auiddc + the stale denied gcs/npa", () => {
    const { requests } = bothBeacons({ consent: DENIED_ALL });
    const [ccm, activity] = requests;

    const ccmParams = new URL(ccm.url).searchParams;
    expect(ccmParams.has("auid")).toBe(false);
    expect(ccmParams.get("gcs")).toBe("G100");
    expect(ccmParams.get("npa")).toBe("1");

    expect(activity.url).not.toContain("auiddc=");
    expect(activity.url).toContain("gcs=G100");
    expect(activity.url).toContain("npa=1");
  });

  it("granting ad_storage (+siblings) flushes EXACTLY 2 requests — one ccm form, one activity form — correctly keyed, re-sourced, granted (NOT the stale under-denial payload)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const { requests } = bothBeacons({ consent: DENIED_ALL });

    // A fake `readCookieString` re-read AT FLUSH TIME (not at construction) — proving the re-map
    // re-sources rather than replaying whatever the boot-time ctx happened to carry.
    const readCookieString = vi.fn(() => SYNTHETIC_GCL_AU_COOKIE);
    const remap = vi.fn(
      createFloodlightRemap({
        conversionId: CONVERSION_ID,
        src: DC_SRC,
        type: DC_TYPE,
        cat: DC_CAT,
        readCookieString,
      }),
    );
    const airlock = makeAirlock({ onDiagnostic, remap, consent: DENIED_ALL });

    FakeWorker.last.onmessage(readyMsg(requests));
    expect(fetchMock).not.toHaveBeenCalled();
    onDiagnostic.mockClear();

    airlock.setConsent(GRANTED_ALL);

    // remap invoked ONCE PER beacon, each with its OWN remapKey ("ccm" / "activity") — the 045-03
    // fan-out disambiguator actually threaded, not merely declared.
    expect(remap).toHaveBeenCalledTimes(2);
    const calledKeys = remap.mock.calls.map(([, , key]) => key).sort();
    expect(calledKeys).toEqual(["activity", "ccm"]);

    // exactly TWO fresh fetches — proving RE-MAP, not a re-send of either buffered under-denial beacon.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firedUrls = fetchMock.mock.calls.map(([url]) => url);

    const ccmUrl = firedUrls.find((u) => u.startsWith(FLOODLIGHT_CCM_COLLECT_ENDPOINT));
    const activityUrl = firedUrls.find((u) => u.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT));
    // NOT swapped, NOT duplicated: exactly one of EACH shape flushed (never two ccm's, never two
    // activity's, never the ccm payload wearing the activity URL or vice versa).
    expect(firedUrls).toHaveLength(2);
    expect(ccmUrl).toBeTruthy();
    expect(activityUrl).toBeTruthy();
    expect(ccmUrl).not.toBe(activityUrl);

    // ccm form: `auid` QUERY param — never `auiddc`.
    const ccmParams = new URL(ccmUrl).searchParams;
    expect(ccmParams.get("auid")).toBe(EXPECTED_AUID); // re-sourced from the synthetic cookie at flush
    expect(ccmUrl).not.toContain("auiddc=");
    expect(ccmParams.get("gcs")).toBe("G111"); // THE LOAD-BEARING correction: granted gcs/npa flip
    expect(ccmParams.get("npa")).toBe("0");
    expect(ccmUrl).not.toContain("gcs=G100"); // the stale under-denial value is gone
    expect(ccmUrl).not.toContain("npa=1");

    // activity form: `auiddc` PATH segment — never a query `auid` (it's a matrix URI, no query at all).
    expect(activityUrl).toContain(`auiddc=${EXPECTED_AUID}`);
    expect(new URL(activityUrl).searchParams.has("auid")).toBe(false);
    expect(activityUrl).toContain("gcs=G111");
    expect(activityUrl).toContain("npa=0");
    expect(activityUrl).not.toContain("gcs=G100");
    expect(activityUrl).not.toContain("npa=1");
    // still anchored at the declared identity prefix (src FIRST) — the ceiling admits it (see the
    // dedicated ceiling test below).
    expect(activityUrl.startsWith(`${FLOODLIGHT_ACTIVITY_ENDPOINT};src=${DC_SRC};`)).toBe(true);

    expect(readCookieString).toHaveBeenCalled(); // re-read at flush, not merely at construction

    // both flushed diagnostics recorded, and BOTH say re-mapped (not a verbatim re-send footgun).
    const flushed = onDiagnostic.mock.calls.filter(([r]) => r.disposition === "flushed");
    expect(flushed).toHaveLength(2);
    for (const [record] of flushed) {
      expect(record.reason).toContain("re-mapped");
    }
  });

  it("the re-mapped activity ;-URL is admitted on flush — NOT held by the endpoint-ceiling (046-02's segment-anchored prefix match clears it)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const { requests } = bothBeacons({ consent: DENIED_ALL });
    const remap = createFloodlightRemap({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: DC_CAT,
      readCookieString: () => "",
    });
    const airlock = makeAirlock({ onDiagnostic, remap, consent: DENIED_ALL });
    FakeWorker.last.onmessage(readyMsg(requests));
    onDiagnostic.mockClear();

    airlock.setConsent(GRANTED_ALL);

    // no endpoint-ceiling "held" diagnostic fired for either beacon...
    expect(onDiagnostic.mock.calls.some(([r]) => r.kind === "endpoint-ceiling")).toBe(false);
    // ...and the activity beacon DID egress — proof the ceiling admitted it, not silently absent.
    const activityFetch = fetchMock.mock.calls.map(([url]) => url).find((u) => u.startsWith(FLOODLIGHT_ACTIVITY_ENDPOINT));
    expect(activityFetch).toBeTruthy();
  });
});

describe("Robustness — createFloodlightRemap is non-throwing per form (045-03 fan-out guard)", () => {
  it("a rebuild failure on ONE key (a config field only that form reads, poisoned) resolves to undefined for JUST that call — never throws", () => {
    const poisonedCat = {
      toString() {
        throw new Error("boom");
      },
    };
    const remap = createFloodlightRemap({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: poisonedCat, // only mapToDcActivity reads `cat` — mapToDcCollect never touches it
      readCookieString: () => "",
    });
    const event = { type: "page_view", params: {} };

    let activityResult;
    expect(() => {
      activityResult = remap(event, GRANTED_ALL, "activity");
    }).not.toThrow();
    expect(activityResult).toBeUndefined();

    // the sibling key is UNAFFECTED by the poisoned `cat` — the ccm/collect form never reads it.
    const ccmResult = remap(event, GRANTED_ALL, "ccm");
    expect(ccmResult).toBeDefined();
    expect(ccmResult.url.startsWith(FLOODLIGHT_CCM_COLLECT_ENDPOINT)).toBe(true);
  });

  it("at the seal: when the activity rebuild fails on grant-flush, its held beacon terminally DROPS while the ccm sibling still flushes", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    // handle() itself builds BOTH beacons with a GOOD cat (bothBeacons uses the module-level DC_CAT) —
    // only the REMAP's own config below carries the poisoned cat, isolating "the rebuild fails" from
    // "the original beacon never existed".
    const { requests } = bothBeacons({ consent: DENIED_ALL });

    const poisonedCat = {
      toString() {
        throw new Error("boom");
      },
    };
    const remap = createFloodlightRemap({
      conversionId: CONVERSION_ID,
      src: DC_SRC,
      type: DC_TYPE,
      cat: poisonedCat,
      readCookieString: () => "",
    });
    const airlock = makeAirlock({ onDiagnostic, remap, consent: DENIED_ALL });

    FakeWorker.last.onmessage(readyMsg(requests));
    onDiagnostic.mockClear();

    expect(() => airlock.setConsent(GRANTED_ALL)).not.toThrow(); // the whole flush loop survives

    // exactly ONE fetch — the ccm sibling; the activity beacon's rebuild failed and dropped instead.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0].startsWith(FLOODLIGHT_CCM_COLLECT_ENDPOINT)).toBe(true);

    const dropped = onDiagnostic.mock.calls.filter(([r]) => r.disposition === "dropped");
    const flushed = onDiagnostic.mock.calls.filter(([r]) => r.disposition === "flushed");
    expect(dropped).toHaveLength(1); // the activity beacon's terminal `dropped` diagnostic
    expect(flushed).toHaveLength(1); // the ccm sibling still flushed — blast radius contained to 1
  });
});
