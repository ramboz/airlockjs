import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createAirlock } from "../core/airlock.js";

// Spec 017-03 — the seal's hold-pending + strict-drop (ADR-0007 point ③), the
// THIRD consent enforcement point after the mapper-reshape (017-01) and the
// cookie-capability deny (017-02). E2E against the REAL `core/airlock.js` seam
// (both dispatch sites: the async `worker.onmessage` -> `fetch` path AND the
// sync/unload `pushCritical` fast path), using the SAME FakeWorker pattern
// `test/chamber-observability.test.js` uses (no real Worker needed — a `ready`
// reply is simulated directly against `FakeWorker.last.onmessage`).
//
// Semantics under test (ADR-0007, core/consent.js's `egressVerdict`):
//   - pending (no signal)      -> HOLD at the async seal / DROP on sync-unload
//     (no "later" to flush to there).
//   - denied a STORAGE purpose (e.g. `analytics_storage`, non-strict) -> SEND
//     — a storage-purpose denial is 017-02's cookie concern; the beacon still
//     egresses. Do NOT hold/drop it here.
//   - granted -> SEND.
//   - STRICT regime + any un-granted purpose -> DROP (no beacon, no buffer).

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

const endpoints = ["https://t0.example/collect"];
const ctx = { clientId: "1234567890.1700000000", sessionId: "1724668790" };

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => vi.unstubAllGlobals());

/** GA4's single declared egress purpose (`connectors/ga4/connector.js`'s
 *  manifest, `adapters/eds/index.js`'s `GA4_EGRESS_PURPOSES`) — the default
 *  `egressPurposes` for every test here unless a test overrides it. */
const make = (opts) =>
  createAirlock({
    trackers: 1,
    workFactor: 0,
    endpoints,
    ctx,
    unloadCritical: [],
    egressPurposes: ["analytics_storage"],
    ...opts,
  });

const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

