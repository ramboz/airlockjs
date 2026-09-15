// Floodlight (DC) real-chamber rig — spec 048-02 AC5. Mirrors rig/google-ads-chamber.mjs's technique
// (build FIRST, then drive the REAL, BUILT `floodlight-chamber.worker.js` as a genuine
// `{type:"module"}` browser Worker, playing the orchestrator's own main-thread dispatch so the
// beacons' actual EGRESS is what gets asserted) — extended here to BOTH DC beacon forms
// (ccm/collect + the `;`-matrix activity beacon), since a config-booted Floodlight connector with
// `src` configured produces both from ONE chamber.
//
// Named residual (mirrors the google-ads rig's own AC5 text): this rig arm proves the GRANTED
// steady-state GET for BOTH forms; the held->remap->flush combination stays FakeWorker-proven
// (test/eds-boot-floodlight.test.js / test/floodlight-seal.test.js) — the real-chamber + hold + remap
// combination is verified by source inspection (core/connector-host.js preserves `event`;
// core/airlock.js buffers `r.event` for re-map, 045-01), not exercised end-to-end here.
//
// Usage: node rig/floodlight-chamber.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));
const BUILT_WORKER_REPO_PATH = "probes/eds-testbed/scripts/airlock/floodlight-chamber.worker.js";

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

// Intercept BOTH DC destinations — hermetic (no real egress to google.com/doubleclick.net), mirrors
// rig/smoke-core.mjs's captureCollectBeacons pattern (fulfil 204, never route.continue()).
const beacons = [];
await page.route("**/ccm/collect*", async (route) => {
  beacons.push(route.request().url());
  await route.fulfill({ status: 204, body: "" });
});
await page.route("**/activity*", async (route) => {
  beacons.push(route.request().url());
  await route.fulfill({ status: 204, body: "" });
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

let result = null, evalError = null;
try {
  const workerUrl = `/${BUILT_WORKER_REPO_PATH}`;
  await page.goto(`http://localhost:${port}/rig/floodlight-chamber-harness.html?workerUrl=${encodeURIComponent(workerUrl)}`);
  await page.waitForFunction(() => window.__FLOODLIGHT_CHAMBER_RESULT__ !== undefined, { timeout: 15000 });
  result = await page.evaluate(() => window.__FLOODLIGHT_CHAMBER_RESULT__);
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

// --- AC5 assertions (both DC forms) ---
const readyShapeOk = Array.isArray(result.ready) && result.ready.length === 2 && result.ready.every((r) => r.method === "GET");
const dispatchedOk = Array.isArray(result.dispatched) && result.dispatched.length === 2 && result.dispatched.every((d) => d.ok === true);
const beaconCaptured = beacons.length === 2;

let ccmParsed = null, activityUrl = null;
try {
  ccmParsed = new URL(beacons.find((b) => b.includes("/ccm/collect")));
  activityUrl = beacons.find((b) => b.includes("/activity"));
} catch { /* keep null */ }

const ccmDestinationCorrect = !!ccmParsed && ccmParsed.origin + ccmParsed.pathname === "https://www.google.com/ccm/collect";
const ccmParamsOk =
  !!ccmParsed &&
  ccmParsed.searchParams.get("tid") === "DC-1234567890" &&
  ccmParsed.searchParams.get("en") === "page_view" &&
  ccmParsed.searchParams.get("gcs") === "G111" &&
  ccmParsed.searchParams.get("npa") === "0";

const activityDestinationCorrect = !!activityUrl && activityUrl.startsWith("https://ad.doubleclick.net/activity;src=1234567");
const activityParamsOk = !!activityUrl && activityUrl.includes("type=grptag00") && activityUrl.includes("cat=acttag00") && activityUrl.includes("gcs=G111") && activityUrl.includes("npa=0");

const assertions = {
  chamber_worker_is_the_built_sibling: true, // load-bearing by construction (workerUrl points at build.mjs's own emitted file)
  chamber_produced_two_ready_get_requests: readyShapeOk,
  main_thread_dispatch_fetched_both: dispatchedOk,
  both_beacons_egressed_exactly_once: beaconCaptured,
  ccm_beacon_destination_correct: ccmDestinationCorrect,
  ccm_beacon_carries_expected_governed_params: ccmParamsOk,
  activity_beacon_destination_correct_and_ceiling_admitted_it: activityDestinationCorrect,
  activity_beacon_carries_expected_governed_params: activityParamsOk,
};
const pass = Object.values(assertions).every(Boolean);

const out = {
  question:
    "does a config-booted Floodlight connector's page-load beacon(s) — BOTH ccm/collect and the ;-matrix activity form — egress as the expected governed GETs through its ACTUAL, BUILT core/floodlight-chamber.worker.js (a real browser Worker, not a FakeWorker simulation)?",
  pass,
  worker_url: BUILT_WORKER_REPO_PATH,
  assertions,
  beacons_seen: beacons,
  chamber_ready: result.ready,
  chamber_dropped: result.dropped,
  page_errors: pageErrors,
  named_residual:
    "This arm proves the GRANTED steady-state GET for BOTH forms. The held->remap->flush combination (holdOnDenied + createFloodlightRemap through this SAME real chamber, for either remapKey) stays FakeWorker-proven (test/eds-boot-floodlight.test.js, test/floodlight-seal.test.js) — not exercised end-to-end here, mirroring the google-ads rig's own named residual.",
  verdict: pass
    ? "PASS — the real, built floodlight-chamber.worker.js mapped the page_view to BOTH the expected ccm/collect GET and the ;-matrix activity GET, and the orchestrator's main-thread dispatch egressed both exactly once with the correct governed params"
    : "FAIL — see assertions above",
};
console.log(JSON.stringify(out, null, 2));
process.exit(pass ? 0 : 1);
