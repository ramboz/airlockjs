// Spec 064-17 (B1): the frozen Adobe capture corpus replayed through the REAL chamber in real
// Chromium. Each fixture's recorded before-state is fed to the page before it loads; what the
// chamber emits must equal what stock Alloy 2.31.1 sent, except for the generated fields (compared
// by shape) and, per variant, the exact differences of spec 064 section 4.3.
//
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1` (the `browser-oracle` CI job).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { diffBodies, loadFixture, recordedDelta, recordedInteract, replayFixture, splitRequestUrl } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";

// One-factor-at-a-time expectations against the S1 base (spec 064 section 4.3).
const S1_VARIANTS = {
  "s1-viewport": ["events[0].xdm.device.screenHeight", "events[0].xdm.device.screenWidth", "events[0].xdm.environment.browserDetails.viewportHeight", "events[0].xdm.environment.browserDetails.viewportWidth"],
  "s1-referrer": ["events[0].xdm.web.webReferrer.URL"],
  "s1-locale": [],
  "s1-timezone": ["events[0].xdm.placeContext.localTimezoneOffset"], // localTime is generated and compared by shape
  "s1-edge-domain": [],
  "s1-repeat-1": [],
  "s1-repeat-2": [],
};
const URL_VOLATILE = ["events[0].xdm.web.webPageDetails.URL"]; // the run id inside the page URL

describe("recorded variants differ from the S1 base by exactly the spec 064 section 4.3 set", () => {
  // Pure fixture arithmetic: proves the expectation table above is what the corpus recorded, so a
  // clean replay of every variant means the replay set exactly those inputs.
  for (const [name, expected] of Object.entries(S1_VARIANTS)) {
    it(name, async () => {
      const base = recordedInteract(await loadFixture("s1-base"));
      const variant = recordedInteract(await loadFixture(name));
      const delta = recordedDelta(base.request_body, variant.request_body).filter((p) => !URL_VOLATILE.includes(p));
      expect(delta).toEqual([...expected].sort());
    });
  }

  it("locale differs only in the Accept-Language header", async () => {
    const base = recordedInteract(await loadFixture("s1-base"));
    const de = recordedInteract(await loadFixture("s1-locale"));
    expect([base.request_headers["accept-language"], de.request_headers["accept-language"]]).toEqual(["en-US", "de-DE"]);
  });
});

describe.runIf(real)("064-17 replay through the real chamber (real Chromium)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); }, 60000);
  afterAll(async () => { await browser?.close(); });

  const interactNames = ["s1-base", "s1-repeat-1", "s1-repeat-2", ...Object.keys(S1_VARIANTS).filter((n) => !n.startsWith("s1-repeat")), "s2-base", "s2-repeat"];
  for (const name of new Set(interactNames)) {
    it(`${name}: the chamber's request equals the recorded stock request`, async () => {
      const r = await replayFixture(browser, name);
      const expected = recordedInteract(r.fixture);
      const [sent] = r.observed;
      expect(sent, "the chamber emitted a request").toBeTruthy();

      const a = splitRequestUrl(sent.url);
      const e = splitRequestUrl(expected.url);
      expect(a.stable).toBe(e.stable);
      expect(a.requestIdValid && e.requestIdValid).toBe(true);
      expect(sent.method).toBe("POST");
      expect(diffBodies(sent.body, expected.request_body)).toEqual([]);
      expect(sent.headers["Content-Type"] || sent.headers["content-type"]).toBe(expected.request_headers["content-type"]);

      // The S1 interact is on the seal's endpoint ceiling, so the network saw it: its headers carry
      // the locale and origin Chromium itself derived from the seeded context.
      const seen = r.network.find((n) => n.url === sent.url);
      if (seen) {
        expect(seen.headers["accept-language"]).toBe(expected.request_headers["accept-language"]);
        expect(seen.headers.origin).toBe(expected.request_headers.origin);
      }
    }, 60000);
  }

  it("S2 returning feeds the recorded cookies into meta.state.entries", async () => {
    const r = await replayFixture(browser, "s2-base");
    const state = JSON.parse(r.observed[0].body).meta.state;
    expect(state.entries.map((x) => x.key).sort()).toEqual(r.fixture.manifest.input_state.storage_before.cookies.filter((c) => c.name.startsWith("kndctr_")).map((c) => c.name).sort());
    expect(state.domain).toBe("main--aem-eds-airlock-poc--adobe-rnd.aem.page");
  }, 60000);

  it("S5 fresh asks identity/acquire with the recorded body", async () => {
    const r = await replayFixture(browser, "s5-fresh");
    const expected = recordedInteract(r.fixture);
    const [sent] = r.observed;
    expect(splitRequestUrl(sent.url).stable).toBe(splitRequestUrl(expected.url).stable);
    expect(diffBodies(sent.body, expected.request_body)).toEqual([]);
  }, 60000);

  it("S5 returning makes no request: the ECID comes from the seeded cookies", async () => {
    const r = await replayFixture(browser, "s5-returning");
    expect(r.observed).toEqual([]);
    const recorded = r.fixture.capture.steps.find((s) => s.step === "getIdentity").result;
    expect(r.results.getIdentity.result.identity.ECID).toBe(recorded.identity.ECID);
    const strip = (u) => u.replace(/TS%3D\d+/, "TS%3D0");
    const wantUrl = r.fixture.capture.steps.find((s) => s.step === "appendIdentityToUrl").result.url;
    expect(strip(r.results.appendIdentityToUrl.result.url)).toBe(strip(wantUrl));
  }, 60000);

  it("without the before-state the same page asks the edge instead (the seed is what S2 and S5-returning rely on)", async () => {
    const r = await replayFixture(browser, "s5-returning", { seed: false });
    expect(r.observed.length).toBeGreaterThan(0);
  }, 60000);

  describe("AC1: a reduced `context` is the site's opt-in; the denylist stays on", () => {
    it("context [web] sends no device or environment, only web", async () => {
      const r = await replayFixture(browser, "s1-base", { bootOptions: { context: ["web"] } });
      const xdm = JSON.parse(r.observed[0].body).events[0].xdm;
      expect(Object.keys(xdm)).toContain("web");
      expect(xdm).not.toHaveProperty("device");
      expect(xdm).not.toHaveProperty("environment");
    }, 60000);

    it("a denylisted url becomes the documented host-root difference, not a failure", async () => {
      const r = await replayFixture(browser, "s1-base", { bootOptions: { payloadDenylist: ["url"] }, event: { event: "page_view" } });
      const xdm = JSON.parse(r.observed[0].body).events[0].xdm;
      expect(xdm.web.webPageDetails.URL).toBe(`${new URL(r.fixture.manifest.input_state.url).origin}/`);
    }, 60000);
  });
});