describe("AC1/AC6 — pending purpose HOLDS a ready beacon at the async seal", () => {
  it("zero egress + buffered + a consent/held diagnostic per beacon (no consent vector wired at all)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic }); // consent defaults null -> {} -> analytics_storage resolves "pending"

    FakeWorker.last.onmessage(
      readyMsg([
        { url: endpoints[0], body: '{"n":1}' },
        { url: endpoints[0], body: '{"n":2}' },
      ]),
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(2); // one per held beacon
    for (const [record] of onDiagnostic.mock.calls) {
      expect(record).toMatchObject({
        level: "warn",
        kind: "consent",
        disposition: "held",
        purpose: "analytics_storage",
      });
    }
  });

  it("an explicit `{ analytics_storage: 'pending' }` vector holds identically to an absent vector", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ consent: { analytics_storage: "pending" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC2 — 017-03's own main-thread setConsent flushes held beacons on pending→granted", () => {
  it("setConsent granting the held purpose re-fetches every buffered { url, body } (pure main-thread re-dispatch)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic });

    FakeWorker.last.onmessage(
      readyMsg([
        { url: endpoints[0], body: '{"held":1}' },
        { url: endpoints[0], body: '{"held":2}' },
      ]),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    onDiagnostic.mockClear();

    airlock.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      endpoints[0],
      expect.objectContaining({ method: "POST", body: '{"held":1}', keepalive: true }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      endpoints[0],
      expect.objectContaining({ method: "POST", body: '{"held":2}', keepalive: true }),
    );
    expect(onDiagnostic).toHaveBeenCalledTimes(2); // one flushed record per beacon
    for (const [record] of onDiagnostic.mock.calls) {
      expect(record).toMatchObject({ level: "warn", kind: "consent", disposition: "flushed", purpose: "analytics_storage" });
    }
  });

  it("a grant for an UNRELATED purpose does not flush a still-pending analytics_storage hold", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make();

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));
    airlock.setConsent({ functional: "granted" }); // does not touch analytics_storage

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("setConsent is a no-op (no throw, no fetch) when nothing is held", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ consent: { analytics_storage: "granted" } });

    expect(() => airlock.setConsent({ analytics_storage: "granted" })).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("granted (normal) dispatch is unchanged", () => {
  it("granted from the start dispatches immediately — no held/dropped diagnostic", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic, consent: { analytics_storage: "granted" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});

describe("denied analytics_storage (non-strict) SENDS — a storage denial does not hold egress (017-02's cookie concern)", () => {
  it("a beacon with the purpose explicitly DENIED still dispatches, not held, not dropped", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic, consent: { analytics_storage: "denied" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });
});

describe("AC3/AC6 — strict regime DROPS an un-granted beacon (no hold, no buffer)", () => {
  it("strict + pending -> zero egress, a consent/dropped diagnostic, and NOTHING to later flush", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic, consentStrict: true });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      level: "warn",
      kind: "consent",
      disposition: "dropped",
      purpose: "analytics_storage",
      reason: expect.stringContaining("strict"),
    });

    // dropped, not held: a later grant has no buffer to flush (still zero egress).
    onDiagnostic.mockClear();
    airlock.setConsent({ analytics_storage: "granted" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).not.toHaveBeenCalled(); // no held beacon existed to flush
  });

  it("strict + DENIED also drops (fail-closed: any non-granted, not just pending)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ consentStrict: true, consent: { analytics_storage: "denied" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AC4 — the sync/unload fast path (pushCritical) can only DROP, never hold", () => {
  it("a pending governing purpose on the sync path drops the beacon — no fetch, a dropped diagnostic naming the sync/unload reason", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ onDiagnostic });

    airlock.pushCritical({ event: "outbound_click", link_url: "https://out.example/" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      level: "warn",
      kind: "consent",
      disposition: "dropped",
      purpose: "analytics_storage",
      reason: expect.stringContaining("sync/unload"),
    });
  });

  it("strict + denied on the sync path also drops (both-sites parity)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ consentStrict: true, consent: { analytics_storage: "denied" } });

    airlock.pushCritical({ event: "page_view", page_location: "https://x.example/" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a GRANTED governing purpose on the sync path dispatches unchanged", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ consent: { analytics_storage: "granted" } });

    airlock.pushCritical({ event: "outbound_click", link_url: "https://out.example/" });

    expect(fetchMock).toHaveBeenCalledTimes(1); // trackers:1 -> one keepalive POST
  });
});

