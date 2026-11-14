// Limits-burst real-Chromium rig — spec 067-06 AC4 (ADR-0062 point 6).
// A burst larger than every former cap, and larger than the browser's shared 64 KiB
// keepalive limit, goes through the BUILT eds.js, the real GA4 chamber and the real seal
// on the default path. Requests are held open until the whole burst has been issued, so
// the browser's in-flight keepalive limit is genuinely exceeded. Asserts: every event
// reaches the wire exactly once, in order, nothing is rejected (no egress-failure
// diagnostic), and the sends past the limit were issued as plain (non-keepalive) fetches.
//
// Usage: node rig/limits-burst.mjs   (exits non-zero if any assertion fails)
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const REPO = fileURLToPath(new URL("..", import.meta.url));
execSync("npm run build", { cwd: REPO, stdio: "inherit" });

const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };
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

const BURST = 600;
const seen = []; // i of each request that reached the wire
let release;
const gate = new Promise((r) => { release = r; });
await page.route("**/mp/collect*", async (route) => {
  const req = route.request();
  let i = null;
  try { i = JSON.parse(req.postData() || "{}").events?.[0]?.params?.i ?? null; } catch { /* keep null */ }
  seen.push(i);
  if (seen.length >= BURST) release();
  await gate; // hold in flight until the whole burst is issued
  await route.fulfill({ status: 204, body: "" });
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

let harnessError = null, evalError = null, diags = [], calls = [];
try {
  await page.goto(`http://localhost:${port}/rig/limits-burst-harness.html`);
  await page.waitForFunction(() => window.__READY__ === true || window.__HARNESS_ERROR__ !== undefined, { timeout: 20000 });
  harnessError = await page.evaluate(() => window.__HARNESS_ERROR__ ?? null);
  if (!harnessError) {
    await Promise.race([gate, new Promise((r) => setTimeout(r, 20000))]);
    await page.waitForTimeout(500);
    diags = await page.evaluate(() => window.__DIAGS__);
    calls = await page.evaluate(() => window.__CALLS__);
  }
} catch (err) {
  evalError = err;
} finally {
  await browser.close();
  server.close();
}

if (harnessError || evalError) {
  console.log(JSON.stringify({ pass: false, verdict: "FAIL — " + (harnessError || evalError.message), pageErrors }, null, 2));
  process.exit(1);
}

// Order is asserted on the fetch calls the seal issues; the browser may reorder the
// wire arrival between keepalive and plain requests, which is outside the seal's control.
const issued = calls.map((c) => c.i);
const plain = calls.filter((c) => !c.keepalive).length;
const assertions = {
  all_events_reached_the_wire_once: seen.length === BURST && new Set(seen).size === BURST && seen.every((v) => v >= 0 && v < BURST),
  issued_in_order_nothing_dropped: issued.length === BURST && issued.every((v, k) => v === k),
  over_limit_sends_went_out_plain: plain > 0 && calls.slice(0, 50).every((c) => c.keepalive),
  no_egress_failure_diagnostic: !diags.some((d) => d && d.kind === "egress-failure"),
  no_keepalive_budget_drop: !diags.some((d) => d && d.kind === "keepalive-budget"),
};
const pass = Object.values(assertions).every(Boolean);
console.log(JSON.stringify({
  pass,
  burst: BURST,
  received: seen.length,
  plain_fetches: plain,
  assertions,
  page_errors: pageErrors,
  verdict: pass
    ? "PASS — a burst past every former cap and the 64 KiB keepalive limit reached the wire in order with nothing dropped or rejected"
    : "FAIL — see assertions above",
}, null, 2));
process.exit(pass ? 0 : 1);
