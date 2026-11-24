import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Slice 068-03 AC4: bootAlloy registers the consent Alloy's refusal carries on the wire, through
// the host's `expectOptOutConsent`, on every path that posts consent. The real host is wrapped
// only to record the registrations; on main the endpoint ceiling still holds set-consent, so the
// forward itself is proven at the host (test/wrapped-sdk-host.test.js).
const registered = [];
vi.mock("../core/wrapped-sdk-host.js", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createWrappedSdkHost: (opts) => {
      const host = real.createWrappedSdkHost(opts);
      const orig = host.expectOptOutConsent;
      host.expectOptOutConsent = (v) => { registered.push(v); return orig(v); };
      return host;
    },
  };
});
const { bootAlloy } = await import("../adapters/eds/index.js");

const DS = "12345678-1234-1234-1234-123456789012";
const entry = (extra = {}) => ({ type: "alloy", bundleUrl: "https://airlock.example/alloy.js", datastreamId: DS, orgId: "ORG@AdobeOrg", ...extra });
const wire = (val) => [{ standard: "Adobe", version: "2.0", value: { collect: { val } } }];

class Worker1 {
  addEventListener() {}
  removeEventListener() {}
  postMessage() {}
  terminate() {}
}

beforeEach(() => {
  registered.length = 0;
  vi.stubGlobal("Worker", Worker1);
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

describe("068-03 AC4 — bootAlloy registers the vector-shaped consent", () => {
  it("registers the refusal at boot for a boot-time denial", async () => {
    await bootAlloy(entry({ consent: { analytics_storage: "denied", personalization: "denied" } }));
    expect(registered.at(-1)).toEqual([wire("n")]);
  });

  it("re-registers on handle.setConsent (the CMP onChange and a direct call both land here), grant then refusal", async () => {
    const handle = await bootAlloy(entry({ consent: { analytics_storage: "denied" } }));
    handle.setConsent({ analytics_storage: "granted" });
    // 064-34: each update adds a generation; none has been retired because no request has left yet.
    expect(registered.at(-1)).toEqual([wire("n"), wire("y")]);
    handle.setConsent({ analytics_storage: "denied" });
    expect(registered.at(-1)).toEqual([wire("n"), wire("y"), wire("n")]);
  });

  it("registers nothing with no consent vector and consentHold:false", async () => {
    await bootAlloy(entry({ consentHold: false }));
    expect(registered.at(-1)).toEqual([]);
  });
});