describe("AC5 — the purpose->beacon binding is whatever `egressPurposes` the caller declares (vendor-neutral, not hardcoded)", () => {
  it("a beacon governed by MULTIPLE declared purposes is held if ANY is un-granted (fail-closed)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // analytics_storage granted, but ad_storage still pending -> the worst verdict (hold) wins.
    make({ egressPurposes: ["analytics_storage", "ad_storage"], consent: { analytics_storage: "granted" } });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("back-compat — no egressPurposes configured leaves the gate OFF entirely", () => {
  it("async path: dispatched normally, no consent diagnostics, even with a pending-shaped vector", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    make({ onDiagnostic, egressPurposes: [] });

    FakeWorker.last.onmessage(readyMsg([{ url: endpoints[0], body: "{}" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });

  it("sync path: pushCritical dispatches normally too", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = make({ egressPurposes: [] });

    airlock.pushCritical({ event: "outbound_click", link_url: "https://out.example/" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// spec 045-01 (ADR-0023 Option E) — the per-connector `holdOnDenied` opt-in +
// the RE-MAP-on-grant flush correction. When a connector opts in, a DENIED
// governing purpose HOLDS instead of sending (today it would send); on a later
// grant the held beacon is REBUILT from its source event under the now-current
// consent (fresh `auid`, granted `gcs`/`npa`) via the connector's `remap` — NOT
// re-sent as the stale under-denial payload (which would be an unattributable
// "user-declined" ping). 045-01 wires NO real connector — the `remap` here is a
// fake standing in for g-ads' main-thread mapper (proven end-to-end in 044-02).
describe("AC2/AC3 — holdOnDenied HOLDS a denied beacon, then RE-MAPS it on grant", () => {
  const AD_ENDPOINT = "https://ads.example/g/collect";

  // The fake connector re-mapper: rebuilds the beacon under the PASSED consent
  // vector. Granted -> carries `auid` (an ad_storage-gated ctx field re-read
  // now) + `gcs=G111`; denied -> no `auid`, `gcs=G100`. So the fired URL proves
  // whether the flush RE-MAPPED (granted fields) or merely re-sent the stale
  // under-denial payload (`gcs=G100`, no `auid`).
  const makeRemap = () =>
    vi.fn((event, vector) => ({
      url:
        vector && vector.ad_storage === "granted"
          ? `${AD_ENDPOINT}?ev=${event.type}&auid=AA.BB&gcs=G111`
          : `${AD_ENDPOINT}?ev=${event.type}&gcs=G100`,
      method: "GET",
    }));

  // The worker-mapped `ready` beacon, produced UNDER DENIAL (stale: no `auid`,
  // `gcs=G100`), now carrying its SOURCE EVENT so the seal can re-map on grant.
  const heldReadyMsg = () =>
    readyMsg([{ url: `${AD_ENDPOINT}?ev=conversion&gcs=G100`, method: "GET", event: { type: "conversion" } }]);

  const makeAd = (opts) =>
    make({ egressPurposes: ["ad_storage"], holdOnDenied: true, endpoints: [AD_ENDPOINT], ...opts });

  it("denied ad_storage under holdOnDenied is HELD, not sent (the g-ads reject-all case), with a denied-hold diagnostic", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeAd({ onDiagnostic, remap: makeRemap(), consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(heldReadyMsg());

    expect(fetchMock).not.toHaveBeenCalled(); // held, NOT sent (today it would send)
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      level: "warn",
      kind: "consent",
      disposition: "held",
      purpose: "ad_storage",
      reason: expect.stringContaining("denied"),
    });
  });

  it("granting ad_storage RE-MAPS under the now-current consent (fresh auid + gcs=granted), NOT the stale under-denial payload", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = makeRemap();
    const airlock = makeAd({ onDiagnostic, remap, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(heldReadyMsg());
    expect(fetchMock).not.toHaveBeenCalled();
    const heldId = onDiagnostic.mock.calls[0][0].beaconId;
    onDiagnostic.mockClear();

    airlock.setConsent({ ad_storage: "granted" });

    // remap invoked ONCE with the SOURCE EVENT + the NOW-GRANTED vector.
    expect(remap).toHaveBeenCalledTimes(1);
    expect(remap).toHaveBeenCalledWith({ type: "conversion" }, expect.objectContaining({ ad_storage: "granted" }));

    // exactly one FRESH beacon fetched, carrying the granted-only fields the
    // re-map adds — proving RE-MAP, not a re-send of the buffered under-denial
    // {url,body} (which had no `auid` and `gcs=G100`).
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [firedUrl, firedInit] = fetchMock.mock.calls[0];
    expect(firedUrl).toContain("auid=AA.BB");
    expect(firedUrl).toContain("gcs=G111");
    expect(firedUrl).not.toContain("gcs=G100"); // the stale under-denial value is gone
    expect(firedInit).toMatchObject({ method: "GET", keepalive: true });
    expect(firedInit.body).toBeUndefined(); // a GET carries no body

    // the held→flushed beaconId chain is preserved.
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      kind: "consent",
      disposition: "flushed",
      purpose: "ad_storage",
      beaconId: heldId,
    });
  });

  it("a grant for an UNRELATED purpose leaves ad_storage held (still denied) — no re-map, no fetch", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = makeRemap();
    const airlock = makeAd({ remap, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(heldReadyMsg());
    airlock.setConsent({ functional: "granted" }); // ad_storage still denied -> still held

    expect(remap).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("holdOnDenied WITHOUT a remap falls back to the 017-03 verbatim re-send (graceful — no crash)", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeAd({ consent: { ad_storage: "denied" } }); // no `remap` wired

    FakeWorker.last.onmessage(heldReadyMsg());
    expect(fetchMock).not.toHaveBeenCalled(); // denied -> still held

    airlock.setConsent({ ad_storage: "granted" });
    // re-send path: the buffered under-denial {url,body} is re-fetched verbatim.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${AD_ENDPOINT}?ev=conversion&gcs=G100`);
  });

  it("the sync/unload path DROPS a denied holdOnDenied beacon at teardown (no buffer to re-map into)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeAd({ onDiagnostic, remap: makeRemap(), consent: { ad_storage: "denied" } });

    airlock.pushCritical({ event: "conversion" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      kind: "consent",
      disposition: "dropped",
      purpose: "ad_storage",
      reason: expect.stringContaining("sync/unload"),
    });
  });

  it("no-op default: an instance WITHOUT holdOnDenied still SENDS a denied beacon (byte-identical to today)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // holdOnDenied omitted -> defaults false; denied ad_storage must SEND, not hold.
    make({ onDiagnostic, egressPurposes: ["ad_storage"], endpoints: [AD_ENDPOINT], consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(readyMsg([{ url: `${AD_ENDPOINT}?x=1`, method: "GET" }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onDiagnostic).not.toHaveBeenCalled();
  });

  // --- compliance + arch review follow-ups (the held-reason must name the
  // ACTUAL consent state, not the buffering strategy; the opted-in verbatim
  // re-send footgun must be observable; a declined re-map / off-ceiling re-map
  // must not silently vanish or bypass the host ceiling) ---

  it("the held reason names the ACTUAL state (denied) and FLAGS the verbatim re-send footgun when opted-in WITHOUT a remap", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeAd({ onDiagnostic, consent: { ad_storage: "denied" } }); // opted in, NO remap wired

    FakeWorker.last.onmessage(heldReadyMsg());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const { reason } = onDiagnostic.mock.calls[0][0];
    expect(reason).toContain("denied"); // the ACTUAL state — was mislabeled "pending" (canRemap-keyed)
    expect(reason).toContain("RE-SEND"); // the stale-payload footgun is observable (arch blocker)
  });

  it("the held reason names PENDING (not 'denied') for a pending hold on an opted-in re-map instance", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeAd({ onDiagnostic, remap: makeRemap() }); // no consent -> ad_storage PENDING; remap wired

    FakeWorker.last.onmessage(heldReadyMsg());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    const { reason } = onDiagnostic.mock.calls[0][0];
    expect(reason).toContain("pending"); // was mislabeled "denied" (the canRemap-keyed bug)
    expect(reason).toContain("re-maps on grant");
  });

  it("flushing a VERBATIM re-send on an opted-in instance flags the stale-payload footgun in the flushed diagnostic", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeAd({ onDiagnostic, consent: { ad_storage: "denied" } }); // no remap
    FakeWorker.last.onmessage(heldReadyMsg());
    onDiagnostic.mockClear();

    airlock.setConsent({ ad_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1); // verbatim re-send still fires (graceful)
    const flushed = onDiagnostic.mock.calls.find(([r]) => r.disposition === "flushed");
    expect(flushed[0].reason).toContain("VERBATIM");
  });

  it("a re-map that DECLINES (returns nothing) on flush emits a terminal dropped record + no fetch (the held->flushed chain stays honest)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = vi.fn(() => null); // declines — produces no beacon
    const airlock = makeAd({ onDiagnostic, remap, consent: { ad_storage: "denied" } });
    FakeWorker.last.onmessage(heldReadyMsg());
    const heldId = onDiagnostic.mock.calls[0][0].beaconId;
    onDiagnostic.mockClear();

    airlock.setConsent({ ad_storage: "granted" });

    expect(remap).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled(); // declined -> no egress
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      kind: "consent",
      disposition: "dropped",
      beaconId: heldId, // held->dropped chain preserved (not silently discarded)
      reason: expect.stringContaining("re-map declined"),
    });
  });

  it("a re-map producing an OFF-CEILING url is HELD by the endpoint ceiling at flush, never egressed (a connector cannot widen its ceiling via re-map)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = vi.fn(() => ({ url: "https://evil.example/collect?auid=AA.BB", method: "GET" }));
    const airlock = makeAd({ onDiagnostic, remap, consent: { ad_storage: "denied" } });
    FakeWorker.last.onmessage(heldReadyMsg());
    const heldId = onDiagnostic.mock.calls[0][0].beaconId;
    onDiagnostic.mockClear();

    airlock.setConsent({ ad_storage: "granted" });

    expect(remap).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled(); // off-ceiling -> held, never egressed
    expect(onDiagnostic).toHaveBeenCalledTimes(1);
    expect(onDiagnostic.mock.calls[0][0]).toMatchObject({
      kind: "endpoint-ceiling",
      disposition: "held",
      beaconId: heldId,
    });
  });

  // spec 045-03 (ADR-0024) AC3 — backward-compat: a 1:1 connector (like g-ads
  // above) sets NO `remapKey`, so the held record's `remapKey` is `undefined`
  // and the seal's `remap(event, consent, remapKey)` call passes it through
  // unused — byte-identical to the shipped 045-01 mechanism.
  it("045-03 backward-compat — a 1:1 held beacon with NO remapKey still re-maps correctly; remap's third arg is undefined", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = makeRemap();
    const airlock = makeAd({ onDiagnostic, remap, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(heldReadyMsg()); // no `remapKey` on this held item at all
    airlock.setConsent({ ad_storage: "granted" });

    expect(remap).toHaveBeenCalledTimes(1);
    expect(remap.mock.calls[0][2]).toBeUndefined(); // no remapKey set -> the third arg is undefined
    expect(remap).toHaveBeenCalledWith({ type: "conversion" }, expect.objectContaining({ ad_storage: "granted" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firedUrl = fetchMock.mock.calls[0][0];
    expect(firedUrl).toContain("auid=AA.BB");
    expect(firedUrl).toContain("gcs=G111");
  });
});

// spec 045-03 (ADR-0024) — the seal's N-beacon FAN-OUT re-map: a per-beacon
// `EgressRequest.remapKey` (contracts/connector.d.ts) is threaded hold->flush
// so ONE key-aware `remap(event, consent, remapKey)` can rebuild EACH of a
// fan-out connector's held beacons to its OWN correct wire form — lifting the
// 045-01/ADR-0023 1:1 limit proven above (a single `remap(event, consent)`
// call cannot distinguish which of N held items it is rebuilding). Synthetic
// 2-beacon connector proof only — the MECHANISM; Floodlight (spec 046-03,
// ccm + activity) is its first real consumer, not wired here.
describe("045-03 (ADR-0024) — seal N-beacon fan-out re-map via a per-beacon remapKey", () => {
  const FORM_A_ENDPOINT = "https://form-a.example/collect";
  const FORM_B_ENDPOINT = "https://form-b.example/activity";

  // A single key-aware remap standing in for a fan-out connector's own
  // main-thread mapper (Floodlight's eventual createFloodlightRemap, spec
  // 046-03): dispatches on the THIRD arg (`remapKey`) to rebuild each
  // beacon's own correct GRANTED form; declines (returns null) when denied.
  const makeFanoutRemap = () =>
    vi.fn((event, vector, remapKey) => {
      if (!vector || vector.ad_storage !== "granted") return null;
      if (remapKey === "a") return { url: `${FORM_A_ENDPOINT}?ev=${event.type}&form=A`, method: "GET" };
      if (remapKey === "b") return { url: `${FORM_B_ENDPOINT}?ev=${event.type}&form=B`, method: "GET" };
      return null;
    });

  // The worker-mapped `ready` message: TWO beacons fanned out from ONE
  // `page_view` — the exact shape a fan-out connector's `handle()` returns
  // (contracts/connector.d.ts's `EgressRequest.remapKey`) — sharing the SAME
  // source `event` but carrying DISTINCT `remapKey`s.
  const fanoutReadyMsg = () =>
    readyMsg([
      { url: `${FORM_A_ENDPOINT}?stale=1`, method: "GET", event: { type: "page_view" }, remapKey: "a" },
      { url: `${FORM_B_ENDPOINT}?stale=1`, method: "GET", event: { type: "page_view" }, remapKey: "b" },
    ]);

  const makeFanout = (opts) =>
    make({
      egressPurposes: ["ad_storage"],
      holdOnDenied: true,
      endpoints: [FORM_A_ENDPOINT, FORM_B_ENDPOINT],
      ...opts,
    });

  it("AC2 — both fan-out beacons are HELD under denied ad_storage (2 held, zero egress)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    makeFanout({ onDiagnostic, remap: makeFanoutRemap(), consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(fanoutReadyMsg());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onDiagnostic).toHaveBeenCalledTimes(2); // one held diagnostic per fan-out beacon
    for (const [record] of onDiagnostic.mock.calls) {
      expect(record).toMatchObject({ level: "warn", kind: "consent", disposition: "held", purpose: "ad_storage" });
    }
  });

  it("AC2 — granting flushes BOTH, each re-mapped to its OWN distinct granted form keyed by remapKey (not swapped, not duplicated)", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = makeFanoutRemap();
    const airlock = makeFanout({ onDiagnostic, remap, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(fanoutReadyMsg());
    expect(fetchMock).not.toHaveBeenCalled();
    onDiagnostic.mockClear();

    airlock.setConsent({ ad_storage: "granted" });

    // one key-aware `remap` call PER held beacon, each keyed correctly.
    expect(remap).toHaveBeenCalledTimes(2);
    expect(remap).toHaveBeenCalledWith({ type: "page_view" }, expect.objectContaining({ ad_storage: "granted" }), "a");
    expect(remap).toHaveBeenCalledWith({ type: "page_view" }, expect.objectContaining({ ad_storage: "granted" }), "b");

    // exactly two fetches, one per form — each carrying its OWN correct wire
    // form, proving the fan-out is disambiguated (not swapped, not
    // duplicated): the exact 1:1-limit failure this slice fixes, since a
    // single remap(event, consent) call cannot tell the two held items apart.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const urlA = fetchMock.mock.calls.find(([url]) => url.startsWith(FORM_A_ENDPOINT))?.[0];
    const urlB = fetchMock.mock.calls.find(([url]) => url.startsWith(FORM_B_ENDPOINT))?.[0];
    expect(urlA).toBe(`${FORM_A_ENDPOINT}?ev=page_view&form=A`); // not swapped: A's own form
    expect(urlB).toBe(`${FORM_B_ENDPOINT}?ev=page_view&form=B`); // not swapped: B's own form
    expect(fetchMock.mock.calls.filter(([url]) => url.startsWith(FORM_A_ENDPOINT)).length).toBe(1); // not duplicated
    expect(fetchMock.mock.calls.filter(([url]) => url.startsWith(FORM_B_ENDPOINT)).length).toBe(1); // not duplicated
  });

  it("declined-key: a remap returning nothing for ONE key drops just that beacon (terminal `dropped`); the other still flushes", () => {
    const onDiagnostic = vi.fn();
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    // declines key "a" (produces no beacon), still rebuilds key "b".
    const remap = vi.fn((event, vector, remapKey) =>
      remapKey === "b" ? { url: `${FORM_B_ENDPOINT}?ev=${event.type}&form=B`, method: "GET" } : null,
    );
    const airlock = makeFanout({ onDiagnostic, remap, consent: { ad_storage: "denied" } });

    FakeWorker.last.onmessage(fanoutReadyMsg());
    const heldIds = onDiagnostic.mock.calls.map(([r]) => r.beaconId);
    onDiagnostic.mockClear();

    airlock.setConsent({ ad_storage: "granted" });

    expect(remap).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(1); // only key "b" egresses
    expect(fetchMock.mock.calls[0][0]).toBe(`${FORM_B_ENDPOINT}?ev=page_view&form=B`);

    expect(onDiagnostic).toHaveBeenCalledTimes(2); // one dropped (key "a") + one flushed (key "b")
    const dropped = onDiagnostic.mock.calls.find(([r]) => r.disposition === "dropped")[0];
    const flushed = onDiagnostic.mock.calls.find(([r]) => r.disposition === "flushed")[0];
    expect(dropped.reason).toContain("re-map declined");
    expect(heldIds).toContain(dropped.beaconId); // held->dropped chain preserved
    expect(heldIds).toContain(flushed.beaconId); // held->flushed chain preserved
  });
});
