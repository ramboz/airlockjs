// Spec 064-19 (B3): command coverage and the consent hold, replayed through the REAL chamber and seam
// in real Chromium. Extends the 064-17/18 replay harness (rig/adobe-b1-replay.mjs).
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1` (the `browser-oracle` CI job).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { bootAlloy } from "../adapters/eds/index.js";
import { diffBodies, loadFixture, replayFixture, splitRequestUrl } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 60000;
const kinds = (r, kind) => r.diagnostics.filter((d) => d.kind === kind);
const SCOPE = "airlock.readiness.2e2319c8";
const PV = { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } };
const posts = (fixture) => fixture.requests.filter((r) => r.method === "POST");
const consentCookie = { name: "kndctr_908936ED5D35CC220A495CD4_AdobeOrg_consent", value: "general=in", domain: "main--aem-eds-airlock-poc--adobe-rnd.aem.page" };

/** Every observed chamber request against its recorded request: same URL (minus requestId) and body. */
const byKey = (a, b) => (a.key < b.key ? -1 : 1);
/** Cookie-jar order of `meta.state.entries` is incidental; compare the set. */
const sortedState = (text) => {
  const b = JSON.parse(text);
  if (b.meta && b.meta.state && b.meta.state.entries) b.meta.state.entries = [...b.meta.state.entries].sort(byKey);
  return JSON.stringify(b);
};
function expectRecorded(r, expectedPosts, { ignore = {} } = {}) {
  expect(r.observed).toHaveLength(expectedPosts.length);
  r.observed.forEach((o, i) => {
    expect(splitRequestUrl(o.url).stable, `url ${i}`).toBe(splitRequestUrl(expectedPosts[i].url).stable);
    if (expectedPosts[i].request_body) {
      const diffs = diffBodies(sortedState(o.body), sortedState(expectedPosts[i].request_body)).filter((d) => !(ignore[i] || []).includes(d));
      expect(diffs, `body ${i}`).toEqual([]);
    }
  });
}

describe("064-19 AC2: function-valued options are never dropped silently (hermetic)", () => {
  it("a function-valued option is reported with its name before boot continues", async () => {
    const seen = [];
    const onDiagnostic = (d) => seen.push(d);
    await expect(bootAlloy({ onDiagnostic, onBeforeEventSend() {}, clickCollection: { filterClickProperties() {} }, onBeforeLinkClickSend() {} })).rejects.toThrow(/bundleUrl/);
    expect(seen.filter((d) => d.kind === "unsupported-callback").map((d) => d.option)).toEqual(["onBeforeEventSend", "filterClickProperties", "onBeforeLinkClickSend"]);
  });
});

describe("064-19 AC1: the 17-row command matrix has an owner for every row (hermetic)", () => {
  it("rows 1-17 each name a slice owner", async () => {
    const { readFile } = await import("node:fs/promises");
    const spec = await readFile(new URL("../docs/specs/064-adobe-parity-inventory/spec.md", import.meta.url), "utf8");
    const rows = [...spec.matchAll(/^\| (\d+) \| `([A-Za-z]+)` \| ([^|]+) \| ([^|]+) \| ([^|]+) \|/gm)].map((m) => ({ n: Number(m[1]), command: m[2], owner: m[5].trim() }));
    expect(rows.map((x) => x.n)).toEqual(Array.from({ length: 17 }, (_, i) => i + 1));
    for (const x of rows) expect(x.owner, x.command).toMatch(/^B[0-9]$/);
    const owned = (o) => rows.filter((x) => x.owner === o).map((x) => x.command);
    expect(owned("B3")).toEqual(["sendEvent", "applyResponse", "getIdentity", "appendIdentityToUrl", "getLibraryInfo", "setConsent", "createEventMergeId"]);
  });
});

describe.runIf(real)("064-19 command coverage (real Chromium)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); }, T);
  afterAll(async () => { await browser?.close(); });

  describe("AC1/AC4 S3: custom XDM and mergeId (row 3, row 9)", () => {
    const event = { event: "page_view", xdm: { ...PV, eventMergeId: "airlock064-merge-1", _airlock064: { probe: "custom-xdm" } } };
    for (const name of ["s3-base", "s3-repeat", "s11-s3"]) {
      it(`${name}: the interact compares clean`, async () => {
        const r = await replayFixture(browser, name, { event });
        expectRecorded(r, posts(r.fixture));
      }, T);
    }

    it("createEventMergeId returns a UUID and getLibraryInfo reports the pinned build", async () => {
      const r = await replayFixture(browser, "s3-base", { event, commands: [{ command: "createEventMergeId" }, { command: "getLibraryInfo" }] });
      expect(r.results.createEventMergeId.error).toBeUndefined();
      expect(r.results.createEventMergeId.result.eventMergeId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
      expect(r.results.getLibraryInfo.error).toBeUndefined();
      expect(r.results.getLibraryInfo.result.libraryInfo.version).toBe("2.31.1");
      // Both are worker-native: neither sent anything beyond the one recorded interact.
      expect(r.network.filter((n) => /adobedc|edge\./.test(n.url))).toHaveLength(1);
    }, T);

    it("applyResponse runs worker-native on a recorded body (row 4)", async () => {
      const fixture = await loadFixture("s3-base");
      const body = JSON.parse(posts(fixture)[0].response_body);
      const r = await replayFixture(browser, "s3-base", { event, commands: [{ command: "applyResponse", options: { renderDecisions: false, responseBody: body } }] });
      expect(r.results.applyResponse.error).toBeUndefined();
      expect(r.results.applyResponse.result).toBeTypeOf("object");
      expect(r.network.filter((n) => /adobedc|edge\./.test(n.url))).toHaveLength(1);
      expect(kinds(r, "unknown-handle")).toEqual([]);
    }, T);
  });

  describe("AC4 S4: decision scopes ride the interact (request side; rendering is B4's)", () => {
    for (const name of ["s4-base", "s4-repeat", "s4-active-base", "s4-active-repeat"]) {
      it(`${name}: the first interact carries the scope and __view__ as recorded`, async () => {
        const r = await replayFixture(browser, name, { event: null, commands: [{ command: "sendEvent", options: { xdm: PV, decisionScopes: [SCOPE], renderDecisions: true } }] });
        expect(r.results.sendEvent.error).toBeUndefined();
        const [first] = posts(r.fixture);
        expect(splitRequestUrl(r.observed[0].url).stable).toBe(splitRequestUrl(first.url).stable);
        expect(diffBodies(r.observed[0].body, first.request_body)).toEqual([]);
        const q = JSON.parse(r.observed[0].body).events[0].query.personalization;
        expect(q.decisionScopes).toEqual([SCOPE, "__view__"]);
      }, T);
    }
  });

  describe("AC3/AC4 S5: identity (rows 5 and 6)", () => {
    it("fresh: getIdentity and appendIdentityToUrl are worker-native after the one acquire", async () => {
      const r = await replayFixture(browser, "s5-fresh");
      const expected = (await loadFixture("s5-fresh")).capture.steps;
      const recId = expected.find((s) => s.step === "getIdentity").result;
      expect(r.results.getIdentity.error).toBeUndefined();
      expect(r.results.getIdentity.result.identity.ECID).toMatch(/^\d{38}$/);
      expect(r.results.getIdentity.result.edge).toEqual(recId.edge);
      expect(Object.keys(r.results.getIdentity.result)).toEqual(Object.keys(recId));
      const url = new URL(r.results.appendIdentityToUrl.result.url);
      expect(url.origin + url.pathname).toBe("https://destination.example/landing");
      const mc = { get: (k) => Object.fromEntries(url.searchParams.get("adobe_mc").split("|").map((p) => p.split("="))) [k] };
      expect(mc.get("MCMID")).toBe(r.results.getIdentity.result.identity.ECID);
      expect(mc.get("MCORGID")).toBe("908936ED5D35CC220A495CD4%40AdobeOrg");
      expect(Number(mc.get("TS"))).toBeGreaterThan(1.7e9);
      expect(r.network.filter((n) => /adobedc|edge\./.test(n.url)).map((n) => new URL(n.url).pathname)).toEqual(["/ee/v1/identity/acquire"]);
    }, T);

    it("returning: nothing is sent, the stored ECID is the identity", async () => {
      const r = await replayFixture(browser, "s5-returning");
      const rec = (await loadFixture("s5-returning")).capture.steps.find((s) => s.step === "getIdentity").result;
      expect(r.results.getIdentity.result.identity.ECID).toBe(rec.identity.ECID);
      expect(r.results.getIdentity.result.edge).toEqual({});
      expect(new URL(r.results.appendIdentityToUrl.result.url).searchParams.get("adobe_mc")).toContain(`MCMID=${rec.identity.ECID}`);
      expect(r.network.filter((n) => /adobedc|edge\./.test(n.url))).toEqual([]);
    }, T);
  });

  describe("AC4 S6: the consent hold with the recorded consent state (row 8)", () => {
    const run = (grant, wait = 0) => async (page) => {
      await page.evaluate(() => { window.__handle.push({ event: "page_view", xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } } }); window.__handle.push({ event: "page_view", xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } } }); });
      await page.waitForTimeout(300 + wait);
      const held = await page.evaluate(() => window.__observed.length);
      await page.evaluate((v) => window.__handle.setConsent(v), grant ? { analytics_storage: "granted", personalization: "granted" } : { analytics_storage: "denied", personalization: "denied" });
      await page.waitForTimeout(1200);
      return { held };
    };
    const boot = { consentHold: null };

    it("s6-in: nothing leaves while pending; on grant the set-consent and both queued events go as recorded", async () => {
      const r = await replayFixture(browser, "s6-in", { event: null, bootOptions: boot, run: run(true) });
      expect(r.results.run.held).toBe(0);
      expect(r.network.map((n) => new URL(n.url).pathname)).toEqual(posts(r.fixture).map((q) => new URL(q.url).pathname));
      expectRecorded(r, posts(r.fixture));
    }, T);

    it("s6-pending-in: a three-second wait while pending sends nothing, then the grant behaves like s6-in", async () => {
      const r = await replayFixture(browser, "s6-pending-in", { event: null, bootOptions: boot, run: run(true, 3000) });
      expect(r.results.run.held).toBe(0);
      expect(r.network.map((n) => new URL(n.url).pathname)).toEqual(posts(r.fixture).map((q) => new URL(q.url).pathname));
      expectRecorded(r, posts(r.fixture));
    }, T);

    it("s6-out: queued events are dropped; the set-consent n is held at the seal (the one documented S6 delta)", async () => {
      const r = await replayFixture(browser, "s6-out", { event: null, bootOptions: boot, run: run(false) });
      expect(r.results.run.held).toBe(0);
      // Recorded: stock sends the opt-out to demdex. Here the strict consent gate holds it, visibly (ADR-0062 exception).
      expect(posts(r.fixture).map((q) => new URL(q.url).pathname)).toEqual(["/ee/v1/privacy/set-consent"]);
      expect(r.observed.map((o) => new URL(o.url).pathname)).toEqual(["/ee/v1/privacy/set-consent"]);
      expect(r.network).toEqual([]);
      expect(kinds(r, "consent").filter((d) => d.disposition === "held" && d.beaconId)).toHaveLength(1);
    }, T);
  });

  describe("AC4 S7: page view, link click and SPA view (row 3, section 2.2 lifecycle)", () => {
    const run = (name) => replayFixture(browser, name, {
      event: null,
      commands: [
        { command: "sendEvent", options: { xdm: PV } },
        { command: "sendEvent", options: { xdm: { eventType: "web.webinteraction.linkClicks", web: { webInteraction: { name: "airlock064-link", type: "other", URL: "https://destination.example/landing", linkClicks: { value: 1 } } } } } },
        { command: "sendEvent", options: { renderDecisions: true, xdm: { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-view-2", viewName: "airlock064-view-2" } } } } },
      ],
    });
    for (const name of ["s7-base", "s7-repeat"]) {
      it(`${name}: the three interacts compare clean`, async () => {
        const r = await run(name);
        // The capture sent the first two events from its own run URL, then pushState'd to the manifest URL;
        // the replay page starts at the manifest URL, so the run-specific URL is the only expected difference.
        const url = "events[0].xdm.web.webPageDetails.URL";
        expectRecorded(r, posts(r.fixture), { ignore: { 0: [url], 1: [url] } });
        expect(JSON.parse(posts(r.fixture)[0].request_body).events[0].xdm.web.webPageDetails.URL).toMatch(/airlock-capture=v1/);
      }, T);
    }
  });

  describe("067-03 residual: a request held under pending consent is dropped, not replayed, on grant", () => {
    it("the seam holds the stale-cookie request once; a later grant does not replay it", async () => {
      const r = await replayFixture(browser, "s2-base", {
        bootOptions: { consentHold: null },
        extraCookies: [consentCookie],
        run: async (page) => {
          await page.waitForTimeout(300);
          const before = await page.evaluate(() => window.__observed.length);
          await page.evaluate(() => window.__handle.setConsent({ analytics_storage: "granted", personalization: "granted" }));
          await page.waitForTimeout(1200);
          return { before };
        },
      });
      expect(r.results.run.before).toBe(1);
      expect(kinds(r, "consent").filter((d) => d.disposition === "held" && d.beaconId)).toHaveLength(1);
      // Dropped, not flushed: the grant sends only Alloy's own set-consent; the held interact is never replayed.
      expect(r.network.map((n) => new URL(n.url).pathname)).toEqual(["/ee/or2/v1/privacy/set-consent"]);
    }, T);
  });
});
