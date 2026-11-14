// Stock-context channel cost rig (spec 067-07 AC7, spec 067 section 8 item 6).
// Measures, in real Chromium: (1) the main-thread cost of one collection,
// (2) INP-style interaction latency and (3) LCP for the worker-mode harness
// with and without the channel (rig/harness.html?stockctx=1), alternating runs.
//
// Usage: RUNS=8 CLICKS=40 node rig/stock-context-cost.mjs
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try {
    const file = join(ROOT, normalize(decodeURIComponent((req.url || "/").split("?")[0])));
    if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(await readFile(file));
  } catch (e) { res.writeHead(404); res.end(String(e)); }
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

const RUNS = Number(process.env.RUNS || 8);
const CLICKS = Number(process.env.CLICKS || 40);
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const pct = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))];

const browser = await chromium.launch();

async function runOnce(stockctx) {
  const page = await browser.newPage();
  await page.route("**/collect*", (r) => r.fulfill({ status: 204, body: "" }));
  await page.addInitScript(() => {
    window.__lcp = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lcp = e.startTime; })
      .observe({ type: "largest-contentful-paint", buffered: true });
  });
  await page.addInitScript(() => {
    window.__long = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(e.duration); })
      .observe({ type: "longtask", buffered: true });
  });
  await page.goto(`http://localhost:${port}/rig/harness.html?mode=worker&trackers=5&work=30000${stockctx ? "&stockctx=1" : ""}`);
  await page.waitForFunction(() => window.__rig, { timeout: 10000 });
  const boot = await page.evaluate(() => performance.now());
  for (let i = 0; i < CLICKS; i++) {
    // resize storm: every click is preceded by a viewport change, so the channel re-collects
    await page.setViewportSize({ width: 900 + (i % 2) * 40, height: 700 });
    await page.locator("#target").click({ timeout: 5000 });
    await page.waitForTimeout(40);
  }
  const snap = await page.evaluate(() => window.__rig.snapshot());
  const lcp = await page.evaluate(() => window.__lcp);
  const long = await page.evaluate(() => window.__long);
  await page.close();
  return { boot_ms: Math.round(boot), long_tasks: long.length, long_task_ms: Math.round(long.reduce((a, b) => a + b, 0)), inp_p98: snap.inp_p98, inp_max: snap.inp_max, interactions: snap.interactions, lcp };
}

const off = [], on = [];
for (let i = 0; i < RUNS; i++) { off.push(await runOnce(false)); on.push(await runOnce(true)); }

// (1) collection cost in the page, via the real module
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/rig/harness.html?mode=naive`);
const micro = await page.evaluate(async () => {
  const { collectStockContext } = await import("/core/stock-context.js");
  for (let i = 0; i < 200; i++) collectStockContext(); // warm up
  const t = [];
  for (let i = 0; i < 2000; i++) { const a = performance.now(); collectStockContext(); t.push(performance.now() - a); }
  const a0 = performance.now();
  for (let i = 0; i < 2000; i++) collectStockContext();
  const mean_ms = (performance.now() - a0) / 2000; // browser timers are coarse; the batch mean is the precise figure
  t.sort((x, y) => x - y);
  return { n: t.length, mean_ms, median_ms: t[1000], p95_ms: t[1900], p99_ms: t[1980], max_ms: t[1999] };
});
await browser.close();
server.close();

const col = (rs, k) => rs.map((r) => r[k]);
const summ = (rs) => ({
  inp_p98_median: median(col(rs, "inp_p98")), inp_p98_p90: pct(col(rs, "inp_p98"), 90),
  inp_max_median: median(col(rs, "inp_max")),
  interactions_median: median(col(rs, "interactions")),
  long_tasks_total: col(rs, "long_tasks").reduce((a, b) => a + b, 0),
  long_task_ms_total: col(rs, "long_task_ms").reduce((a, b) => a + b, 0),
  boot_ms_median: median(col(rs, "boot_ms")),
  lcp_median: Math.round(median(col(rs, "lcp"))), lcp_p90: Math.round(pct(col(rs, "lcp"), 90)),
});
console.log(JSON.stringify({ runs: RUNS, clicks: CLICKS, collection: micro, without: summ(off), with: summ(on), raw: { off, on } }, null, 2));
