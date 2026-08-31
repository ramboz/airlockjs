import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootEdsAnalytics } from "../adapters/eds/index.js";

// Slice 004-03 AC4: the EDS adapter replaces the 004-02 STATIC_CTX with ctx
// sourced from the real `_ga` cookies via the mediated accessor, and ONLY the
// minimal { clientId, sessionId } snapshot crosses into the runtime (ADR-0003) —
// no raw cookie string, no ambient identity. createAirlock posts that ctx to the
// worker in its init message, so FakeWorker.last.messages[0].ctx is exactly what
// crossed the airlock.

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
  }
  postMessage(m) {
    this.messages.push(m);
  }
  terminate() {}
}

const fakeDocument = (initialCookie = "") => {
  const writes = [];
  return {
    writes,
    get cookie() {
      return initialCookie;
    },
    set cookie(v) {
      writes.push(v);
    },
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

describe("bootEdsAnalytics ctx sourcing (AC4 — minimal cookie-sourced snapshot)", () => {
  it("returning visitor: ctx comes from the REAL _ga/_ga_<stream> cookies, nothing is written", async () => {
    // Deliberately NOT the old STATIC_CTX values — proves sourcing actually reads.
    vi.stubGlobal(
      "document",
      fakeDocument("_ga=GA1.1.5555555555.1600000000; _ga_TEST9=GS1.1.1699999999.3.1.1700000050.60.0.0"),
    );

    const handle = await bootEdsAnalytics();

    expect(handle).toBeTruthy();
    const init = initMsg();
    expect(init.ctx).toEqual({ clientId: "5555555555.1600000000", sessionId: "1699999999" });
    expect(document.writes).toEqual([]); // never overwrite an existing _ga
  });

  it("fresh visitor: generates + persists _ga in GA1 format, and the SAME id crosses as ctx", async () => {
    const doc = fakeDocument(""); // no cookies at all
    vi.stubGlobal("document", doc);

    await bootEdsAnalytics();

    // One defensive write, GA1 format, ≈2y/path=//lax persistence (slice Assumptions).
    expect(doc.writes).toHaveLength(1);
    const m = /^_ga=GA1\.1\.(\d{10}\.\d+); max-age=63072000; path=\/; samesite=lax$/.exec(
      doc.writes[0],
    );
    expect(m).not.toBeNull();

    const init = initMsg();
    expect(init.ctx.clientId).toBe(m[1]); // persisted identity === crossing identity
    expect(init.ctx.sessionId).toMatch(/^\d+$/); // per-page fallback (no _ga_<stream> exists)
  });

  it("ctx that crosses the airlock has EXACTLY the minimal keys — no raw cookie material", async () => {
    vi.stubGlobal(
      "document",
      fakeDocument("_ga=GA1.1.5555555555.1600000000; _ga_TEST9=GS1.1.1699999999.3.1.1700000050.60.0.0"),
    );

    await bootEdsAnalytics();

    expect(Object.keys(initMsg().ctx).sort()).toEqual(["clientId", "sessionId"]);
  });

  it("an explicit opts.ctx override skips cookie sourcing entirely (rig/test escape hatch)", async () => {
    // NO document stub: if boot touched document.cookie despite the override,
    // the bare `document` reference would throw and fail this test.
    const provided = { clientId: "9.9", sessionId: "8" };

    const handle = await bootEdsAnalytics({ ctx: provided });

    expect(handle).toBeTruthy();
    expect(initMsg().ctx).toEqual(provided);
  });
});

// Spec 017-03: the seal's `egressPurposes` gate is wired conditionally on
// `opts.consent` being provided at all — mirroring the SAME `consent ? … : …`
// idiom 017-01 (`shapedConsent`) and 017-02 (`storageGranted`) already use.
// This is deliberate, NOT the literal "pass egressPurposes unconditionally"
// reading: `core/consent.js` fails an ABSENT vector to "pending" exactly like
// an EXPLICIT-but-unresolved one (there is no way to tell "no CMP wired" from
// "CMP wired, not yet resolved" at the resolver), and nothing would ever call
// `setConsent` to release a hold on a page that never wires consent at all —
// so gating unconditionally would silently HOLD EVERY beacon forever on any
// caller that never wires a consent vector (every current rig/testbed boot).
// These tests pin BOTH halves of that back-compat contract.
const collectUrl = "https://www.google-analytics.com/mp/collect"; // DEFAULT_ENDPOINTS[0]
const readyOne = (body) => ({ data: { ready: [{ url: collectUrl, body }], dropped: [] } });

describe("bootEdsAnalytics consent wiring (spec 017-03 — the seal's egressPurposes gate)", () => {
  it("no `consent` opt at all -> the gate stays OFF: a ready beacon dispatches normally (back-compat)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    await bootEdsAnalytics({ ctx: { clientId: "1.1", sessionId: "2" } });
    FakeWorker.last.onmessage(readyOne("{}"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a wired `consent` vector with analytics_storage unresolved HOLDS a ready beacon (the gate engages once a host wires consent at all)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    await bootEdsAnalytics({ ctx: { clientId: "1.1", sessionId: "2" }, consent: {} });
    FakeWorker.last.onmessage(readyOne("{}"));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      "airlock:",
      expect.objectContaining({ kind: "consent", disposition: "held", purpose: "analytics_storage" }),
    );
    warnSpy.mockRestore();
  });

  it("handle.setConsent grants analytics_storage mid-session and flushes the held beacon", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);

    const handle = await bootEdsAnalytics({ ctx: { clientId: "1.1", sessionId: "2" }, consent: {} });
    FakeWorker.last.onmessage(readyOne('{"x":1}'));
    expect(fetchMock).not.toHaveBeenCalled();

    handle.setConsent({ analytics_storage: "granted" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(collectUrl, expect.objectContaining({ body: '{"x":1}' }));
  });
});

// Spec 019-01 (ADR-0012) — `payloadDenylist` threads through to `createAirlock`
// in parallel to endpoints/consent/egressPurposes (adapters/eds/index.js).
// `requestIdleCallback` is stubbed per-test (not in the shared beforeEach
// above) since none of the OTHER eds-boot tests ever call push() directly.
describe("bootEdsAnalytics payload-denylist wiring (spec 019-01 — ADR-0012)", () => {
  it("no `payloadDenylist` opt at all -> byte-unchanged: a pushed field crosses to the worker untouched (back-compat)", async () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const handle = await bootEdsAnalytics({ ctx: { clientId: "1.1", sessionId: "2" } });

    handle.push({ event: "cta_engage", email: "a@b.c" });

    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events.batch[0].params.email).toBe("a@b.c");
  });

  it("a wired `payloadDenylist` strips the denied field before it crosses to the worker (AC5 async leg)", async () => {
    vi.stubGlobal("requestIdleCallback", (cb) => { cb({ didTimeout: false, timeRemaining: () => 0 }); return 1; });
    const handle = await bootEdsAnalytics({
      ctx: { clientId: "1.1", sessionId: "2" },
      payloadDenylist: ["email"],
    });

    handle.push({ event: "cta_engage", email: "a@b.c", link_text: "Buy" });

    const events = FakeWorker.last.messages.find((m) => m.type === "events");
    expect(events.batch[0].params.email).toBeUndefined();
    expect(events.batch[0].params.link_text).toBe("Buy"); // benign field passes through
    // local log/projection is unaffected — governance strips only what crosses
    expect(handle.getState("cta_engage.params.email")).toBe("a@b.c");
  });

  it("a wired `payloadDenylist` strips the denied field from the sync pushCritical GA4 beacon body (AC5 sync leg)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const handle = await bootEdsAnalytics({
      ctx: { clientId: "1.1", sessionId: "2" },
      payloadDenylist: ["email"],
    });

    handle.pushCritical({ event: "page_view", email: "a@b.c", link_text: "Buy" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0].params.email).toBeUndefined();
    expect(body.events[0].params.link_text).toBe("Buy");
  });
});
