// INP-under-storm measurement driver (spec 003-01 rig). Serves the repo root,
// launches chromium, drives a scripted storm of TRUSTED interactions (only
// trusted input produces Event Timing / INP entries), and reads back the
// per-interaction latency distribution. The GA4 endpoint is stubbed (route
// interception), so no real network or credentials are needed.
//
// Usage: MODE=baseline|worker EVENTS=10 WORK=50 CLICKS=60 GAP=40 node rig/measure.mjs
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

const MODE = process.env.MODE || "baseline";
const EVENTS = process.env.EVENTS || "10";
const WORK = process.env.WORK || "50";
const BLOCK = process.env.BLOCK || "0";
const CLICKS = Number(process.env.CLICKS || 60);
const GAP = Number(process.env.GAP || 40);

const browser = await chromium.launch();
const page = await browser.newPage();
let ga4 = 0;
await page.route("**/mp/collect*", (route) => { ga4++; return route.fulfill({ status: 204, body: "" }); });

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.goto(`http://localhost:${port}/rig/harness.html?mode=${MODE}&events=${EVENTS}&work=${WORK}&block=${BLOCK}`);
await page.waitForFunction(() => window.__rig, { timeout: 10000 });

const target = page.locator("#target");
for (let i = 0; i < CLICKS; i++) {
  await target.click({ timeout: 5000 });
  await page.waitForTimeout(GAP);
}
await page.waitForTimeout(700); // let idle work + beacons settle

const snap = await page.evaluate(() => window.__rig.snapshot());
snap.ga4_requests = ga4;
snap.storm = { clicks: CLICKS, gap_ms: GAP };
if (pageErrors.length) snap.pageErrors = pageErrors;
console.log(JSON.stringify(snap, null, 2));

await browser.close();
server.close();
