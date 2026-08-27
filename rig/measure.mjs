// INP-under-storm measurement driver (spec 003-01 rig). Serves the repo root,
// launches chromium, drives a scripted storm of TRUSTED interactions (only
// trusted input produces Event Timing / INP entries), and reads back the
// per-interaction latency distribution. The GA4 endpoint is stubbed (route
// interception), so no real network or credentials are needed.
//
// Usage: MODE=naive|deferred|worker EVENTS=10 WORK=50 CLICKS=60 GAP=40 node rig/measure.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)); // repo root
const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".json": "application/json", ".css": "text/css",
};

const server = http.createServer(async (req, res) => {
  try {
    const p = decodeURIComponent((req.url || "/").split("?")[0]);
    const file = join(ROOT, normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch (e) { res.writeHead(404); res.end("404 " + e.message); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const MODE = process.env.MODE || "naive";
const TRACKERS = process.env.TRACKERS || "5";
const WORK = process.env.WORK || "30000";
const CLICKS = Number(process.env.CLICKS || 60);
const GAP = Number(process.env.GAP || 60);

const browser = await chromium.launch();
const page = await browser.newPage();
let egress = 0;
// stub every tracker endpoint (t0..tN /collect) so no real network is needed
await page.route("**/collect*", (route) => { egress++; return route.fulfill({ status: 204, body: "" }); });

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.goto(`http://localhost:${port}/rig/harness.html?mode=${MODE}&trackers=${TRACKERS}&work=${WORK}`);
await page.waitForFunction(() => window.__rig, { timeout: 10000 });

const target = page.locator("#target");
for (let i = 0; i < CLICKS; i++) {
  await target.click({ timeout: 5000 });
  await page.waitForTimeout(GAP);
}
// Let delivery complete: flush, then poll until the intercepted egress count
// stabilizes (delivery under a NORMAL settle), max 25s. The gap between this and
// the count at page-close is the teardown loss (OQ10 / R-001).
await page.evaluate(() => window.__rig.snapshot());
let prev = -1, stable = 0;
for (let i = 0; i < 130 && stable < 4; i++) {
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__rig.snapshot()); // re-flush any remaining
  if (egress === prev) stable++; else { stable = 0; prev = egress; }
}

const snap = await page.evaluate(() => window.__rig.snapshot());
snap.egress_requests = egress;
snap.expected_egress = CLICKS * Number(TRACKERS);
snap.storm = { clicks: CLICKS, gap_ms: GAP };
if (pageErrors.length) snap.pageErrors = pageErrors;
console.log(JSON.stringify(snap, null, 2));

await browser.close();
server.close();
