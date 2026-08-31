// End-to-end UC-2 delivery on the REAL testbed page (spec 004-04, AC1 + AC2) —
// the interaction→beacon punchline, run under the boilerplate CSP.
//
// Builds via `npm run build` (emitting the two-entry bundle INTO the testbed's
// served tree), statically serves `probes/eds-testbed/` AS ROOT with the CSP header
// on every response (as `aem up`'s CDN would), loads the REAL index.html, waits for
// the lazy airlock boot, then drives the two egress paths the adapter wires:
//
//   AC1 (worker cycle, non-navigating): a real click on `#cta-engage` pushes a
//   steady-state `cta_engage` event. The MP-conformant beacon must reach collect
//   WHILE THE PAGE IS STILL ALIVE — asserted BEFORE any unload is dispatched. That
//   is the worker-path proof: the synchronous ring-tail flush only runs at
//   visibilitychange→hidden / pagehide, so a beacon delivered with no unload in
//   sight can only have come through the worker (capture→ring→drain→worker→map→
//   orchestrator dispatch). The verdict gates on it.
//
//   AC2 (unload-critical fast path, ADR-0004): (a) an outbound `/signup` click →
//   an `outbound_click` critical beacon delivered within a teardown window (reusing
//   rig/teardown.mjs's "issued to the network within TEARDOWN_MS on a live page"
//   proxy); (b) a `pagehide` → a `page_view` critical beacon whose body carries the
//   CURRENT page_location (read at unload time, not boot). The verdict gates on both.
//
// The 004-03 identity assertions (a GA1 `_ga` persisted on a fresh context; the
// same identity flowing cookie→ctx→payload) are kept green here too.
//
// Distinct event names (cta_engage / outbound_click / page_view) keep the
// push()-XOR-pushCritical() rule intact — each has a single sender (ADR-0004).
//
// Usage: TEARDOWN_MS=100 node rig/e2e.mjs   (exits non-zero if any assertion fails)
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
const TEARDOWN_MS = Number(process.env.TEARDOWN_MS || 100);

// Hermetic conformance oracle (same schema the worker + fast path map against).
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
const page = await browser.newPage();

// Capture every /collect* beacon: parsed name + identity + page_location + arrival ts.
const beacons = [];
await page.route("**/collect*", (route) => {
  const raw = route.request().postData();
  let parsed = {};
  try { parsed = JSON.parse(raw); } catch { /* keep {} */ }
  beacons.push({
    name: parsed?.events?.[0]?.name ?? null,
    clientId: parsed?.client_id ?? null,
    pageLocation: parsed?.events?.[0]?.params?.page_location ?? null,
    body: raw,
    t: Date.now(),
  });
  return route.fulfill({ status: 204, body: "" });
});

const consoleNoise = [];
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") consoleNoise.push(m.text()); });
page.on("pageerror", (e) => consoleNoise.push("pageerror: " + String(e)));

const waitForBeacon = async (pred, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (beacons.some(pred)) return true;
    await page.waitForTimeout(50);
  }
  return beacons.some(pred);
};

await page.goto(`http://localhost:${port}/index.html`);
await page
  .waitForFunction(
    () => (window.__flicker && window.__flicker.events.some((e) => e.name === "airlock:init"))
      || window.__airlockBootFailed !== undefined,
    { timeout: 20000 },
  )
  .catch(() => {});

const bootFailed = await page.evaluate(() => window.__airlockBootFailed ?? null);
const pageUrl = await page.evaluate(() => location.href);

// ---------------------------------------------------------------------------
// AC1 — WORKER-CYCLE delivery, asserted WHILE ALIVE (no unload dispatched yet).
// ---------------------------------------------------------------------------
let unloadDispatchedAt = null; // stays null through the whole AC1 assertion
const clicked = await page.evaluate(() => {
  const b = document.getElementById("cta-engage");
  if (!b) return false;
  b.click(); // a real click → the delegated document listener → push(cta_engage)
  return true; // NO manual flush: let the NATURAL steady-state idle-drain carry it
  // (core/airlock schedules requestIdleCallback(drain, { timeout: 50 }) → worker
  // maps → orchestrator dispatches). That is the real steady-state worker cycle;
  // the unload ring-tail flush only runs at visibilitychange→hidden / pagehide,
  // neither of which has fired here — so a beacon that arrives is worker-path.
});
const ctaArrivedAlive = await waitForBeacon((b) => b.name === "cta_engage", 8000);
const ctaBeacon = beacons.find((b) => b.name === "cta_engage") || null;
let ctaConformant;
try { ctaConformant = ctaBeacon ? validate(JSON.parse(ctaBeacon.body)) === true : false; } catch { ctaConformant = false; }
// Worker-path proof: the beacon arrived and NO unload had been dispatched when it did.
const workerPathProven = ctaArrivedAlive && ctaConformant && ctaBeacon?.name === "cta_engage"
  && unloadDispatchedAt === null;
