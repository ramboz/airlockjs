// Spec 064-27: the default storage grant is the stock Alloy 2.31.1 set, so a granted key persists across page
// loads and is reused, as stock reuses it. Stock Alloy runs on the main thread as the reference (same page,
// same bundle, same synthetic answers). Everything is SYNTHETIC: no capture has a storage before-state, and
// the page inputs are fake values (064-17 notes, "Storage names").
//
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1` (the `browser-oracle` CI job).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { loadFixture, replayFixture } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 90000;
const ORG = "908936ED5D35CC220A495CD4@AdobeOrg";
const DATASTREAM = "12345678-1234-1234-1234-123456789012";
const HASH_KEY = "com.adobe.alloy.908936ED5D35CC220A495CD4_AdobeOrg.consentHashes.Adobe.2.0";
const CLIENT_KEY = "com.adobe.alloy.validation.clientId";
const FAKE_SESSION = "00000000-fake-0000-0000-sessionid000";
const CONSENT = { consent: [{ standard: "Adobe", version: "2.0", value: { collect: { val: "y" } } }] };
const PV_XDM = { eventType: "web.webpagedetails.pageViews", web: { webPageDetails: { name: "airlock064-page" } } };

const cors = (req) => ({ "access-control-allow-origin": req.headers().origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" });
const answer = (req) => (req.method() === "POST"
  ? { status: 200, headers: { "content-type": "application/json", ...cors(req) }, body: JSON.stringify({ requestId: "00000000-0000-0000-0000-000000000027", handle: [] }) }
  : { status: 204, headers: cors(req), body: "" });

/** Stock Alloy on the MAIN thread, run twice in one browser context (a reload between). */
const loadStock = (page, steps) => page.evaluate(async ({ steps, datastreamId, orgId }) => {
  window.__alloyNS = ["stockAlloy"];
  window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
  window.stockAlloy.q = [];
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  window.stockAlloy("configure", { datastreamId, orgId, defaultConsent: "in", debugEnabled: false });
  if (steps.consent) await window.stockAlloy("setConsent", steps.consent);
  if (steps.event) await window.stockAlloy("sendEvent", steps.event);
}, { steps, datastreamId: DATASTREAM, orgId: ORG });

const loadAirlock = async (page, steps) => {
  if (steps.consent) await page.evaluate((o) => window.__command("setConsent", o), steps.consent);
  if (steps.event) await page.evaluate((e) => window.__handle.push(e), { event: "page_view", xdm: steps.event.xdm });
};

const reload = async (page) => {
  await page.reload({ waitUntil: "load" });
  await page.waitForFunction(() => window.__worker && window.__handle, null, { timeout: 15000 });
};

const alloyKeys = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("com.adobe.alloy.")).map((k) => [k, localStorage.getItem(k)])));

/** Two page loads in one context; returns the per-load requests matching `match` and the final stock-key dump. */
const twoLoads = async (browser, fixture, { arm, steps, match, waitFirst = true, expectSecond = false, opts = {} }) => {
  // Stock clears its hashes at startup unless both the identity and the consent cookie exist (components/Consent/createComponent.js).
  const host = new URL((typeof fixture === "string" ? await loadFixture(fixture) : fixture).manifest.input_state.url).hostname;
  const cookies = ["identity", "consent"].map((n) => ({ name: `kndctr_908936ED5D35CC220A495CD4_AdobeOrg_${n}`, value: n === "consent" ? "general=in" : "fake-identity", domain: host }));
  const load = (page) => (arm === "stock" ? loadStock(page, steps) : loadAirlock(page, steps));
  const r = await replayFixture(browser, fixture, {
    seed: false, event: null, respond: answer, extraCookies: cookies, ...opts,
    run: async (page) => {
      const seen = [[], []];
      let n = 0;
      page.on("request", (req) => { if (match(req)) seen[n].push(req.url()); });
      await load(page);
      for (let i = 0; waitFirst && i < 100 && !seen[0].length; i++) await page.waitForTimeout(100);
      const afterFirst = await alloyKeys(page);
      n = 1;
      await reload(page);
      await load(page);
      // Poll for a request that is expected on load 2; absence cannot be awaited, so keep a bounded settle.
      for (let i = 0; expectSecond && i < 100 && !seen[1].length; i++) await page.waitForTimeout(100);
      await page.waitForTimeout(1000);
      return { seen, afterFirst, afterSecond: await alloyKeys(page) };
    },
  });
  return { ...r, ...r.results.run };
};

describe.runIf(real)("064-27 the stock storage grant (real Chromium, pinned Alloy 2.31.1, SYNTHETIC page inputs)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); }, T);
  afterAll(async () => { await browser?.close(); });

  describe("consent hashes: stored on load 1, reused on load 2, as stock", () => {
    const run = (arm) => twoLoads(browser, "s1-base", { arm, steps: { consent: CONSENT }, match: (req) => req.method() === "POST" && req.url().includes("/privacy/set-consent") });

    it("stock Alloy writes the hash and skips the second set-consent (the reference)", async () => {
      const stock = await run("stock");
      expect(stock.afterFirst[HASH_KEY]).toMatch(/^[0-9a-f]+$/);
      expect(stock.seen.map((s) => s.length)).toEqual([1, 0]);
    }, T);

    it("airlock persists the same hash value in page localStorage and sends no second set-consent", async () => {
      const stock = await run("stock");
      const ours = await run("airlock");
      expect(ours.afterFirst).toEqual(stock.afterFirst);
      expect(ours.afterSecond).toEqual(stock.afterSecond);
      expect(ours.seen.map((s) => s.length)).toEqual([1, 0]);
    }, T);
  });

  describe("Assurance clientId: generated once, reused across loads, as stock", () => {
    const assured = async () => {
      const f = structuredClone(await loadFixture("s1-base"));
      const u = new URL(f.manifest.input_state.url);
      u.searchParams.set("adb_validation_sessionid", FAKE_SESSION);
      f.manifest.input_state.url = u.toString();
      return f;
    };
    const tokens = (arm, f) => twoLoads(browser, f, { arm, steps: { event: { xdm: PV_XDM } }, expectSecond: true, match: (req) => req.url().includes("adobeAepValidationToken=") })
      .then((r) => ({ ...r, ids: r.seen.map((urls) => urls.map((u) => new URL(u).searchParams.get("adobeAepValidationToken").split("|")[1])) }));

    it("stock reuses one clientId across both loads (the reference)", async () => {
      const r = await tokens("stock", await assured());
      expect(r.ids[0][0]).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.ids[1][0]).toBe(r.ids[0][0]);
      expect(r.afterSecond[CLIENT_KEY]).toBe(r.ids[0][0]);
    }, T);

    it("airlock persists the clientId in page localStorage and reuses it on the next load", async () => {
      const r = await tokens("airlock", await assured());
      expect(r.ids[0][0]).toMatch(/^[0-9a-f-]{36}$/);
      expect(r.ids[1][0]).toBe(r.ids[0][0]);
      expect(r.afterSecond[CLIENT_KEY]).toBe(r.ids[0][0]);
    }, T);
  });

  describe("outside the grant stays blocked", () => {
    it("a site narrowing the grant drops the consent-hash write at the seal, visibly, and persists nothing", async () => {
      const r = await twoLoads(browser, "s1-base", {
        arm: "airlock", steps: { consent: CONSENT }, match: () => false, waitFirst: false,
        opts: { bootOptions: { storageGrantNarrowing: { localStorage: [CLIENT_KEY] } } },
      });
      expect(r.afterFirst[HASH_KEY]).toBeUndefined();
      expect(r.afterSecond[HASH_KEY]).toBeUndefined();
      expect(r.diagnostics.some((d) => d.kind === "storage-scope" && d.name === HASH_KEY)).toBe(true);
    }, T);

    it("a page key outside the stock set is left alone while the granted hash is written", async () => {
      const f = structuredClone(await loadFixture("s1-base"));
      f.manifest.input_state.storage_before.local_storage = { "fake.page.secret": "fake-value" };
      const r = await replayFixture(browser, f, {
        commands: [{ command: "setConsent", options: CONSENT }], respond: answer,
        run: (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))),
      });
      expect(r.results.run["fake.page.secret"]).toBe("fake-value");
      expect(r.results.run[HASH_KEY]).toMatch(/^[0-9a-f]+$/);
      expect(r.diagnostics.filter((d) => d.kind === "storage-scope")).toEqual([]);
    }, T);
  });
});
