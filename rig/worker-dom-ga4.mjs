// worker-dom-ga4 — spec 025-01 AC3 driver: an ADOPTION litmus (SEPARATE from
// the AC1/AC2 mechanism verdict, per this slice's framing) — does UNMODIFIED
// gtag.js (the real, public googletagmanager.com script, a synthetic/debug
// measurement id) boot/run as a worker-dom worker script at all, and where
// does it break (classified: model-inherent vs lib-completeness/sub-
// resource-proxy gap)?
//
// Usage: node rig/worker-dom-ga4.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
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

const browser = await chromium.launch();
const page = await browser.newPage();

const network = [];
page.on("request", (req) => network.push({ phase: "request", url: req.url(), resourceType: req.resourceType() }));
page.on("requestfailed", (req) => network.push({ phase: "requestfailed", url: req.url(), error: req.failure()?.errorText }));
page.on("response", (res) => network.push({ phase: "response", url: res.url(), status: res.status(), contentType: res.headers()["content-type"] }));
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
const consoleMsgs = [];
page.on("console", (msg) => consoleMsgs.push(`${msg.type()}: ${msg.text()}`));

await page.goto(`http://localhost:${port}/rig/worker-dom-ga4-harness.html`);
await page.waitForFunction(() => window.__rig && (window.__booted !== undefined || window.__bootError), { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(3000); // let any in-worker async sub-resource fetches settle

const snap = await page.evaluate(() => window.__rig.snapshot());
const gaTraceFilter = (n) => n.url.includes("googletagmanager") || n.url.includes("google-analytics") || n.url.includes("analytics.google");

console.log("worker-dom-ga4 (spec 025-01 AC3) — snapshot:");
console.log(JSON.stringify(snap, null, 2));
console.log("\nnetwork trace (worker-dom run):");
console.log(JSON.stringify(network.filter(gaTraceFilter), null, 2));
console.log("\nconsole messages:");
console.log(JSON.stringify(consoleMsgs, null, 2));
console.log("\npage errors:");
console.log(JSON.stringify(pageErrors, null, 2));

// --- CONTROL: the SAME synthetic-id gtag.js install on a PLAIN main-thread
// page (no worker-dom) — disambiguates "gtag.js itself no-ops for a
// synthetic id" from "worker-dom broke something" (AC3's explicit ask).
const controlNetwork = [];
const page2 = await browser.newPage();
page2.on("request", (req) => controlNetwork.push({ phase: "request", url: req.url() }));
page2.on("response", (res) => controlNetwork.push({ phase: "response", url: res.url(), status: res.status() }));
await page2.goto(`http://localhost:${port}/rig/worker-dom-ga4-control-harness.html`);
await page2.waitForFunction(() => window.__ran, { timeout: 15000 }).catch(() => {});
await page2.waitForTimeout(2000);
console.log("\n--- CONTROL (plain main-thread page, same synthetic id) network trace: ---");
console.log(JSON.stringify(controlNetwork.filter(gaTraceFilter), null, 2));

await browser.close();
server.close();
