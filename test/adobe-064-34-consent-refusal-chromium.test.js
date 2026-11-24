// Spec 064-34 AC2: the refusal pinned stock Alloy 2.31.1 puts on the wire for the page's Adobe 2.0 object equals the
// object the adapter registered, in real Chromium (SYNTHETIC answers, no capture). The airlock arm drives the handle; the
// stock arm runs the same call on the main thread. The hermetic overlap tests are in test/alloy-adobe-consent.test.js.
// Gated like the other real-browser tests: `AIRLOCK_REAL_CHROMIUM=1` (the `browser-oracle` job).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { chromium } from "playwright";
import { replayFixture } from "../rig/adobe-b1-replay.mjs";

const real = process.env.AIRLOCK_REAL_CHROMIUM === "1";
const T = 90000;
const DATASTREAM = "12345678-1234-1234-1234-123456789012";
const ORG = "908936ED5D35CC220A495CD4@AdobeOrg";
const cors = (req) => ({ "access-control-allow-origin": req.headers().origin || "*", "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, GET, OPTIONS" });
const respond = (req) => (req.method() !== "POST"
  ? { status: 204, headers: cors(req), body: "" }
  : { status: 200, headers: { "content-type": "application/json", ...cors(req) }, body: JSON.stringify({ requestId: "r", handle: [] }) });
const adobe = (value) => ({ standard: "Adobe", version: "2.0", value });
const REFUSAL = [adobe({ collect: { val: "n" }, personalize: { content: { val: "n" } } })];
const COLLECT_ONLY = [adobe({ collect: { val: "n" } })];
const consentBodies = (r) => r.network.filter((n) => n.method === "POST" && n.url.includes("/privacy/set-consent")).map((n) => JSON.parse(n.body).consent);

const stockSetup = (page) => page.evaluate(async ({ datastreamId, orgId }) => {
  window.__alloyNS = ["stockAlloy"];
  window.stockAlloy = function () { const a = arguments; return new Promise((res, rej) => window.stockAlloy.q.push([res, rej, a])); };
  window.stockAlloy.q = [];
  await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "/rig/alloy.min.js"; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  window.stockAlloy("configure", { datastreamId, orgId, defaultConsent: "pending", debugEnabled: false });
}, { datastreamId: DATASTREAM, orgId: ORG });
const stockConsent = (page, consent) => page.evaluate(async (c) => { try { await window.stockAlloy("setConsent", { consent: c }); return "ok"; } catch (e) { return String(e && e.message); } }, consent);
const ours = (browser, run) => replayFixture(browser, "s4-base", { event: null, bodyHtml: '<div id="z">orig</div>', bootOptions: { consentHold: null }, respond, run });
const stock = (browser, run) => replayFixture(browser, "s4-base", { event: null, boot: false, bodyHtml: '<div id="z">orig</div>', respond, run });

describe.runIf(real)("064-34 the refusal on the wire equals the registered object (real Chromium, pinned Alloy 2.31.1, SYNTHETIC answers)", () => {
  let browser;
  beforeAll(async () => { browser = await chromium.launch(); });
  afterAll(async () => { await browser?.close(); });

  it("a page refusal forwards the object stock Alloy puts on the wire, unchanged", async () => {
    const s = await stock(browser, (page) => stockSetup(page).then(() => stockConsent(page, REFUSAL)));
    const o = await ours(browser, (page) => page.evaluate(async (c) => { try { await window.__handle.setAdobeConsent(c); return "ok"; } catch (e) { return String(e && e.message); } }, REFUSAL));
    expect(consentBodies(s)).toEqual([REFUSAL]);
    expect(consentBodies(o)).toEqual([REFUSAL]);
  }, T);

  it("two updates in one tick: both refusals reach the wire, in order, as stock sends them", async () => {
    const pair = [COLLECT_ONLY, REFUSAL];
    const s = await stock(browser, (page) => stockSetup(page).then(() => page.evaluate(async (c) => { await Promise.allSettled([window.stockAlloy("setConsent", { consent: c[0] }), window.stockAlloy("setConsent", { consent: c[1] })]); }, pair)));
    const o = await ours(browser, (page) => page.evaluate(async (c) => { await Promise.allSettled([window.__handle.setAdobeConsent(c[0]), window.__handle.setAdobeConsent(c[1])]); }, pair));
    expect(consentBodies(s)).toEqual(pair);
    expect(consentBodies(o)).toEqual(pair);
  }, T);
});