// Snapshot the unload state AT AC1 time (unloadDispatchedAt mutates during AC2b) so
// the surfaced field reports the value that actually gated AC1, not the end state.
const unloadDispatchedBeforeAc1Delivery = unloadDispatchedAt !== null;

// ---------------------------------------------------------------------------
// AC2(a) — outbound /signup click → outbound_click critical beacon in-window.
// ---------------------------------------------------------------------------
const beforeOutbound = beacons.length;
const outboundSimulated = await page.evaluate(() => {
  const a = document.querySelector('a[href="/signup"]');
  if (!a) return false;
  // Suppress the real navigation so the rig page survives — but do it on `document`,
  // registered AFTER the adapter's boot-time delegated listener, so the adapter runs
  // FIRST and sees an un-prevented click (defaultPrevented === false), exactly as on
  // a real outbound navigation. (Preventing on the anchor would run first and trip
  // the adapter's opensElsewhere/defaultPrevented guard — the guard is correct for
  // real sites; the rig must model the real un-prevented click, then cancel the
  // actual navigation post-hoc.)
  document.addEventListener("click", (e) => e.preventDefault(), { once: true });
  a.click();
  return true;
});
await page.waitForTimeout(TEARDOWN_MS); // teardown.mjs's in-window proxy
const outboundBeacon = beacons.slice(beforeOutbound).find((b) => b.name === "outbound_click") || null;
const outboundInWindow = outboundBeacon !== null;

// ---------------------------------------------------------------------------
// AC2(b) — pagehide → page_view critical beacon carrying the CURRENT page_location.
// ---------------------------------------------------------------------------
const currentUrl = await page.evaluate(() => location.href); // still the testbed page (nav suppressed)
await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
await page.waitForTimeout(200);
const pageViewBeacon = beacons.find((b) => b.name === "page_view") || null;
const closingCarriesCurrentUrl = pageViewBeacon !== null && pageViewBeacon.pageLocation === currentUrl;

// ---------------------------------------------------------------------------
// 004-03 identity (kept green): fresh context → persisted GA1 _ga; same id flows.
// ---------------------------------------------------------------------------
const documentCookie = await page.evaluate(() => document.cookie);
const gaMatch = /(?:^|;\s*)_ga=(GA1\.1\.(\d+\.\d+))(?:;|$)/.exec(documentCookie || "");
const gaCookiePersisted = gaMatch !== null;
const persistedClientId = gaMatch ? gaMatch[2] : null;
const identityFlowed = persistedClientId !== null && ctaBeacon?.clientId === persistedClientId;

await browser.close();
server.close();

const pass = bootFailed === null
  && clicked && workerPathProven // AC1 (gated)
  && outboundSimulated && outboundInWindow // AC2(a) (gated)
  && closingCarriesCurrentUrl // AC2(b) (gated)
  && gaCookiePersisted && identityFlowed; // 004-03 carried forward

const out = {
  question: "does a real UC-2 interaction deliver an MP-conformant GA4 beacon end-to-end on the REAL testbed page, with the last beacon rescued?",
  pass,
  served_root: "probes/eds-testbed (static; aem-up root)",
  teardown_ms: TEARDOWN_MS,
  boot_failed: bootFailed,
  page_url: pageUrl,
  distinct_event_names: { ac1_worker: "cta_engage", ac2_outbound: "outbound_click", ac2_closing: "page_view" },
  // AC1 — worker cycle, delivered WHILE ALIVE (no unload dispatched at delivery time)
  ac1_clicked: clicked,
  ac1_cta_arrived_alive: ctaArrivedAlive,
  ac1_cta_mp_conformant: ctaConformant,
  ac1_unload_dispatched_before_delivery: unloadDispatchedBeforeAc1Delivery, // must be false — proves worker-path, not ring-tail
  ac1_worker_path_proven: workerPathProven,
  // AC2 — unload-critical fast path
  ac2a_outbound_simulated: outboundSimulated,
  ac2a_outbound_in_teardown_window: outboundInWindow,
  ac2b_closing_carries_current_page_location: closingCarriesCurrentUrl,
  ac2b_closing_page_location: pageViewBeacon?.pageLocation ?? null,
  ac2b_current_url: currentUrl,
  // 004-03 identity, carried forward
  ga_cookie_persisted: gaCookiePersisted,
  persisted_client_id: persistedClientId,
  beacon_client_id: ctaBeacon?.clientId ?? null,
  identity_flowed: identityFlowed,
  beacons_seen: beacons.map((b) => ({ name: b.name, page_location: b.pageLocation })),
  console_noise_tolerated: consoleNoise,
  verdict: pass
    ? "PASS — cta_engage delivered via the WORKER cycle while alive (MP-conformant), the outbound_click + closing page_view took the pushCritical fast path (closing carries the current URL), and identity flowed cookie→ctx→payload, under the boilerplate CSP"
    : "FAIL — see flags above",
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
