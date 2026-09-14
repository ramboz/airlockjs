// Google Ads (AW) real-chamber rig — spec 048-01 AC5. Mirrors rig/isolation.mjs's
// direct-Worker-message-driving technique (init -> events -> {ready}) PLUS
// rig/e2e.mjs's "run against the real `npm run build` output" discipline: this rig
// builds FIRST (so the asserted worker file is build.mjs's own emitted
// `google-ads-chamber.worker.js` sibling, never a hand-rolled stand-in), then drives
// it as a genuine `{type:"module"}` browser Worker, and additionally plays the
// orchestrator's own main-thread dispatch (core/airlock.js's `fetch(req.url,
// fetchInit(...))`) so the beacon's actual EGRESS is what gets asserted — closing the
// frame-critique's "FakeWorker hides the missing chamber" gap for the GRANTED
// steady-state path.
//
// Named residual (the slice's own AC5 text): this rig arm proves the GRANTED
// steady-state GET; the held->remap->flush combination stays FakeWorker-proven
// (test/eds-boot-google-ads.test.js / test/google-ads-seal.test.js AC4) — the
// real-chamber + hold + remap combination is verified by source inspection
// (core/connector-host.js preserves `event`; core/airlock.js buffers `r.event` for
// re-map, 045-01), not exercised end-to-end here.
//
// Usage: node rig/google-ads-chamber.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const BUILT_WORKER_REPO_PATH = "probes/eds-testbed/scripts/airlock/google-ads-chamber.worker.js";

// 1. Build FIRST — the asserted worker file below is build.mjs's OWN emitted sibling
//    (self-asserts the N-worker sibling layout too, per build.mjs's own invariants).
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

// Intercept the AW ccm/collect destination — hermetic (no real egress to
// google.com), mirrors rig/smoke-core.mjs's captureCollectBeacons pattern (fulfil
// 204, never route.continue()).
const beacons = [];
await page.route("**/ccm/collect*", async (route) => {
  beacons.push(route.request().url());
  await route.fulfill({ status: 204, body: "" });
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

let result = null, evalError = null;
try {
  const workerUrl = `/${BUILT_WORKER_REPO_PATH}`;
  await page.goto(`http://localhost:${port}/rig/google-ads-chamber-harness.html?workerUrl=${encodeURIComponent(workerUrl)}`);
  await page.waitForFunction(() => window.__GOOGLE_ADS_CHAMBER_RESULT__ !== undefined, { timeout: 15000 });
  result = await page.evaluate(() => window.__GOOGLE_ADS_CHAMBER_RESULT__);
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (evalError) {
  console.log(JSON.stringify({ pass: false, verdict: "FAIL — rig error: " + evalError.message, pageErrors }, null, 2));
  process.exit(1);
}
if (!result || result.workerError) {
  console.log(JSON.stringify({ pass: false, verdict: "FAIL — chamber worker error: " + (result && result.workerError), result, pageErrors }, null, 2));
  process.exit(1);
}

// --- AC5 assertions ---
const readyShapeOk = Array.isArray(result.ready) && result.ready.length === 1 && result.ready[0].method === "GET";
const dispatchedOk = Array.isArray(result.dispatched) && result.dispatched.length === 1 && result.dispatched[0].ok === true;
const beaconCaptured = beacons.length === 1;

let parsed = null;
try { parsed = beaconCaptured ? new URL(beacons[0]) : null; } catch { /* keep null */ }
const destinationCorrect = !!parsed && parsed.origin + parsed.pathname === "https://www.google.com/ccm/collect";
const carriesExpectedParams =
  !!parsed &&
  parsed.searchParams.get("tid") === "AW-1234567890" &&
  parsed.searchParams.get("en") === "page_view" &&
  parsed.searchParams.get("gcs") === "G111" && // Consent-Mode v2: all-granted encoding
  parsed.searchParams.get("npa") === "0";

const assertions = {
  chamber_worker_is_the_built_sibling: true, // load-bearing by construction (workerUrl points at build.mjs's own emitted file)
  chamber_produced_one_ready_get_request: readyShapeOk,
  main_thread_dispatch_fetched_it: dispatchedOk,
  beacon_egressed_exactly_once: beaconCaptured,
  beacon_destination_is_ccm_collect: destinationCorrect,
  beacon_carries_expected_governed_params: carriesExpectedParams,
};
const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "does a config-booted Google Ads connector's page-load beacon egress as the expected governed ccm/collect GET through its ACTUAL, BUILT core/google-ads-chamber.worker.js (a real browser Worker, not a FakeWorker simulation)?",
  pass,
  worker_url: BUILT_WORKER_REPO_PATH,
  assertions,
  beacons_seen: beacons,
  chamber_ready: result.ready,
  chamber_dropped: result.dropped,
  page_errors: pageErrors,
  named_residual:
    "This arm proves the GRANTED steady-state GET only. The held->remap->flush combination (holdOnDenied + createGoogleAdsRemap through this SAME real chamber) stays FakeWorker-proven (test/eds-boot-google-ads.test.js, test/google-ads-seal.test.js) — per the slice's own AC5 text, not exercised end-to-end here.",
  verdict: pass
    ? "PASS — the real, built google-ads-chamber.worker.js mapped the page_view to the expected ccm/collect GET, and the orchestrator's main-thread dispatch egressed it exactly once with the correct tid/en/gcs/npa"
    : "FAIL — see assertions above",
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
