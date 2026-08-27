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
