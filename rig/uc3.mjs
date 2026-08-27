// UC-3 block-decoration instrumentation on the REAL testbed page (spec 006-01,
// AC4+AC5) — the scroll-triggered view_block punchline, proven on the actual EDS boot
// sequence under the boilerplate CSP.
//
// Builds via `npm run build` (the adapter is the bundle entry — emits the two-entry
// bundle INTO the testbed's served tree), statically serves `probes/eds-testbed/` AS
// ROOT with the CSP header on every response (as `aem up`'s CDN would), then loads the
// REAL index.html at an 800px viewport with control forced
// (`?experiment=hero-cta/control`, so the shared below-the-fold blocks stay intact —
// a challenger swap would replace <main> from variant-b, which has no demo blocks).
//
// It asserts the ORDERED sequence (the verdict GATES on ALL):
//   1. after load, BEFORE any scroll — NO view_block beacon (the demo `.promo` block is
//      staged below the 800px fold, so the IntersectionObserver has not fired);
//   2. scroll the demo `.promo` block into view — exactly ONE view_block with
//      block_name="promo", MP-conformant (validates against the pinned GA4 MP schema);
//   3. scroll away (to top) and back to `.promo` — STILL exactly one (unobserved →
//      no re-fire);
//   4. the never-in-view `.teaser` control — NO view_block for it (block_name never
//      "teaser");
//   5. header/footer CHROME — NO view_block for it (block_name never "header"/"footer";
//      discovery is scoped to <main>, chrome lives outside it).
//
// The block view rides the STEADY-STATE push (worker cycle) — the rig flushNow()s the
// ring and waits for the beacon, as UC-1's exposure rig does.
//
// Usage: node rig/uc3.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import Ajv2020 from "ajv/dist/2020.js";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const ROOT = join(REPO, "probes/eds-testbed"); // the SERVED root, as under aem up
const VIEWPORT = { width: 1280, height: 800 };

// Hermetic conformance oracle (the same schema the worker maps against).
const validate = new Ajv2020({ allErrors: true, strict: false }).compile(
  JSON.parse(readFileSync(new URL("../contracts/ga4-mp-request.schema.json", import.meta.url))),
);

// 1. Build the two-entry bundle into the testbed tree (self-asserts the layout).
execSync("npm run build", { cwd: REPO, stdio: "inherit" });

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css", ".svg": "image/svg+xml",
  ".png": "image/png", ".ico": "image/x-icon",
};

// The exact EDS boilerplate CSP (no worker-src; require-trusted-types-for 'script').
const BOILERPLATE_CSP =
  "script-src 'nonce-aem' 'strict-dynamic' 'unsafe-inline' http: https:; " +
  "base-uri 'self'; object-src 'none'; frame-src 'self' https:; " +
  "require-trusted-types-for 'script';";

const server = http.createServer(async (req, res) => {
  try {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    else if (!extname(p)) p += ".html"; // model aem up's extensionless content serving
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": MIME[extname(file)] || "application/octet-stream",
      "content-security-policy": BOILERPLATE_CSP, // CSP on EVERY response (models the CDN header)
    });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT });
const page = await context.newPage();

// Capture every /collect* beacon: parsed name + block_name + raw body (for MP validation).
const beacons = [];
await page.route("**/collect*", (route) => {
  const raw = route.request().postData();
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch { /* keep {} */ }
  beacons.push({
    name: parsed?.events?.[0]?.name ?? null,
    block_name: parsed?.events?.[0]?.params?.block_name ?? null,
    body: raw,
  });
  return route.fulfill({ status: 204, body: "" });
});
const consoleNoise = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleNoise.push(m.text()); });
page.on("pageerror", (e) => consoleNoise.push("pageerror: " + String(e)));

const viewBlockBeacons = () => beacons.filter((b) => b.name === "view_block");
/** flushNow() the ring, then poll for `pred` up to `ms` (the block view rides the worker cycle). */
const drainAndWait = async (pred, ms) => {
  const deadline = Date.now() + ms;
  do {
    await page.evaluate(() => window.airlock && window.airlock.flushNow()).catch(() => {});
    if (beacons.some(pred)) return true;
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  return beacons.some(pred);
};
const scrollTo = (sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (el) el.scrollIntoView({ block: "center" });
}, sel);

// --- Boot the page (control forced → the shared below-the-fold blocks stay intact). ---
await page.goto(`http://localhost:${port}/index.html?experiment=hero-cta/control`);
await page
  .waitForFunction(
    () => (window.__flicker && window.__flicker.events.some((e) => e.name === "airlock:init"))
      || window.__airlockBootFailed !== undefined,
    { timeout: 20000 },
  )
  .catch(() => {});
const bootFailed = await page.evaluate(() => window.__airlockBootFailed ?? null);

