import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootEdsAnalytics } from "../adapters/eds/index.js";
import { ERP_INTUIT_GROUP_PURPOSE_MAP } from "../drivers/consent/onetrust.js";

// Spec 047-01 AC3/AC4 — the driver->boot path. The OneTrust-derived vector is fed as
// the EDS boot's `consent` option (the existing `bootGa4Core` pre-construction fold +
// `egressPurposes` gating), with NO change to any seal codepath:
//   - a GRANTED OneTrust surface egresses exactly as an all-granted page does today;
//   - an ABSENT/unresolved surface holds at the seal (fail-to-pending), never sends;
//   - a boot that does NOT wire OneTrust is byte-unchanged (back-compat).
// Verified against the REAL `core/airlock.js` seal via the SAME FakeWorker pattern
// test/consent-seal.test.js uses (a `ready` reply simulated on FakeWorker.last.onmessage).

const ENDPOINT = "https://t0.example/collect";
const ACTIVE_GRANTED = ",1,BG394,4,"; // §A5 accept-all capture (redacted group-id string)
const GRANTED_ALL = {
  ad_storage: "granted",
  analytics_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
};

class FakeWorker {
  constructor(url, opts) {
    FakeWorker.last = this;
    this.url = String(url);
    this.opts = opts;
    this.messages = [];
    this.onmessage = null;
    this.onerror = null;
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
const readyMsg = (reqs) => ({ data: { ready: reqs, dropped: [] } });

beforeEach(() => {
  FakeWorker.last = null;
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
});
afterEach(() => vi.unstubAllGlobals());

describe("AC3 — the OneTrust-derived vector feeds the seam's `consent` param (driver->boot)", () => {
  it("granted OneTrust surface -> the folded ctx.consent is byte-identical to an explicit all-granted vector", async () => {
    vi.stubGlobal("document", fakeDocument("_ga=GA1.1.5555555555.1600000000"));
    await bootEdsAnalytics({
      endpoints: [ENDPOINT],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, activeGroups: ACTIVE_GRANTED },
    });
    const derived = initMsg().ctx.consent;

    // Boot the SAME page with an explicit all-granted vector (today's host-callback path).
    FakeWorker.last = null;
    vi.stubGlobal("document", fakeDocument("_ga=GA1.1.5555555555.1600000000"));
    await bootEdsAnalytics({ endpoints: [ENDPOINT], consent: GRANTED_ALL });
    const explicit = initMsg().ctx.consent;

    expect(derived).toEqual(explicit);
    expect(derived).toEqual({ ad_user_data: "GRANTED", ad_personalization: "GRANTED" });
  });

  it("granted OneTrust surface -> a ready beacon SENDS at the seal (parity with an all-granted page)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", fakeDocument("_ga=GA1.1.5555555555.1600000000"));

    await bootEdsAnalytics({
      endpoints: [ENDPOINT],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, activeGroups: ACTIVE_GRANTED },
    });
    FakeWorker.last.onmessage(readyMsg([{ url: ENDPOINT, body: '{"n":1}' }]));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("AC4 — an absent/unresolved OneTrust boot HOLDS at the seal (fail-to-pending, never fail-to-send)", () => {
  it("absent surface (activeGroups null) -> consent wired empty -> analytics_storage pending -> beacon HELD (no egress)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", fakeDocument(""));

    await bootEdsAnalytics({
      endpoints: [ENDPOINT],
      onetrust: { groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP, activeGroups: null },
    });
    FakeWorker.last.onmessage(readyMsg([{ url: ENDPOINT, body: '{"n":1}' }]));

    expect(fetchMock).not.toHaveBeenCalled(); // pending -> held, never leaked
  });

  it("back-compat: a boot with NO `onetrust` and NO `consent` is byte-unchanged (egressPurposes []) -> SENDS", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", fakeDocument("_ga=GA1.1.5555555555.1600000000"));

    await bootEdsAnalytics({ endpoints: [ENDPOINT] });
    FakeWorker.last.onmessage(readyMsg([{ url: ENDPOINT, body: '{"n":1}' }]));

    expect(fetchMock).toHaveBeenCalledTimes(1); // no consent wired -> no seal gate -> send
  });
});
