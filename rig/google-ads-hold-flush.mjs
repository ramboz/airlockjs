// Google Ads (AW) hold→flush real-chamber rig — spec 048-01 AC5 (the held-arm the
// original rig/google-ads-chamber.mjs left FakeWorker-proven). Mirrors that rig's
// build-first / serve / Playwright / intercept-ccm-collect discipline, but boots the
// REAL adapter (`boot(config)` from the BUILT eds.js) so the held→remap→flush
// combination runs through the ACTUAL seal (core/airlock.js holdOnDenied buffer +
// setConsent flush + createGoogleAdsRemap re-map) AND the ACTUAL, BUILT
// google-ads-chamber.worker.js — a real browser Worker, not a FakeWorker simulation.
//
// The proof (denied→granted, one real chamber, one real seal):
//   1. boot google-ads under DENIED ad_storage (+ holdOnDenied) and push a page_view →
//      the real chamber maps it, the real seal HOLDS it: ZERO egress (assert 0 beacons).
//   2. a mid-session setConsent(GRANTED) → the seal re-maps the held beacon via
//      createGoogleAdsRemap and dispatches it: EXACTLY ONE beacon egresses, carrying the
//      GRANTED Consent-Mode encoding (gcs=G111) — proving the flush RE-MAPPED under the
//      now-current consent, not re-sent the stale denied-era payload (ADR-0023 / 045-01).
//
// Usage: node rig/google-ads-hold-flush.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));

// 1. Build FIRST — the chamber the real boot() spawns is build.mjs's OWN emitted sibling
//    (probes/eds-testbed/scripts/airlock/google-ads-chamber.worker.js), never a stand-in.
execSync("npm run build", { cwd: REPO, stdio: "inherit" });

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json",
};

const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = join(REPO, normalize(p));
    if (!file.startsWith(REPO)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch();
const page = await browser.newPage();

// Intercept the AW ccm/collect destination — hermetic (no real egress to google.com).
const beacons = [];
await page.route("**/ccm/collect*", async (route) => {
  beacons.push(route.request().url());
  await route.fulfill({ status: 204, body: "" });
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

let harnessError = null, heldPhaseBeacons = null, evalError = null;
try {
  await page.goto(`http://localhost:${port}/rig/google-ads-hold-flush-harness.html`);
  // Wait for the harness to boot + push (or surface an error).
  await page.waitForFunction(() => window.__READY__ === true || window.__HARNESS_ERROR__ !== undefined, { timeout: 20000 });
  harnessError = await page.evaluate(() => window.__HARNESS_ERROR__ ?? null);
  if (!harnessError) {
    // Phase 1 — HELD: the seal buffered the denied beacon (deterministic `held` diagnostic).
    await page.waitForFunction(() => window.__HELD__ === true, { timeout: 20000 });
    heldPhaseBeacons = beacons.length; // MUST be 0 — nothing egressed while denied

    // Phase 2 — FLUSH: trigger the grant, then wait for the real egress + the `flushed` diagnostic.
    const flushReq = page.waitForRequest("**/ccm/collect*", { timeout: 20000 });
    await page.evaluate(() => window.__grant__());
    await flushReq;
    await page.waitForFunction(() => window.__FLUSHED__ === true, { timeout: 20000 });
  }
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (harnessError) {
  console.log(JSON.stringify({ pass: false, verdict: "FAIL — harness error: " + harnessError, pageErrors }, null, 2));
  process.exit(1);
}
if (evalError) {
  console.log(JSON.stringify({ pass: false, verdict: "FAIL — rig error: " + evalError.message, beacons, pageErrors }, null, 2));
  process.exit(1);
}

// --- AC5 held-arm assertions ---
let parsed = null;
try { parsed = beacons.length === 1 ? new URL(beacons[0]) : null; } catch { /* keep null */ }

const assertions = {
  held_under_denied_zero_egress: heldPhaseBeacons === 0, // the real seal HELD the beacon (no fetch while denied)
  flushed_exactly_one_beacon_on_grant: beacons.length === 1, // setConsent(granted) egressed it, once
  flushed_beacon_destination_is_ccm_collect: !!parsed && parsed.origin + parsed.pathname === "https://www.google.com/ccm/collect",
  // The re-map ran under the NOW-granted consent: gcs=G111 (all-granted) + npa=0. A stale re-send of the
  // denied-era beacon would carry the denied Consent-Mode encoding instead — this discriminates re-map from re-send.
  flushed_beacon_carries_GRANTED_consent_encoding:
    !!parsed &&
    parsed.searchParams.get("tid") === "AW-1234567890" &&
    parsed.searchParams.get("en") === "page_view" &&
    parsed.searchParams.get("gcs") === "G111" &&
    parsed.searchParams.get("npa") === "0",
};
const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "does a config-booted Google Ads connector's page-load beacon, HELD by the real seal under denied ad_storage, RE-MAP + FLUSH on a mid-session grant — end-to-end through the ACTUAL core/airlock.js seal AND the ACTUAL, BUILT google-ads-chamber.worker.js (a real browser Worker), not a FakeWorker + source inspection?",
  pass,
  held_phase_beacon_count: heldPhaseBeacons,
  flush_phase_beacon_count: beacons.length,
  assertions,
  beacons_seen: beacons,
  page_errors: pageErrors,
  closes_residual:
    "spec 048-01 AC5 named residual: the held→remap→flush combination was FakeWorker-proven (test/eds-boot-google-ads.test.js, test/google-ads-seal.test.js) + source-inspected (core/connector-host.js preserves `event`; core/airlock.js buffers `r.event` for re-map). This arm now exercises it end-to-end through the real seal + real chamber.",
  verdict: pass
    ? "PASS — the real seal HELD the denied page_view beacon (0 egress), and a mid-session grant re-mapped + flushed it through the real, built google-ads-chamber.worker.js exactly once, carrying the granted Consent-Mode encoding (re-map, not re-send)"
    : "FAIL — see assertions above",
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