// Prove the demo/control blocks were actually decorated (data-block-status present) and
// that the promo really starts below the fold at this viewport.
const domProbe = await page.evaluate(() => {
  const rectBelowFold = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return { present: true, decorated: el.dataset.blockStatus !== undefined, top: Math.round(el.getBoundingClientRect().top) };
  };
  return {
    promo: rectBelowFold(".promo"),
    teaser: rectBelowFold(".teaser"),
    innerHeight: window.innerHeight,
  };
});

// --- 1. BEFORE scroll: no view_block. (Drain the ring first to flush any exposure beacon.) ---
await drainAndWait(() => false, 800); // let boot's exposure push drain; nothing to match
const beforeScrollViewBlocks = viewBlockBeacons().length;

// --- 2. Scroll the demo `.promo` block into view → exactly one conformant view_block. ---
await scrollTo(".promo");
await page.waitForTimeout(200); // let the IntersectionObserver callback run
await drainAndWait((b) => b.name === "view_block" && b.block_name === "promo", 8000);
const afterPromoScroll = viewBlockBeacons();
const promoBeacon = afterPromoScroll.find((b) => b.block_name === "promo") || null;
let promoConformant = false;
try { promoConformant = promoBeacon ? validate(JSON.parse(promoBeacon.body)) === true : false; } catch { promoConformant = false; }

// --- 3. Scroll away (to top) and back to `.promo` → still exactly one (no re-fire). ---
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await scrollTo(".promo");
await page.waitForTimeout(200);
await drainAndWait(() => false, 800); // give any (erroneous) re-fire a chance to arrive + drain
const afterScrollBackCount = viewBlockBeacons().length;

// --- 4 + 5. The control block + the header/footer chrome must have produced NOTHING. ---
const teaserBeacons = viewBlockBeacons().filter((b) => b.block_name === "teaser");
const chromeBeacons = viewBlockBeacons().filter((b) => b.block_name === "header" || b.block_name === "footer");

await context.close();
await browser.close();
server.close();

// --- Verdict gates on the WHOLE ordered sequence. ---
const noViewBlockBeforeScroll = beforeScrollViewBlocks === 0;
const oneConformantPromoAfterScroll =
  afterPromoScroll.length === 1 && promoBeacon !== null && promoBeacon.block_name === "promo" && promoConformant;
const stillOneAfterScrollBack = afterScrollBackCount === 1;
const noTeaserViewBlock = teaserBeacons.length === 0;
const noChromeViewBlock = chromeBeacons.length === 0;
const promoStagedBelowFold = !!domProbe.promo && domProbe.promo.decorated && domProbe.promo.top > VIEWPORT.height;

const pass = bootFailed === null
  && promoStagedBelowFold
  && noViewBlockBeforeScroll
  && oneConformantPromoAfterScroll
  && stillOneAfterScrollBack
  && noTeaserViewBlock
  && noChromeViewBlock;

const out = {
  question: "on the REAL testbed page, is a decorated EDS block instrumented WITHOUT markup changes — firing exactly one MP-conformant view_block only after it is SCROLLED into view, once, never for the below-fold control, never for header/footer chrome?",
  pass,
  served_root: "probes/eds-testbed (static; aem-up root)",
  viewport: VIEWPORT,
  gate: "boot ok AND promo staged below fold AND no view_block before scroll AND exactly one conformant promo view_block after scroll AND still one after scroll-away-and-back AND none for the teaser control AND none for header/footer chrome",
  boot_failed: bootFailed,
  dom_probe: domProbe, // proves the blocks were decorated (data-block-status) + promo starts below the fold
  // 1. before scroll
  view_block_count_before_scroll: beforeScrollViewBlocks,
  no_view_block_before_scroll: noViewBlockBeforeScroll,
  // 2. after scrolling the demo block into view
  promo_view_block: promoBeacon ? { name: promoBeacon.name, block_name: promoBeacon.block_name } : null,
  promo_view_block_mp_conformant: promoConformant,
  one_conformant_promo_after_scroll: oneConformantPromoAfterScroll,
  // 3. scroll away + back
  view_block_count_after_scroll_back: afterScrollBackCount,
  still_one_after_scroll_back: stillOneAfterScrollBack,
  // 4 + 5. control + chrome fired nothing
  no_teaser_view_block: noTeaserViewBlock,
  no_chrome_view_block: noChromeViewBlock,
  view_block_beacons_seen: viewBlockBeacons().map((b) => b.block_name),
  console_noise_tolerated: consoleNoise, // block-module 404s expected under static serve
  verdict: pass
    ? "PASS — the promo block, staged below an 800px fold, was instrumented with no markup changes and fired exactly one MP-conformant view_block only after being scrolled into view; scrolling away and back did not re-fire; the never-in-view teaser control and the header/footer chrome fired nothing"
    : "FAIL — see flags above",
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
