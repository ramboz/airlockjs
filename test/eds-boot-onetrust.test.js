import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { bootEdsAnalytics } from "../adapters/eds/index.js";
import { createAirlock } from "../core/airlock.js";
import { ERP_INTUIT_GROUP_PURPOSE_MAP, subscribeOnetrustConsentChanges } from "../drivers/consent/onetrust.js";

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

// Spec 047-02 AC3/AC4 — the OneTrust-accept flow, end-to-end against the REAL
// seal: a denied ad_storage beacon HOLDS under spec 045's `holdOnDenied`, then a
// fixture-invoked OneTrust consent-change GRANT — routed through
// `subscribeOnetrustConsentChanges` -> `airlock.setConsent` — flushes it. These
// are wired directly against `createAirlock` (like test/consent-seal.test.js's
// own holdOnDenied proof and test/google-ads-seal.test.js), NOT through
// `bootEdsAnalytics`: GA4's own core boot does not wire `holdOnDenied` for any
// purpose (ad-connector boot wiring is a separate, already-deferred concern,
// spec 044-01 §A2) — this proves the NEW driver-subscription TRIGGER against
// the EXISTING 045 mechanism, exactly as 044-02/046-03 proved the mechanism
// itself. No new flush codepath is exercised here.
describe("047-02 AC3/AC4 — the accept-flow: a held ad beacon flushes when OneTrust GRANTS via the subscribed change signal", () => {
  const AD_ENDPOINT = "https://ads.example/collect";

  // Fake connector re-mapper (mirrors test/consent-seal.test.js's own
  // makeRemap): rebuilds the beacon under the PASSED consent vector, so the
  // fired URL proves a RE-MAP happened, not a stale verbatim re-send.
  const makeRemap = () =>
    vi.fn((event, vector) => ({
      url:
        vector && vector.ad_storage === "granted"
          ? `${AD_ENDPOINT}?ev=${event.type}&granted=1`
          : `${AD_ENDPOINT}?ev=${event.type}&granted=0`,
      method: "GET",
    }));

  const heldReadyMsg = () =>
    readyMsg([{ url: `${AD_ENDPOINT}?ev=conversion&granted=0`, method: "GET", event: { type: "conversion" } }]);

  const makeAdAirlock = (opts) =>
    createAirlock({
      trackers: 1,
      workFactor: 0,
      endpoints: [AD_ENDPOINT],
      ctx: {},
      unloadCritical: [],
      egressPurposes: ["ad_storage"],
      holdOnDenied: true,
      consent: { ad_storage: "denied" },
      ...opts,
    });

  // Wires the driver's subscription helper against a fixture OneTrust +
  // fixture host global, exactly like the eds adapter would (onChange ->
  // handle.setConsent) — the driver itself never touches `airlock` directly.
  const wireFixtureSubscription = (airlock, fixtureWin) => {
    let captured;
    const fixtureOneTrust = {
      OnConsentChanged: (cb) => {
        captured = cb;
      },
    };
    subscribeOnetrustConsentChanges({
      onetrust: fixtureOneTrust,
      win: fixtureWin,
      groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP,
      onChange: (vector) => airlock.setConsent(vector),
    });
    return () => captured();
  };

  it("a fixture OneTrust GRANT re-maps + setConsent -> the held ad beacon flushes via the REAL seal", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = makeRemap();
    const airlock = makeAdAirlock({ remap });

    FakeWorker.last.onmessage(heldReadyMsg());
    expect(fetchMock).not.toHaveBeenCalled(); // held, not sent

    const fixtureWin = { OnetrustActiveGroups: ",1," }; // opted-out at subscribe time
    const fireChange = wireFixtureSubscription(airlock, fixtureWin);

    fixtureWin.OnetrustActiveGroups = ACTIVE_GRANTED; // the banner ACCEPT
    fireChange(); // OneTrust fires its change signal

    expect(remap).toHaveBeenCalledTimes(1);
    expect(remap).toHaveBeenCalledWith({ type: "conversion" }, expect.objectContaining({ ad_storage: "granted" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${AD_ENDPOINT}?ev=conversion&granted=1`);
  });

  it("revoke stops FUTURE egress but never un-sends: a later DENY holds a NEW beacon while the already-flushed one stays sent", () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const airlock = makeAdAirlock({ remap: makeRemap() });

    const fixtureWin = { OnetrustActiveGroups: ",1," };
    const fireChange = wireFixtureSubscription(airlock, fixtureWin);

    // Grant -> flush the one held beacon.
    FakeWorker.last.onmessage(heldReadyMsg());
    fixtureWin.OnetrustActiveGroups = ACTIVE_GRANTED;
    fireChange();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Revoke -> a NEW beacon HOLDS again (future egress stopped); the earlier
    // fetch call is untouched (already-sent is never recalled — ADR-0007).
    fixtureWin.OnetrustActiveGroups = ",1,";
    fireChange();
    FakeWorker.last.onmessage(
      readyMsg([{ url: `${AD_ENDPOINT}?ev=conversion2&granted=0`, method: "GET", event: { type: "conversion2" } }]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1); // still just the one earlier send
  });

  it("grant->deny->grant churn never throws (the driver side of AC4)", () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
    const airlock = makeAdAirlock({ remap: makeRemap() });
    const fixtureWin = { OnetrustActiveGroups: ",1," };
    const fireChange = wireFixtureSubscription(airlock, fixtureWin);

    expect(() => {
      fixtureWin.OnetrustActiveGroups = ACTIVE_GRANTED;
      fireChange();
      fixtureWin.OnetrustActiveGroups = ",1,";
      fireChange();
      fixtureWin.OnetrustActiveGroups = ACTIVE_GRANTED;
      fireChange();
    }).not.toThrow();
  });

  it("both grounded surfaces firing for ONE change is benign: setConsent runs twice, the held ad beacon flushes exactly ONCE", () => {
    // The subscription registers BOTH OnConsentChanged and OptanonWrapper (§A2),
    // so a real OneTrust change drives setConsent TWICE. Prove the second call is
    // a benign no-op against the REAL seal: core/airlock.js's setConsent only
    // flushes while heldBeacons.length is truthy, and the first call drains it —
    // so the held ad beacon re-maps + egresses exactly ONCE, never twice. (The
    // driver-level onChange count is pinned in test/onetrust-consent-driver.test.js;
    // this is the end-to-end "benign" half.)
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    const remap = makeRemap();
    const airlock = makeAdAirlock({ remap });
    const setConsentSpy = vi.spyOn(airlock, "setConsent");

    FakeWorker.last.onmessage(heldReadyMsg());
    expect(fetchMock).not.toHaveBeenCalled(); // held, not sent

    const fixtureWin = { OnetrustActiveGroups: ",1," }; // opted-out at subscribe time
    const fireOnConsentChanged = wireFixtureSubscription(airlock, fixtureWin);
    // wireFixtureSubscription passes BOTH `onetrust` and `win`, so subscribe has
    // ALSO installed fixtureWin.OptanonWrapper — the second grounded surface.
    expect(typeof fixtureWin.OptanonWrapper).toBe("function");

    fixtureWin.OnetrustActiveGroups = ACTIVE_GRANTED; // the banner ACCEPT — one logical change
    fireOnConsentChanged(); // surface 1: OnConsentChanged
    fixtureWin.OptanonWrapper(); // surface 2: OptanonWrapper (same change)

    expect(setConsentSpy).toHaveBeenCalledTimes(2); // both surfaces drove setConsent
    expect(remap).toHaveBeenCalledTimes(1); // but the held beacon re-mapped ONCE
    expect(fetchMock).toHaveBeenCalledTimes(1); // and egressed ONCE — the 2nd setConsent no-ops
    expect(fetchMock.mock.calls[0][0]).toBe(`${AD_ENDPOINT}?ev=conversion&granted=1`);
  });
});

// Spec 047-02 AC1/AC2 — the subscription is wired INTO the EDS boot itself
// (`bootGa4Core`, via `bootEdsAnalytics`), alongside 047-01's initial-read
// wiring: a fixture-invoked OneTrust change reaches this boot's OWN
// `handle.setConsent`, proven by flushing a beacon this SAME boot held at
// start (analytics_storage pending -> the seal's base pending-hold, no
// `holdOnDenied` needed for this purpose).
describe("047-02 — the OneTrust consent-change subscription is wired into the EDS boot alongside the initial read", () => {
  it("a fixture-invoked OneTrust change flushes a beacon this SAME boot held (unresolved-at-boot -> resolved via the subscribed change)", async () => {
    const fetchMock = vi.fn(() => Promise.resolve());
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("document", fakeDocument("_ga=GA1.1.5555555555.1600000000"));

    let captured;
    const fixtureOneTrust = {
      OnConsentChanged: (cb) => {
        captured = cb;
      },
    };
    const fixtureWin = { OnetrustActiveGroups: null };

    await bootEdsAnalytics({
      endpoints: [ENDPOINT],
      onetrust: {
        groupPurposeMap: ERP_INTUIT_GROUP_PURPOSE_MAP,
        activeGroups: null, // unresolved at boot -> analytics_storage pending -> held
        onetrust: fixtureOneTrust,
        win: fixtureWin,
      },
    });

    FakeWorker.last.onmessage(readyMsg([{ url: ENDPOINT, body: '{"n":1}' }]));
    expect(fetchMock).not.toHaveBeenCalled(); // held at boot (047-01 AC4)

    fixtureWin.OnetrustActiveGroups = ACTIVE_GRANTED; // OneTrust resolves mid-session
    captured();

    expect(fetchMock).toHaveBeenCalledTimes(1); // 047-02: the subscribed change flushed it
  });

  it("back-compat: a boot with NO `onetrust` wires no subscription — the guard holds even when a live OneTrust global is present", async () => {
    // Regression guard for the `if (onetrust)` gate in adapters/eds/index.js.
    // Put a real OneTrust surface on a stubbed window so a DROPPED guard would be
    // OBSERVABLE: an unguarded subscribe reads `globalWin` (= window here) and
    // would both register OnConsentChanged AND install OptanonWrapper. (The prior
    // assertion — resolves-truthy alone — passed VACUOUSLY: with window undefined
    // in node an unguarded subscribe is itself a no-op, so it never exercised the
    // guard at all.)
    const onConsentChanged = vi.fn();
    vi.stubGlobal("window", { OneTrust: { OnConsentChanged: onConsentChanged } });
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve()));
    vi.stubGlobal("document", fakeDocument("_ga=GA1.1.5555555555.1600000000"));

    await expect(bootEdsAnalytics({ endpoints: [ENDPOINT] })).resolves.toBeTruthy();

    expect(onConsentChanged).not.toHaveBeenCalled(); // guard held: no change-subscription registered
    expect(window.OptanonWrapper).toBeUndefined(); // guard held: no OptanonWrapper hook installed off globalWin
  });
});
